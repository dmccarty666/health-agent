# Epic G3 — Typed Relationships + Advanced Reasoning

**Phase:** G3  
**Doc Version:** 0.1  
**Date:** 2026-05-23  
**Status:** Proposed  
**Parent:** `docs/GRAPH_MEMORY.md`  
**Quality Standard:** `docs/GRAPH_QUALITY.md` — all stories inherit coverage floors, pytest infra, and type/lint requirements from this doc  
**Prerequisite:** Epic G1 + G2 complete  
**Est. Lines:** 400–500

---

## Epic Summary

Add LLM-extracted entity-to-entity relationship edges during dream, temporal reasoning from audit logs, graph visualization, and an entity lifecycle status machine. This transforms the flat entity join into a rich typed knowledge graph.

---

## Story G3.1 — LLM-Extracted Entity→Entity Relations

**Story points:** 8  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G1.5 + G2.1

### What

During dream pipeline Stage 4b (new stage, added after G1.5 wires entity extraction), call the LLM to infer entity-to-entity relationships from extracted facts. Instead of just "mentions X,Y,Z in this fact", the model identifies "X `used_by` Y", "X `runs_on` Y", "X `depends_on` Y" etc. These are stored in `entity_relations`.

This is the step that transforms `fact_entities` (many-to-many with no semantics) into `entity_relations` (typed, directional graph edges with provenance).

### Extraction Prompt

The LLM is given the fact text + list of extracted entities and asked to identify any relationships:

```
You are extracting entity relationships from a fact statement.
Given the following fact and the entities it mentions, identify any 
directional relationships between the entities.

Entities found: [list]
Fact: "Qwen runs on Spark2 at 192.168.2.105"

Extract relationships as JSON:
{
  "relations": [
    {"source": "Qwen", "target": "Spark2", "type": "runs_on", "confidence": 0.95},
    {"source": "Qwen", "target": "192.168.2.105", "type": "deployed_at", "confidence": 0.90}
  ]
}

Relation types allowed:
  used_by, runs_on, depends_on, subproject_of, competitor_of,
  related_to, authored_by, version_of, evolved_from, renamed_to,
  deployed_at, configured_with
```

### Relation Types

| Type | Direction | Example |
|---|---|---|
| `used_by` | X → Y | "Qwen used by hermes-agent" |
| `runs_on` | X → Y | "Qwen runs on Spark2" |
| `depends_on` | X → Y | "lmstudio depends on CUDA" |
| `subproject_of` | X → Y | "kanban work → hermes-agent" |
| `competitor_of` | X → Y | "Claude ↔ GPT" |
| `related_to` | X → Y | generic fallback |
| `authored_by` | X → Y | "Codex authored by OpenAI" |
| `version_of` | X → Y | "Qwen3.6 → Qwen3" |
| `evolved_from` | X → Y | "Spark2 evolved_from Spark" |
| `deployed_at` | X → Y | "hermes deployed at 192.168.2.249" |
| `configured_with` | X → Y | "hermes configured with LMS" |

### Tasks

- [ ] Add `extract_entity_relations(text: str, entities: List[ExtractedEntity], llm_url: str, model: str) -> List[Dict]` to `hermes_memory_core/dream/entity.py`:
  - Build prompt with fact text + entities
  - Call LLM with JSON output mode
  - Parse `{"relations": [...]}` from response
  - Validate relation type against allowed list
  - Return list of `(source_id, target_id, relation_type, confidence)` or `(entity_name, entity_name, relation_type, confidence)` if IDs not yet resolved
- [ ] Add Stage 4b to `worker.py` dream pipeline: after entity extraction + fact linking, call relation extraction
- [ ] Map relation entity names → `entity_id` (already in `entities` table from G1.5)
- [ ] Insert to `entity_relations` via `store.upsert_entity_relation()`
- [ ] Add `source_ref` to relation row: `fact:{fact_id}` for traceability
- [ ] Handle LLM failure gracefully: log warning, skip relation extraction, don't fail the dream run
- [ ] Add unit tests:
  - `test_extract_relations_parses_valid_json` — valid LLM output parsed correctly
  - `test_extract_relations_unknown_type_filtered` — invalid relation types filtered out
  - `test_extract_relations_confidence_threshold` — below threshold filtered
  - `test_extract_relations_partial_failure_handled` — LLM timeout returns empty list, no exception
