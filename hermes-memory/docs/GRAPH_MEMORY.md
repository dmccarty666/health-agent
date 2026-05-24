# Graph Memory — Feature Specification

**Doc Version:** 0.1  
**Date:** 2026-05-23  
**Status:** Proposed  
**Parent Epic:** Post-MVP backlog (EPICS.md §Post-MVP)

---

## 1. Feature Definition

Graph memory extends Hermes Local Memory's existing entity join table into a first-class entity graph: nodes are extracted entities (people, tools, projects, concepts), edges are typed relationships between them surfaced during dream extraction, and the graph is queryable for traversal, centrality, and contradiction reasoning.

**Not this:** A full graph database (Neo4j, Kùzu) bolted on as infrastructure. Graph work sits on top of the existing SQLite schema using pure Python (NetworkX) for the graph engine, staying entirely in-process and preserving the local-first, zero-cloud-cost principle.

**This:** An entity-extraction pipeline that populates the existing `entities` + `fact_entities` tables, a graph-query layer powered by NetworkX, and typed relationship edges added during dream extraction.

---

## 2. Why This Matters

The current system captures facts. Graph memory captures *how facts relate to each other*.

**Concrete use cases it unlocks:**

| Use Case | Without Graph | With Graph |
|---|---|---|
| "What entities are most central to my Hermes work?" | Can't rank | PageRank on entity graph |
| "Is there a contradiction about entity X by going through shared facts?" | Linear scan | Graph traversal + edge analysis |
| "How is Qwen related to Spark2?" | Manual reasoning | BFS path query |
| "What facts mention entities related to the kanban agent?" | Keyword across all facts | Ego-graph neighborhood query |
| "Which entities keep surfacing as contradictory across sessions?" | Manual | Graph edge contradictions |

The `contradict.py` heuristic already buckets by `(project, entity, category)`. Graph extraction adds the *relationship type* between entities, so contradictions can be detected by traversing entity-to-entity edges rather than just comparing text similarity.

---

## 3. Current State Analysis

### 3.1 What's Already Built (Graph Primitives)

The `hermes_memory_core/store/sqlite.py` schema already has:

```
entities
  entity_id   INTEGER PRIMARY KEY AUTOINCREMENT
  name        TEXT NOT NULL
  entity_type TEXT DEFAULT 'unknown'
  aliases     TEXT DEFAULT ''
  created_at  TEXT NOT NULL

fact_entities
  fact_id   TEXT REFERENCES facts(fact_id)
  entity_id  INTEGER REFERENCES entities(entity_id)
  PRIMARY KEY (fact_id, entity_id)

decisions
  decision_id, decision_text, rationale, project, ...
  (cross-linked to facts via related_fact_ids_json)

open_questions
  question_id, question_text, project, priority, ...
  (cross-linked to facts via source_refs_json)

audit_log
  (all memory mutations timestamped with actor)
```

The `walk_memory_core/dream/contradict.py` already has:
- Bucket-based contradiction heuristic by `(project, entity, category)`
- `find_conflicts(candidates, existing)` + `mark_disputed()` that sets fact status to `disputed`
- `Conflict` dataclass with subject, conflicting assertion, existing fact, and explanation

### 3.2 Schema Fragmentation (Critical Gap)

**`MemoryStore` vs `MemoryDB` use different schemas.**

`MemoryStore._SCHEMA_SQL` (line 33–265 of `store/sqlite.py`):
- `fact_entities(fact_id TEXT, entity_id INTEGER)` — TEXT FK to facts, INTEGER FK to entities
- `entities(entity_id INTEGER, name TEXT, entity_type TEXT, aliases TEXT, created_at TEXT)`
- No `project`, `alias_json`, or `updated_at` on entities
- No `role` column on `fact_entities`

`MemoryDB._FULL_SCHEMA_MEMORY_DB` (line 868–913):
- `fact_entities(fact_id TEXT, entity_id TEXT, role TEXT)` — TEXT PKs throughout, role column added
- `entities(entity_id TEXT, name TEXT, alias_json TEXT, entity_type TEXT, project TEXT, created_at TEXT, updated_at TEXT)`
- `alias_json` and `updated_at` present
- `role` column on the join table

**Before any graph work proceeds, the two schemas must be unified.** The `MemoryDB` schema is the more complete one — graph work should extend `MemoryDB`'s schema and the resolution is to make `MemoryStore` migrate to match `MemoryDB` (or consolidate to one class).

### 3.3 What's Missing (The Actual Gaps)

| Gap | Severity | Detail |
|---|---|---|
| `entities` table never populated | 🔴 Critical | Schema exists, zero rows inserted |
| `fact_entities` table never populated | 🔴 Critical | Join table empty |
| No entity extraction from fact text | 🔴 Critical | No spaCy NER, no noun-phrase extraction |
| `fact_entities.role` column missing in MemoryStore | 🟡 Medium | Join table has no relationship role |
| `entity_relations` table missing entirely | 🟡 Medium | No entity→entity edges |
| No graph query operations | 🟡 Medium | No path traversal, PageRank, centrality |
| Dual-schema issue | 🔴 Critical | MemoryStore vs MemoryDB differ |
| Alias resolution not implemented | 🟡 Medium | Same entity stored under multiple names |

