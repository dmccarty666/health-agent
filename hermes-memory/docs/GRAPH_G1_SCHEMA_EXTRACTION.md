# Epic G1 — Schema Unification + Entity Extraction Skeleton

**Phase:** G1  
**Doc Version:** 0.1  
**Date:** 2026-05-23  
**Status:** Proposed  
**Parent:** `docs/GRAPH_MEMORY.md`  
**Quality Standard:** `docs/GRAPH_QUALITY.md` — all stories inherit coverage floors, pytest infra, and type/lint requirements from this doc  
**Prerequisite:** None (first phase)  
**Est. Lines:** 400–600

---

## Epic Summary

Unify the `MemoryStore` and `MemoryDB` schemas into a single canonical schema, then build the entity extraction pipeline that populates the `entities` and `fact_entities` tables from dream-extracted facts. This makes the graph primitive active — after G1, every dream run inserts entity rows.

---

## Story G1.1 — Resolve MemoryStore / MemoryDB Schema Fragmentation

**Story points:** 5  
**Owner:** hm-developer  
**Status:** Proposed

### What

The `MemoryStore` and `MemoryDB` classes in `hermes_memory_core/store/sqlite.py` use two different schemas for `entities` and `fact_entities`:

| Table | MemoryStore column set | MemoryDB column set |
|---|---|---|
| `entities` | `entity_id INTEGER PK`, `name TEXT`, `entity_type TEXT`, `aliases TEXT`, `created_at TEXT` | `entity_id TEXT PK`, `name TEXT`, `alias_json TEXT`, `entity_type TEXT`, `project TEXT`, `created_at TEXT`, `updated_at TEXT` |
| `fact_entities` | `(fact_id TEXT, entity_id INTEGER PK)` | `(fact_id TEXT, entity_id TEXT, role TEXT PK)` |

The `MemoryDB` schema is more complete and is the one being used by tests and the dream pipeline. `MemoryStore` (the singleton at `get_memory_store()`) is the production path used by the plugin. They must be unified before graph work proceeds.

### Approach

Consolidate to `MemoryDB`'s schema as canonical. Extend `MemoryStore._SCHEMA_SQL` to match `MemoryDB`'s column set:

1. Change `entities.entity_id` to TEXT PRIMARY KEY (.UUID)
2. Add `entities.alias_json TEXT DEFAULT '[]'`
3. Add `entities.project TEXT`
4. Add `entities.updated_at TEXT`
5. Change `fact_entities.entity_id` to TEXT (FK to entities.entity_id)
6. Add `fact_entities.role TEXT DEFAULT 'mentioned'`
7. Add `entity_relations` table (see G1.3)

Migration strategy: ALTER TABLE for existing dbs; CREATE TABLE for new dbs — all idempotent via `IF NOT EXISTS` / `TRY...CATCH`.

### Tasks

- [ ] Audit both schemas end-to-end: list every column diff between `_SCHEMA_SQL` and `_FULL_SCHEMA_MEMORY_DB`
- [ ] Write unified schema definition replacing `_SCHEMA_SQL` in `MemoryStore`
- [ ] Ensure idempotent ALTER TABLE via TRY/CATCH for each added column
- [ ] Add `entity_relations` table to `_SCHEMA_SQL`
- [ ] Verify `MemoryStore._ensure_init()` produces identical schema to `MemoryDB._ensure_init_full_schema()` for new DBs
- [ ] Write migration script: `scripts/migrate_memory_store_schema.py`
  - Reads existing `~/.hermes/memory/index/memory.sqlite`
  - Alters `entities` + `fact_entities` columns in-place
  - Adds `entity_relations` table
  - Verifies schema_version row incremented
- [ ] Run the migration against a copy of the live DB; verify row counts unchanged

### Acceptance Criteria