- [ ] Add integration test: dream run on session with known relations → query `entity_relations` populated

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G3.1-AC1 | After dream run, `SELECT COUNT(*) FROM entity_relations` > 0 (assuming session text contains relatable facts) | Integration test | integration |
| G3.1-AC2 | All relation types are in the allowed set | Unit test - arbitrary type rejected | unit |
| G3.1-AC3 | Invalid LLM output (malformed JSON) → returns `[]`, logs warning | Unit test failure path | unit |
| G3.1-AC4 | `entity_relations.source_ref` traces back to source fact | Integration query | integration |
| G3.1-AC5 | Dream run with LLM timeout on relation extraction completes (no dream run failure) | Unit test mock | unit |
| G3.1-AC6 | Repeated dream runs don't duplicate `entity_relations` rows | Integration test - re-run, check count | integration |

### Definition of Done

`entity_relations` populated by LLM extraction during dream. Traceability to source facts. Failure in relation extraction doesn't fail dream. Idempotent on re-run.

---

## Story G3.2 — Temporal Graph Reasoning

**Story points:** 5  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G3.1

### What

Use `audit_log` timestamps to construct temporal edges — entity `evolved_from` and `renamed_to` edges based on entity lifecycle changes. Also enable queries like "how has entity X evolved over time?" by traversing the temporal edge chain.

### Temporal Edge Types

- `evolved_from`: entity Y is a renamed/updated version of entity X (Y came after X chronologically)
- `renamed_to`: entity X's name changed to Y (at `audit_log` timestamp)
- `superseded_by`: entity X is no longer active, replaced by entity Y

### Detection Logic

```python
def detect_temporal_edges(store: MemoryDB) -> List[Dict]:
    """Scan audit_log for entity lifecycle changes:
    1. Alias changes: same entity_id, name changed
    2. Entity type changes: same entity, type changed
    3. Name reuse: same name, different entity_id (after archival)
    """
    edges = []
    for action in ['entity_update', 'entity_rename', 'entity_archive']:
        events = store.audit_log_entries_by_action(action)
        for event in events:
            before = json.loads(event.detail_json).get('before', {})
            after = json.loads(event.detail_json).get('after', {})
            if before.get('name') != after.get('name'):
                edges.append({
                    'source': before.get('name'),
                    'target': after.get('name'),
                    'type': 'renamed_to',
                    'timestamp': event.timestamp,
                    'confidence': 0.9,
                })
    return edges
```

### Tasks

- [ ] Add `audit_log.entity_update` and `entity_rename` event types (add to `write_audit` calls in entity upsert path)
- [ ] Add `audit_log_entries_by_action(store, action: str) -> List[Dict]` query helper to `sqlite.py`
- [ ] Add `detect_temporal_edges(store: MemoryDB) -> List[Dict]` function to `graph.py`
- [ ] Add `upsert_temporal_edges(store: MemoryDB)` that runs temporal edge detection and inserts to `entity_relations`
- [ ] Add `entity_history(entity: str) -> List[Dict]` to `EntityGraph`:
  - Traverse `evolved_from` / `renamed_to` edges from this entity backward
  - Return timeline of entity lifecycle events
- [ ] Add `evolved_from` / `renamed_to` to relation type allowlist (in G3.1 extraction)
- [ ] Add unit tests:
  - `test_detect_temporal_alias_change` — entity name change generates `renamed_to` edge
  - `test_entity_history_returns_timeline` — temporal traversal returns ordered events
  - `test_detect_no_edges_when_stable` — stable entity generates no temporal edges

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G3.2-AC1 | Entity rename logged as `entity_rename` audit event | Unit test - write + query audit log | unit |
| G3.2-AC2 | `detect_temporal_edges()` returns edges for name-changed entities | Unit test | unit |
| G3.2-AC3 | `entity_history("Qwen")` returns timeline with ≥1 event or empty list if never changed | Unit test | unit |
| G3.2-AC4 | `upsert_temporal_edges()` inserts edges without duplicating | Integration test | integration |
| G3.2-AC5 | Stable entity with no changes → `entity_history()` returns empty list | Unit test | unit |

### Definition of Done

Audit log captures entity lifecycle events. Temporal edge detection works. Entity history timeline queryable.

---

## Story G3.3 — Graph Visualization

**Story points:** 5  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G2.1

### What

Generate a D3.js force-directed graph visualization of the entity graph as a static HTML file. Callable on-demand for any entity ego-graph or the full entity projection.