---

## 4. Reference: What Mem0 Does

The most directly applicable OSS reference is `mem0ai/mem0` (56.5k stars, MIT license).

**Key files to reference:**
- `mem0/utils/entity_extraction.py` — SpaCy NER + quoted string extraction + regexp patterns
- `mem0/memory/main.py` — `Memory.add()` + `Memory.search()` with entity scoping
- `mem0/configs/prompts.py` — extraction prompts

**What Mem0 does (and we should replicate):**

1. SpaCy `en_core_web_sm` model for NER — extracts `PERSON`, `ORG`, `GPE`, `PRODUCT`, `EVENT`, `LAW`, `WORK_OF_ART`, `FACILITY`
2. Quoted string extraction via regexp — "mentioned as" entities
3. Noun compound extraction via spaCy noun chunks
4. Alias grouping — multiple surface forms canonicalized to one entity
5. Entity-scoped filtering in search — `user_id`/`agent_id`/`run_id` as scope filters
6. Embedding-based similarity for entity deduplication (can use existing Qdrant)

**What Mem0 does that we should NOT replicate:**
- Hosted platform API calls (we stay local)
- Chroma/Pinecone/Weaviate cloud vector stores (we use Qdrant)
- External API key auth (we use local LM Studio)

---

## 5. Phased Implementation Plan

### Phase G1 — Schema Unification + Entity Extraction Skeleton

**Goal:** Get `entities` and `fact_entities` populating, validate the join table works.

**Tasks:**

G1.1 Unify `MemoryStore` and `MemoryDB` schemas  
Choose one canonical schema. Decision: extend `MemoryStore` to match `MemoryDB`'s column set (add `alias_json`, `updated_at` to entities, add `role` to fact_entities, make all PKs TEXT). Write a migration script to alter existing dbs.

G1.2 Add `fact_entities.role` column  
`ALTER TABLE fact_entities ADD COLUMN role TEXT DEFAULT 'mentioned'` — role ∈ `{subject, object, mentioned, contradictory}`. Needed for typed queries.

G1.3 Add `entity_relations` table  
```sql
CREATE TABLE entity_relations (
  relation_id    TEXT PRIMARY KEY,
  source_entity_id TEXT REFERENCES entities(entity_id),
  target_entity_id TEXT REFERENCES entities(entity_id),
  relation_type   TEXT NOT NULL,  -- 'subproject_of', 'used_by', 'depends_on', 'competitor_of', 'related_to'
  source_ref      TEXT,
  confidence      REAL DEFAULT 0.5,
  created_at      TEXT NOT NULL,
  UNIQUE(source_entity_id, target_entity_id, relation_type)
);
CREATE INDEX idx_relations_source ON entity_relations(source_entity_id);
CREATE INDEX idx_relations_target ON entity_relations(target_entity_id);
CREATE INDEX idx_relations_type  ON entity_relations(relation_type);
```

G1.4 Port Mem0 entity extraction  
Copy and adapt `mem0/utils/entity_extraction.py` — spaCy-based NER + quoted strings + noun chunks + regexp patterns (emails, URLs, version strings, currencies, dates). Returns a list of `ExtractedEntity(name, type, aliases, confidence)`.

G1.5 Wire entity extraction into dream pipeline  
During Stage 4 (extract_facts), after facts are extracted from session text, run entity extraction on each fact. Upsert entities to `entities` table, insert to `fact_entities` with role='mentioned'.

G1.6 Write back-population migration  
Run entity extraction over all existing facts in the store. Populate `entities` + `fact_entities` for historical data too.

**Done when:** `entities` table has rows, `fact_entities` join table is populated for new dream extractions, existing facts are back-populated.

---

### Phase G2 — Graph Query Operations

**Goal:** Make the graph useful — traversal, centrality, path queries.

**Tasks:**

G2.1 Build `EntityGraph` class (NetworkX wrapper)  
```python
class EntityGraph:
    def __init__(self, store: MemoryDB): ...
    def build(self) -> nx.DiGraph  # fact-entity bipartite → entity-projection
    def page_rank(self, top_k: int = 20) -> List[Tuple[str, float]]
    def find_path(self, source: str, target: str, max_depth: int = 4) -> List[str]
    def ego_neighbors(self, entity: str, depth: int = 1) -> List[str]
    def entity_facts(self, entity: str) -> List[Dict]
```

G2.2 Contradiction graph traversal  
Extend `contradict.py` — when `find_conflicts` buckets by (project, entity, category), also traverse `entity_relations` edges to find cross-entity contradictions. E.g., facts about "Qwen" and facts about "Spark" should be checked for relation type `used_by` or `runs_on`.