| # | Criterion | Test | Quality tier |
|---|---|---|---|
| G1.1-AC1 | `entities` table has columns: `entity_id TEXT PK, name TEXT, alias_json TEXT, entity_type TEXT, project TEXT, created_at TEXT, updated_at TEXT` | Schema inspection query on fresh DB | smoke |
| G1.1-AC2 | `fact_entities` table has columns: `(fact_id TEXT, entity_id TEXT, role TEXT)` with PK on all three | Schema inspection query | smoke |
| G1.1-AC3 | `entity_relations` table exists with all columns + indexes defined in GRAPH_MEMORY.md G1.3 | Schema inspection query | smoke |
| G1.1-AC4 | Existing DB migrates without data loss — row counts for `facts`, `decisions`, `open_questions`, `turns` unchanged post-migration | Diff row counts before/after | integration |
| G1.1-AC5 | Migration is idempotent — safe to re-run; existing columns not duplicated | Re-run migration script, check schema unchanged | unit |

### Definition of Done

Schema unified. All existing data preserved. `entity_relations` table created. Migration script tested against live DB copy. `pyproject.toml` + `tests/conftest.py` created. All quality tiers pass (smoke → unit → integration per `GRAPH_QUALITY.md §7`).

---

## Story G1.2 — Add fact_entities.role Column

**Story points:** 2  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G1.1

### What

Add a `role` column to `fact_entities` so the join table can carry relationship semantics, not just membership. Role values:

- `mentioned` — entity appears in fact text (default)
- `subject` — entity is the subject of the fact assertion
- `object` — entity is the object of the fact assertion
- `contradictory` — entity is flagged as contradicting another fact

### Tasks

- [ ] `ALTER TABLE fact_entities ADD COLUMN role TEXT DEFAULT 'mentioned'` (idempotent, already done in G1.1 schema unification)
- [ ] Update `upsert_fact()` in `MemoryStore` to accept `entity_role` kwarg and write role when populating join table
- [ ] Add `StorageWriter.upsert_entity_for_fact(fact_id, entity_name, entity_type, role)` method
- [ ] Add unit test: `upsert_entity_for_fact` inserts the join row with correct role
- [ ] Add unit test: duplicate `(fact_id, entity_id, role)` is rejected (IntegrityError)

### Acceptance Criteria

| # | Criterion | Test | Quality tier |
|---|---|---|---|
| G1.2-AC1 | `fact_entities.role` column exists and is populated on insert | Query `SELECT DISTINCT role FROM fact_entities` after a dream run | smoke |
| G1.2-AC2 | Default role is `mentioned` when not specified | Unit test — insert without role, check default | unit |
| G1.2-AC3 | Join row with same `(fact_id, entity_id)` but different role is allowed (different role = different assertion) | Unit test insert | unit |
| G1.2-AC4 | Join row with same `(fact_id, entity_id, role)` is rejected as duplicate | Unit test — IntegrityError on dup | unit |

### Definition of Done

Role column exists, defaults correctly, accepts explicit role values, rejects true duplicates. Unit tests pass.

---

## Story G1.3 — Add entity_relations Table

**Story points:** 3  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G1.1

### What

Add the entity-to-entity relationship table for typed cross-entity edges. This is the "typed" part of the graph — not just "which facts mention entity X" but "how is entity X related to entity Y".

### Schema

```sql
CREATE TABLE entity_relations (
  relation_id      TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL REFERENCES entities(entity_id),
  target_entity_id TEXT NOT NULL REFERENCES entities(entity_id),
  relation_type    TEXT NOT NULL,
  source_ref       TEXT,
  confidence       REAL DEFAULT 0.5,
  created_at       TEXT NOT NULL,
  UNIQUE(source_entity_id, target_entity_id, relation_type)
);
CREATE INDEX idx_relations_source ON entity_relations(source_entity_id);
CREATE INDEX idx_relations_target ON entity_relations(target_entity_id);
CREATE INDEX idx_relations_type  ON entity_relations(relation_type);
```

Relation types: `subproject_of`, `used_by`, `depends_on`, `competitor_of`, `related_to`, `evolved_from`, `renamed_to`, `runs_on`, `authored_by`, `version_of`

### Tasks