### CLI Command

```bash
# Generate a standalone HTML visualization
python -m hermes_memory_core.graph.visualize \
    --center-entity hermes-agent \
    --depth 2 \
    --output ~/.hermes/memory/graphs/entity-graph-hermes-agent.html

# Full graph (no center, limited to top-50 by PageRank)
python -m hermes_memory_core.graph.visualize \
    --output ~/.hermes/memory/graphs/entity-graph-full.html
```

### Visualization Features

- Force-directed layout (D3.js v7)
- Entity nodes: circle, sized by PageRank score, colored by `entity_type`
- Fact nodes: square, smaller, link to source fact text on hover
- Entity→Entity edges: line, labeled with `relation_type`
- Facet→Entity edges: dashed, lighter
- Hover tooltip: entity name, type, fact count, aliases
- Click: expand/collapse ego-graph for that entity
- Pan + zoom (D3 zoom behavior)

### HTML Template Structure

```html
<!-- Minimal D3.js CDN-based template -->
<!DOCTYPE html>
<html><head>
  <script src="https://d3js.org/d3.v7.min.js"><\/script>
  <style>/* force-directed CSS */</style>
</head><body>
  <svg id="graph"></svg>
  <script>
    // Read JSON graph data
    // Render force simulation
    // Attach interactions
  <\/script>
</body></html>
```

### Tasks

- [ ] Add `hermes_memory_core/graph/visualize.py`
- [ ] Add `GraphExporter` class:
  ```python
  class GraphExporter:
      def export_ego_html(entity: str, depth: int = 2, store: MemoryDB) -> str:
          """Generate HTML for ego-graph centered on entity."""
      def export_full_html(top_k: int = 50, store: MemoryDB) -> str:
          """Generate HTML for top-k entities by PageRank."""
      def _build_json_graph(...) -> dict:
          """Build {nodes: [...], links: [...]} JSON from EntityGraph."""
  ```
- [ ] Add `--output` path validation (must be under `~/.hermes/memory/graphs/`)
- [ ] Add `graph.md` CLI with `visualize` subcommand
- [ ] Ensure output dir `~/.hermes/memory/graphs/` is created if missing
- [ ] Add unit tests:
  - `test_export_ego_html_produces_html` — output contains `<html>`, `<svg>`
  - `test_export_full_html_respects_top_k` — nodes count ≤ top_k
  - `test_output_under_memory_dir` — path validation rejects `/tmp/evil.html`
  - `test_json_graph_format` — nodes have `id, type, size`, links have `source, target, type`
- [ ] Add manual verification: open generated HTML, verify graph renders

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G3.3-AC1 | `visualize --center-entity hermes-agent --depth 1` produces valid HTML | File content check | smoke |
| G3.3-AC2 | HTML includes D3.js CDN script tag | String check | unit |
| G3.3-AC3 | Graph JSON built correctly: nodes include `entity_type` and `label`, links include `relation_type` | Unit test on `_build_json_graph` | unit |
| G3.3-AC4 | Output file saved under `~/.hermes/memory/graphs/` | Path check | smoke |
| G3.3-AC5 | Privacy: generated HTML has no external requests except D3 CDN | Network check | unit |
| G3.3-AC6 | Graph renders in browser without JS errors | Manual verification | unit |

### Definition of Done

HTML graph generates and renders in browser. Entity nodes and edges visible. D3 CDN loads.

---

## Story G3.4 — Entity Status Lifecycle

**Story points:** 3  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G3.2

### What

Track entity lifecycle states: `active → archived → revived`. Enables "which entities did I stop working with?" queries and prevents stale entities from polluting graph centrality scores.

### Lifecycle States

| State | Description | Transition trigger |
|---|---|---|
| `active` | Entity appears in recent facts | Default on entity creation |
| `archived` | No new facts mention this entity for >30 days | Cron or dream pipeline detection |
| `revived` | Archived entity reappears in new facts | New fact linking to archived entity |

### Tasks

- [ ] Add `entities.status TEXT DEFAULT 'active'` column to schema (if not present from earlier migration)
- [ ] Add `entities.schedule_archived_at` column: `TEXT` (ISO timestamp, nullable) — when to archive if no facts appear
- [ ] Add `archive_stale_entities(store: MemoryDB, days_threshold: int = 30)` to `graph.py`:
  - Query for entities with `last_fact_for_entity > days_threshold` (cross-ref via `fact_entities`)
  - Set `status = 'archived'`
  - Log to `audit_log`