G2.3 Entity importance in retrieval  
Compute PageRank on the entity graph and use entity centrality scores as a retrieval boost — facts about high-centrality entities rank higher.

G2.4 Path query tool  
New `memory_query(mode='graph_path', source_entity='Qwen', target_entity='Spark2')` — returns the entity path between two entities via BFS traversal.

G2.5 Ego-graph neighborhood query  
New `memory_query(mode='graph_neighborhood', entity='hermes-agent', depth=2)` — returns all entities within N hops of the target entity.

**Done when:** PageRank returns ranked entities, path query finds connections between entities, neighborhood query returns ego-graph, retrieval benefits from centrality weighting.

---

### Phase G3 — Typed Relationships + Advanced Reasoning

**Goal:** Rich relationship types, temporal reasoning, visualization.

**Tasks:**

G3.1 LLM-extracted entity→entity relations  
During dream pipeline Stage 4 (extract_facts), add Stage 4b: for each extracted fact, call LLM to identify entity-to-entity relationships implied by the fact text. Insert to `entity_relations`.

G3.2 Temporal graph reasoning  
Use `audit_log` timestamps to build temporal edges — when an entity's `entity_type` or `aliases` changed, add a `evolved_from` / `renamed_to` temporal edge. Enables "how has entity X evolved?" queries.

G3.3 Graph visualization  
Read entity graph → export JSON → D3.js force-directed visualization. Can be a static HTML file generated on demand (`memory graph visualize --entity=hermes-agent`).

G3.4 Entity status lifecycle  
Track entity lifecycle: `active → archived → revived`. Use audit log to detect when an entity stops appearing in new facts vs. being superseded.

**Done when:** `entity_relations` table is populated by LLM extraction, temporal queries work, graph vis is generateable.

---

## 6. Effort Estimates

| Phase | Tasks | Est. Lines | Risk |依赖 |
|---|---|---|---|---|
| G1: Schema + Extraction | G1.1–G1.6 | 400–600 | Medium | Dual-schema resolution first |
| G2: Graph Ops | G2.1–G2.5 | 250–400 | Low | G1 must be complete |
| G3: Typed Relations | G3.1–G3.4 | 400–500 | Medium | G1+G2 |

**Total: ~1,050–1,500 lines across 3 phases**

---

## 7. Dependencies & Prerequisites

- **spaCy** `en_core_web_sm` model — `python -m spacy download en_core_web_sm`
- **NetworkX** — `pip install networkx`
- **Dual-schema resolution** — must be done before G1.3 (entity_relations table) to avoid schema drift compounding
- **Qwen3.6-35B** at port 1234 — already used by dream pipeline; entity relation extraction (G3.1) also uses it

---

## 8. What to Steal from OSS

| From | What | How |
|---|---|---|
| `mem0ai/mem0` | Entity extraction (`mem0/utils/entity_extraction.py`) | MIT licensed, port to `hermes_memory_core/dream/entity.py` |
| `mem0ai/mem0` | Entity-scoped filtering pattern | Add `entity_id` filter column to retrieval query paths |
| `mem0ai/openmemory` | Docker-compose memory server + graph vis | Reference for future dashboard work, NOT for Phase G1 |
| NetworkX docs | Graph algorithms (PageRank, BFS, ego_graph) | All available via `nx pagerank()`, `nx.shortest_path()` |
| `hermes_memory_core/dream/contradict.py` | Existing contradiction detection | Extend with graph traversal overlay |

---

## 9. Out of Scope (Deferred or Explicitly Excluded)

- **Neo4j / Kùzu / ArangoDB** — separate process, JVM/heavyweight, conflicts with local-first principle
- **Cloud graph services** — AWS Neptune, Azure Cosmos Gremlin, etc.
- **Full Mem0 OSS integration** — project reference only, we port pieces not the whole thing
- **Graph database as primary store** — SQLite remains the store of record; NetworkX is a query-time projection
- **Real-time graph updates** — graph rebuilds on dream completion, not on every write

---

## 10. Verification Criteria

| Criteria | How Verified |
|---|---|
| `fact_entities` populated during dream | Run dream, query `SELECT COUNT(*) FROM fact_entities` > 0 |
| Entity extraction produces non-empty entities | Run extraction on known fact texts, check entity names |
| PageRank returns ranked entities | Compute PageRank, check named entities appear with scores |
| Path query finds connection | `find_path("Qwen", "Spark2")` returns non-empty path |
| Schema unified | `MemoryStore` and `MemoryDB` produce identical `entities` and `fact_entities` schemas |
| Back-population works | Migration script produces same row counts as live dream extraction |
| No new infrastructure processes | `ps aux | grep -E 'neo4j|kuzu|arangodb'` returns empty |

---

*Document status: Proposed — awaiting approval to add to project backlog.*
*Next action: Resolve dual-schema issue (G1.1) before any implementation begins.*