- [ ] Add `entity_relations` to `_SCHEMA_SQL` and `_FULL_SCHEMA_MEMORY_DB` (already in G1.1 unified schema)
- [ ] Add `MemoryStore.upsert_entity_relation()` method
- [ ] Add `MemoryStore.get_entity_relations(entity_id, relation_type=None)` query method
- [ ] Add unit test: `upsert_entity_relation` inserts row; dup returns existing
- [ ] Add unit test: FK constraints — inserting with non-existent `entity_id` raises IntegrityError
- [ ] Add unit test: query by `source_entity_id` returns correct edges
- [ ] Add unit test: query by `relation_type` returns correct edges

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G1.3-AC1 | `entity_relations` table exists with all defined columns and indexes | Schema inspection | smoke |
| G1.3-AC2 | `upsert_entity_relation` inserts a new relation | Unit test + DB query | unit |
| G1.3-AC3 | Duplicate `(source, target, type)` upsert returns existing without error | Unit test | unit |
| G1.3-AC4 | Inserting with non-existent entity_id raises IntegrityError | Unit test | unit |
| G1.3-AC5 | `get_entity_relations(entity_id)` returns all relations for that entity (as source OR target) | Unit test | unit |
| G1.3-AC6 | `get_entity_relations(entity_id, relation_type='used_by')` filters correctly | Unit test | unit |

### Definition of Done

Table exists, upsert works, query works, FK constraints enforced.

---

## Story G1.4 — Port Mem0 Entity Extraction

**Story points:** 8  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G1.1

### What

Adapt `mem0/utils/entity_extraction.py` (MIT license, mem0ai/mem0) into `hermes_memory_core/dream/entity.py`. This is spaCy-based NER + regexp extraction + noun-phrase chunking, returning a list of extracted entities from raw text.

### What to Port

1. **SpaCy NER** — `en_core_web_sm` model extracts: `PERSON`, `ORG`, `GPE`, `PRODUCT`, `EVENT`, `LAW`, `WORK_OF_ART`, `FACILITY`
2. **Quoted string extraction** — regexp for entities in quotes ("the Qwen model")
3. **Noun compound extraction** — spaCy noun chunks
4. **Regexp patterns** — emails, URLs, product codes (semver), currency amounts, ISO dates
5. **Alias grouping** — same entity under multiple surface forms → canonical name + aliases
6. **Deduplication** — embeddings-based similarity for entity deduplication (use existing Qdrant)

### What NOT to Port

- Mem0 API calls, platform auth, cloud vector stores, hosted endpoints
- Any code that touches `user_id`/`agent_id`/`run_id` scoping (Hermes uses `project`/`scope` instead)

### Output Interface

```python
@dataclass
class ExtractedEntity:
    name: str           # canonical name
    entity_type: str    # 'PERSON', 'ORG', 'PRODUCT', 'unknown', etc.
    aliases: List[str]  # surface form variants
    confidence: float   # 0.0–1.0
    span: Tuple[int, int]  # character offsets in source text

def extract_entities(text: str) -> List[ExtractedEntity]:
    """Extract entities from text using spaCy NER + regexp + noun chunks."""
    ...

def extract_entity_relations(text: str, entities: List[ExtractedEntity]) -> List[Tuple[str, str, str]]:
    """Given text + extracted entities, infer entity→entity→relation_type triples.
    Returns List[(source_entity, target_entity, relation_type)]."""
    ...
```

### Tasks