- [ ] Add `revive_entity(store: MemoryDB, entity_id: str)`:
  - Set `status = 'revived'`
  - Log to `audit_log`
- [ ] Add `get_entity_status_history(entity: str)` to `EntityGraph`:
  - Query `audit_log` for status change events on this entity
  - Return ordered timeline of status transitions
- [ ] Integrate `archive_stale_entities()` into the dream pipeline (end of Stage 9, after writes)
- [ ] Modify PageRank to optionally exclude `archived` entities (`exclude_archived=True` default)
- [ ] Add unit tests:
  - `test_entities_default_status_active` — new entity inserted with status='active'
  - `test_archive_stale_marks_correct_entities` — 60-day stale entity gets archived
  - `test_revive_on_new_fact` — archived entity re-linked → status = 'revived'
  - `test_page_rank_excludes_archived_by_default` — archived entity excluded from top-k

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G3.4-AC1 | New entity inserted with `status='active'` | Query fresh entity row | unit |
| G3.4-AC2 | Entity with no new facts for 30+ days archived on `archive_stale_entities()` call | Unit test with mock clock or date threshold | unit |
| G3.4-AC3 | Archived entity linked to new fact → status = 'revived' | Unit test | unit |
| G3.4-AC4 | `page_rank(exclude_archived=True)` excludes archived entities | Unit test | unit |
| G3.4-AC5 | `page_rank(exclude_archived=False)` includes archived with low score | Unit test | unit |
| G3.4-AC6 | `get_entity_status_history()` returns sorted list of (timestamp, old_status, new_status) | Unit test | unit |

### Definition of Done

Entity lifecycle states tracked. Archive detection runs on dream completion. Revive on new fact link. PageRank respects status.

---

## Epic G3 — Definition of Done

All four stories complete. All acceptance criteria pass.

## Quality Gate

1. ✅ **`pytest tests/smoke/ -v`** — all collected tests pass (exit 0)
2. ✅ **`pytest tests/unit/ -v --tb=short`** — all collected tests pass
3. ✅ **Coverage:** new modules ≥ **80%** branch coverage (`--cov-report=term-missing` on all graph/visualize/entity.py)
4. ✅ **Type check:** `python -m mypy hermes_memory_core/graph/` — no new errors
5. ✅ **Lint:** `ruff check hermes_memory_core/` — exit 0
6. ✅ **`pytest tests/integration/ -v`** — all collected tests pass

**Gate test (manual verification):**
```bash
# 1. Smoke
pytest tests/smoke/ -v

# 2. Unit + coverage
pytest tests/unit/ --cov=hermes_memory_core.graph --cov-report=term-missing --cov-fail-under=80

# 3. Type check
python -m mypy hermes_memory_core/graph/

# 4. Lint
ruff check hermes_memory_core/

# 5. Integration
pytest tests/integration/ -v

# 6. Run dream with entity relations
python -m hermes_memory_core.dream worker --scope recent
sqlite3 ~/.hermes/memory/index/memory.sqlite \
  "SELECT source_entity_id, target_entity_id, relation_type FROM entity_relations LIMIT 5"

# 7. Generate graph visualization
python -m hermes_memory_core.graph.visualize \
  --center-entity hermes-agent --depth 2 \
  --output ~/.hermes/memory/graphs/test-ego-graph.html
ls -lh ~/.hermes/memory/graphs/test-ego-graph.html

# 8. Verify D3 renders in browser
open ~/.hermes/memory/graphs/test-ego-graph.html

# 9. Check entity lifecycle
sqlite3 ~/.hermes/memory/index/memory.sqlite \
  "SELECT name, status FROM entities LIMIT 5"
```

---

## Dependencies

| Story | Blocked by |
|---|---|
| G3.1 LLM-extracted relations | G1.5 (entity extraction must be wired) + G2.1 (EntityGraph) |
| G3.2 Temporal reasoning | G3.1 (audit log must track entity updates) |
| G3.3 Graph visualization | G2.1 (EntityGraph) |
| G3.4 Entity lifecycle | G3.2 (temporal edges use same audit log mechanism) |

*Beware: G3.2 and G3.4 can begin as soon as G3.1 starts emitting audit log events. G3.3 is independent of G3.1/G3.2 and can start as soon as G2.1 is done.*