- [ ] Create `hermes_memory_core/dream/entity.py`
- [ ] Adapt `extract_entities()` from Mem0 — spaCy `en_core_web_sm`, NER, quoted strings, noun chunks, regexp patterns
- [ ] Add `ExtractorEntity` dataclass
- [ ] Add `extract_entities()` function with unit tests on known inputs
- [ ] Add `extract_entity_relations()` function stub (returns `[]` for G1; filled in G3.1)
- [ ] Add `entity_canonicalize(aliases: List[str]) -> str` helper for alias resolution
- [ ] Add Qdrant-based entity deduplication (reuse `hermes_memory_core/search/semantic.py` embedding client)
- [ ] Add CLI test: `python -c "from hermes_memory_core.dream.entity import extract_entities; print(extract_entities('Qwen runs on Spark2 at 192.168.2.105'))"`
- [ ] Add dependency to `hermes_memory_core/__init__.py` or `requirements.txt` if not already present

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G1.4-AC1 | `extract_entities("David works on the kanban agent")` returns ≥2 entities including PERSON/org | Unit test assertion | unit |
| G1.4-AC2 | `extract_entities("Use Qwen at 192.168.2.105 for inference")` extracts Qwen (PRODUCT) and IP address (regexp) | Unit test | unit |
| G1.4-AC3 | Extracted entities include `span` (character offsets) | Unit test - span not None | unit |
| G1.4-AC4 | Same entity under different surface forms returns canonical + aliases | Unit test | unit |
| G1.4-AC5 | No spaCy model installed → graceful error with clear message | Unit test - missing model | unit |
| G1.4-AC6 | `extract_entity_relations()` returns `[]` (stub — G3.1 will implement) | Unit test returns empty list | unit |

### Definition of Done

`entity.py` exists, `extract_entities()` returns structured `ExtractedEntity` list, entity types are set, spans are included, aliases are grouped, unit tests pass with known inputs.

---

## Story G1.5 — Wire Entity Extraction into Dream Pipeline

**Story points:** 5  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G1.4

### What

During dream pipeline Stage 4 (extract_facts), after facts are extracted from session text, run entity extraction on each fact text. Upsert extracted entities to `entities` table, then populate `fact_entities` with `role='mentioned'`.

Flow:
```
Stage 4 output: List[CandidateFact {text, scope, project, entity, confidence, source_ref}]
         ↓
  extract_entities(candidate_fact.text) → List[ExtractedEntity]
         ↓
  For each entity:
    upsert to entities(name, entity_type, alias_json) → entity_id
         ↓
  upsert to fact_entities(fact_id, entity_id, role='mentioned')
```

### Tasks

- [ ] Add `upsert_entity(store: MemoryDB, entity: ExtractedEntity) -> str` helper — upserts to `entities` table, returns `entity_id`
- [ ] Add `populate_fact_entities(store: MemoryDB, fact_id: str, entities: List[ExtractedEntity])` — batch insert to join table
- [ ] Modify `worker.py` Stage 4 (extract_facts) — after `candidates = extract_stage(...)`, call `entity_extract_and_link(candidates, store, fact_id_map)`
- [ ] Ensure idempotency: same entity extracted from multiple facts → same `entity_id` used
- [ ] Ensure `MemoryDB.upsert_fact()` returns `fact_id`, pass through to entity linking
- [ ] Write integration test: run dream on known session → query `entities` table has rows, `fact_entities` > 0
- [ ] Update dream report writer to include entity extraction stats

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G1.5-AC1 | After a dream run, `SELECT COUNT(*) FROM entities` > 0 | Integration test query | integration |
| G1.5-AC2 | After a dream run, `SELECT COUNT(*) FROM fact_entities` > 0 | Integration test query | integration |
| G1.5-AC3 | Entity extracted twice from different facts → same `entity_id` | Unit test - check dup after second run | unit |
| G1.5-AC4 | `fact_entities.role` defaults to 'mentioned' on pipeline insert | Query distinct role values | unit |
| G1.5-AC5 | Dream report includes entity extraction summary: entities added count | Manual inspection of dream report markdown | unit |

### Definition of Done

Dream pipeline populates `entities` and `fact_entities` on every run. Entity deduplication works across facts. Integration test validates.

---

## Story G1.6 — Back-Population Migration

**Story points:** 5  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G1.5

### What

Run entity extraction over all existing facts already in the database (from holographic migration or prior hermes-local runs) to populate `entities` and `fact_entities` for historical data too. Without this, the graph only covers new facts going forward.

### Tasks

- [ ] Create `scripts/backpopulate_entity_graph.py`
  - Load all facts from `facts` table
  - For each fact, call `extract_entities(fact.fact_text)`
  - Upsert entities, link to facts — same logic as G1.5 pipeline
  - Track progress in `audit_log`
  - Write report to `memory/exports/backpopulate-entity-graph-{timestamp}.md`
- [ ] Make script idempotent: track which facts already have `fact_entities` rows, skip already-linked
- [ ] Add `--dry-run` flag: report what would be done without writing
- [ ] Add `--limit N` flag: process only N facts (for testing on subset first)
- [ ] Add `--since DATE` flag: only process facts created after DATE
- [ ] Run against live DB — verify row counts
- [ ] Add test: back-population on empty `entities`/`fact_entities` produces same entity counts as G1.5 integration test

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G1.6-AC1 | `scripts/backpopulate_entity_graph.py --dry-run` reports without writing | Inspect output, check DB unchanged | unit |
| G1.6-AC2 | After back-population on live DB, `entities` table count matches entity extraction count from all facts | `SELECT COUNT(DISTINCT entity_id) FROM fact_entities` vs `SELECT COUNT(*) FROM entities` | unit |
| G1.6-AC3 | Re-running back-population is safe (idempotent — no duplicate rows) | Run again, verify row counts unchanged | unit |
| G1.6-AC4 | `--limit 10` processes exactly 10 facts | Count facts processed in report | unit |
| G1.6-AC5 | Back-population respects existing `fact_entities` rows (skips already-linked facts) | Check audit log or count | unit |

### Definition of Done

Historical facts are fully linked to entities. Script is idempotent, tested, documented in RUNBOOK.md.

---

## Epic G1 — Definition of Done

All six stories complete. All acceptance criteria pass.

## Quality Gate

1. ✅ **`pytest tests/smoke/ -v`** — all collected tests pass (exit 0)
2. ✅ **`pytest tests/unit/ -v --tb=short`** — all collected tests pass
3. ✅ **Coverage:** new modules (`hermes_memory_core/graph/`, `hermes_memory_core/dream/entity.py`) ≥ **80%** branch coverage (`--cov-report=term-missing`)
4. ✅ **Type check:** `python -m mypy hermes_memory_core/graph/`, `hermes_memory_core/dream/entity.py` — no new errors
5. ✅ **Lint:** `ruff check hermes_memory_core/` — exit 0 (E/F/W/I violations cause failure)
6. ✅ **`pytest tests/integration/ -v`** — all collected tests pass
7. ✅ `tests/conftest.py` exists with `fresh_db`, `seeded_db`, `entity_graph_fresh`, `mock_llm`, `mock_spacy` fixtures (per `GRAPH_QUALITY.md §3.2`)
8. ✅ `pyproject.toml` exists at repo root with `pytest.ini_options`, `coverage.run`, `coverage.report`, `mypy` sections

**Gate test (manual verification):**
```bash
# 1. Smoke
pytest tests/smoke/ -v

# 2. Unit + coverage
pytest tests/unit/ --cov=hermes_memory_core --cov-report=term-missing --cov-fail-under=80

# 3. Type check new modules
python -m mypy hermes_memory_core/graph/ hermes_memory_core/dream/entity.py

# 4. Lint
ruff check hermes_memory_core/

# 5. Run migration
python scripts/migrate_memory_store_schema.py

# 6. Run dream
python -m hermes_memory_core.dream worker --scope "recent"

# 7. Integration
pytest tests/integration/ -v

# 8. Verify DB
sqlite3 ~/.hermes/memory/index/memory.sqlite "SELECT COUNT(*) FROM entities"       # > 0
sqlite3 ~/.hermes/memory/index/memory.sqlite "SELECT COUNT(*) FROM fact_entities"   # > 0
sqlite3 ~/.hermes/memory/index/memory.sqlite "SELECT COUNT(*) FROM entity_relations" # = 0 (G1 join only)
```

---

## Dependencies

- G1.2 depends on G1.1 (schema must exist first)
- G1.3 depends on G1.1 (table added in schema unification)
- G1.5 depends on G1.4 (entity extraction function must exist)
- G1.6 depends on G1.5 (pipeline logic must be wired)

**G1.1 → G1.2, G1.3 can run in parallel after G1.1 resolves the schema**
