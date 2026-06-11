# Epic G2 — Graph Query Operations

**Phase:** G2  
**Doc Version:** 0.1  
**Date:** 2026-05-23  
**Status:** Proposed  
**Parent:** `docs/GRAPH_MEMORY.md`  
**Quality Standard:** `docs/GRAPH_QUALITY.md` — all stories inherit coverage floors, pytest infra, and type/lint requirements from this doc  
**Prerequisite:** Epic G1 complete (entities + fact_entities populated)  
**Est. Lines:** 250–400

---

## Epic Summary

Build the graph-query layer on top of the EntityGraph: PageRank centrality, BFS path queries, ego-neighborhood queries, and graph-enhanced contradiction traversal. This makes the graph *queriable* — not just stored but actively useful in retrieval and reasoning.

---

## Story G2.1 — EntityGraph Class (NetworkX Wrapper)

**Story points:** 8  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G1.5

### What

Build `hermes_memory_core/graph/__init__.py` with an `EntityGraph` class that wraps NetworkX. The class reads from SQLite and constructs a bipartite fact-entity graph, then provides entity-projection queries.

### Class Interface

```python
from hermes_memory_core.graph import EntityGraph

class EntityGraph:
    """In-memory entity graph backed by SQLite data."""

    def __init__(self, store: MemoryDB): ...

    # Build graph from current store state
    def build(self) -> nx.DiGraph:
        """Build bipartite fact-entity + entity-entity graph.
        Returns a NetworkX DiGraph with 'entity' and 'fact' node types
        and edges representing relationships."""
        ...

    # Centrality
    def page_rank(self, top_k: int = 20) -> List[Tuple[str, float]]:
        """Return top-k entities by PageRank score."""
        ...

    def betweenness_centrality(self, top_k: int = 20) -> List[Tuple[str, float]]:
        """Return top-k entities by betweenness centrality."""
        ...

    # Traversal
    def find_path(self, source: str, target: str, max_depth: int = 4) -> List[str]:
        """BFS shortest path from source entity name to target entity name.
        Returns list of entity names in path, or [] if no path found."""
        ...

    def ego_neighbors(self, entity: str, depth: int = 1) -> List[str]:
        """Return all entity names within `depth` hops of `entity`.
        Uses directed edges from entity."""
        ...

    # Fact access
    def entity_facts(self, entity: str) -> List[Dict[str, Any]]:
        """Return all facts linked to this entity."""
        ...

    def entity_relations(self, entity: str) -> List[Dict[str, Any]]:
        """Return all `entity_relations` rows for this entity (as source or target)."""
        ...

    # Derived scores
    def entity_importance(self) -> Dict[str, float]:
        """Return dict of entity_name -> importance score (PageRank normalized)."""
        ...
```

### Graph Construction Logic

```
SQLite data
  └─ facts ← fact_entities ← entities
        └─ entity_relations (entity→entity edges)

build() constructs:
  1. 'entity' nodes from entities.name
  2. 'fact' nodes from facts.fact_id
  3. Bipartite edges: entity ←→ fact (via fact_entities join)
  4. Directed entity→entity edges: reading entity_relations rows
  5. Edge attributes: weight=1.0 default, confidence from entity_relations.confidence
```

### Tasks

- [ ] Create `hermes_memory_core/graph/__init__.py`
- [ ] Add `EntityGraph.__init__(store: MemoryDB)` — stores reference, lazy `build()`
- [ ] Add `_ensure_built()` guard — calls `build()` if `_graph` is None
- [ ] Add `build()` — reads store, constructs `nx.DiGraph`, caches at `self._graph`
- [ ] Add `page_rank(top_k)` — runs `nx.pagerank()`, returns named entities with scores
- [ ] Add `betweenness_centrality(top_k)` — runs `nx.betweenness_centrality()`
- [ ] Add `find_path(source, target, max_depth)` — `nx.shortest_path()` with directed edges
- [ ] Add `ego_neighbors(entity, depth)` — `nx.ego_graph()` + extract entity names
- [ ] Add `entity_facts(entity)` — query SQLite for all facts linked to this entity
- [ ] Add `entity_relations(entity)` — query `entity_relations` for this entity
- [ ] Add `entity_importance()` — normalized PageRank dict
- [ ] Add `health_check()` — verify store is populated, raise if `entities` table is empty
- [ ] Add unit tests:
  - `test_build_produces_nodes_and_edges` — graph has entity + fact nodes, at least one edge
  - `test_page_rank_returns_named_entities` — top results include entities from store
  - `test_find_path_returns_list_or_empty` — path found or empty, no exception
  - `test_ego_neighbors_depth_1` — direct neighbors only
  - `test_entity_facts_returns_list` — returns facts linked to entity
  - `test_health_check_raises_on_empty` — raises when entities table empty
- [ ] Add dependency to `requirements.txt` if `networkx` not already present

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G2.1-AC1 | `EntityGraph(store).build()` returns `nx.DiGraph` with ≥2 nodes of type `'entity'` | `isinstance(graph, nx.DiGraph)` + node type check | unit |
| G2.1-AC2 | `page_rank()` returns list of (entity_name, score) tuples, sorted desc by score | Unit test assertion | unit |
| G2.1-AC3 | `find_path("A", "B")` returns list of entity names or empty list | Unit test | unit |
| G2.1-AC4 | `ego_neighbors("hermes-agent", depth=1)` returns only directly connected entities | Unit test count | unit |
| G2.1-AC5 | `entity_facts("Qwen")` returns ≥0 facts from the store | DB integration test | integration |
| G2.1-AC6 | Running on empty store raises `RuntimeError("store has no entities")` | Unit test | unit |
| G2.1-AC7 | Graph rebuilds correctly after new facts inserted (call `build()` twice) | Unit test | unit |

### Definition of Done

`EntityGraph` class exists with all specified methods. All unit tests pass. `networkx` imported successfully.

---

## Story G2.2 — Contradiction Graph Traversal

**Story points:** 5  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G2.1

### What

Extend `hermes_memory_core/dream/contradict.py` to use the `EntityGraph` for contradiction detection. Currently `find_conflicts()` uses a bucket-based heuristic by `(project, entity, category)`. Graph traversal adds:

1. **Cross-entity contradiction**: Facts about "Qwen" and "Spark" may contradict through entity→entity edge `runs_on` or `used_by` — if one fact says "Qwen runs on Spark2" and another says "Qwen does NOT run on Spark2", traversing the `runs_on` edge should flag them.
2. **Ego-graph contradiction**: When checking entity X, also check all entities within `depth=1` of X in the entity graph.

### Changes to `contradict.py`

```python
# New import
from hermes_memory_core.graph import EntityGraph

# New function
def extend_with_graph_conflicts(
    candidates: List[CandidateFact],
    store: MemoryDB,
    graph: EntityGraph,
) -> List[Conflict]:
    """For each candidate, traverse entity graph to find related entities
    that may harbor contradictions. Adds to the bucket-based conflicts list."""
    additional_conflicts = []
    for candidate in candidates:
        entity_name = candidate.entity
        if not entity_name:
            continue
        # Get entities within 1 hop
        neighbors = graph.ego_neighbors(entity_name, depth=1)
        for neighbor in neighbors:
            # Get facts about the neighboring entity
            neighbor_facts = graph.entity_facts(neighbor)
            for nf in neighbor_facts:
                # Check for text-level contradiction with candidate
                if text_contradicts(candidate.text, nf.fact_text):
                    additional_conflicts.append(Conflict(...))
    return additional_conflicts

# New helper
def text_contradicts(text_a: str, text_b: str) -> bool:
    """Simple negation detection: 'X runs on Y' vs 'X does not run on Y'."""
    ...
```

### Tasks

- [ ] Add `text_contradicts(text_a, text_b) -> bool` helper to `contradict.py`:
  - Tokenize: strip punctuation, lowercase
  - Negation words: "not", "never", "no longer", "doesn't", "does not", "isn't", "won't", "can't"
  - If `text_a` has negation and `text_b` doesn't (or vice versa), share ≥2 content words → potential contradiction
- [ ] Add `extend_with_graph_conflicts(candidates, store, graph)` function
- [ ] Modify `find_conflicts()` to accept optional `graph: EntityGraph` kwarg — if passed, call `extend_with_graph_conflicts()` and merge
- [ ] Modify `find_conflicts()` call sites in `worker.py` to pass the graph instance
- [ ] Add `_graph: EntityGraph | None = None` field to `DreamRunner`
- [ ] Add unit tests:
  - `test_text_contradicts_affirmative_vs_negated` — "runs" vs "does not run" returns True
  - `test_text_contradicts_no_common_words` — no false positives on unrelated texts
  - `test_graph_extends_beyond_bucket` — graph conflict found for related entity beyond bucket
  - `test_graph_merge_with_bucket_conflicts` — both graph and bucket conflicts returned

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G2.2-AC1 | `text_contradicts("Qwen runs on Spark2", "Qwen does not run on Spark2")` returns True | Unit test | unit |
| G2.2-AC2 | `text_contradicts("Qwen uses Spark2", "Spark2 is fast")` returns False (no negation) | Unit test | unit |
| G2.2-AC3 | Graph conflict detected for entities with `related_to` edge | Unit test with synthetic graph | unit |
| G2.2-AC4 | `find_conflicts(candidates, graph=g)` includes both bucket + graph conflicts | Unit test | unit |
| G2.2-AC5 | `find_conflicts(candidates)` without graph arg behaves as before (backwards compat) | Unit test regression | unit |
| G2.2-AC6 | `worker.py` dream run returns graph-detected conflicts in report | Integration test | integration |

### Definition of Done

`contradict.py` uses graph traversal. Negation detection works. Graph conflicts merge with bucket conflicts. All tests pass.

---

## Story G2.3 — Entity Importance in Retrieval

**Story points:** 3  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G2.1

### What

Use `EntityGraph.page_rank()` entity importance scores as a retrieval boost in hybrid search. Entities with higher PageRank (more connected, more central) produce facts that rank higher in recall.

Integration point: `hermes_memory_core/search/hybrid.py` — after scoring from FTS + Qdrant + Jaccard + HRR, add a `graph_boost` factor:

```python
# In hybrid.py scoring
entity_graph = EntityGraph(store)
entity_scores = entity_graph.entity_importance()  # entity_name → PageRank 0-1

for result in results:
    # Get entities linked to this result's chunk
    chunk_entities = store.get_entities_for_chunk(result.chunk_id)
    if chunk_entities:
        avg_entity_score = mean(entity_scores[e] for e in chunk_entities if e in entity_scores)
        result.score += 0.10 * avg_entity_score  # 10% graph weight
```

### Tasks

- [ ] Add `entity_importance()` dict to `EntityGraph` (returns entity_name → normalized PageRank)
- [ ] Add `get_entities_for_chunk(store, chunk_id) -> List[str]` helper to `hybrid.py` or `graph.py`
- [ ] Modify `hybrid.py` `score_and_rank()` to accept optional `entity_graph: EntityGraph`
- [ ] Apply graph boost in scoring when entity graph is available
- [ ] Add `GRAPH_BOOST_WEIGHT = 0.10` constant (exposed for tests)
- [ ] Add regression test: without entity graph, results unchanged
- [ ] Add unit test: with entity graph, high-centrality entity results score higher than low-centrality

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G2.3-AC1 | `hybrid_query()` returns results but scores differ when entity graph is active | Unit test score diff | unit |
| G2.3-AC2 | Results containing high-centrality entities scored higher than same content from low-centrality | Unit test | unit |
| G2.3-AC3 | Without entity graph, result scores identical to baseline | Unit test regression | unit |
| G2.3-AC4 | `GRAPH_BOOST_WEIGHT` constant exposed at module level for override | Import test | unit |

### Definition of Done

Retrieval scores incorporate entity centrality. Regression test passes. Configurable boost weight.

---

## Story G2.4 — Path Query Tool

**Story points:** 3  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G2.1

### What

New `memory_query` mode: `graph_path`. Accepts `source_entity` and `target_entity` and returns the shortest entity path between them via BFS traversal.

### Tool Interface (MemoryQuery mode)

```python
@tool
def memory_query(query: str, mode: str = "hybrid",
                 source_entity: str | None = None,
                 target_entity: str | None = None,
                 max_path_depth: int = 4) -> dict:
    """
    mode='graph_path': find entity-to-entity path
      source_entity: starting entity name
      target_entity: ending entity name
      max_path_depth: max hops (default 4)
    """
```

### Return Shape

```json
{
  "mode": "graph_path",
  "source_entity": "Qwen",
  "target_entity": "Spark2",
  "path": ["Qwen", "runs_on", "Spark2"],
  "path_length": 2,
  "path_type": "direct",
  "entities_found": 3,
  "metadata": {
    "relation_types": ["runs_on"]
  }
}
```

### Tasks

- [ ] Add `graph.py` to `hermes_memory_core/tools.py` or a new `memory_tools.py` module
- [ ] Register `memory_query` with new mode branch `'graph_path'`
- [ ] Implement `mode='graph_path'` handler:
  - Build entity graph
  - Call `graph.find_path(source, target, max_depth)`
  - For each hop, resolve relation type from `entity_relations`
  - Format response
- [ ] Add error case: no path exists → return `{"path": [], "path_type": "disconnected"}`
- [ ] Add error case: entity not found → return clear error message
- [ ] Add unit tests:
  - `test_graph_path_direct` — path exists, returns step list
  - `test_graph_path_no_connection` — returns empty path + disconnected type
  - `test_graph_path_max_depth` — early exit at max_depth
- [ ] Add integration test: `memory_query(mode='graph_path', source_entity='Qwen', target_entity='Spark2')`

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G2.4-AC1 | `graph_path` mode calls `EntityGraph.find_path()` correctly | Unit mock test | unit |
| G2.4-AC2 | Existing path returns non-empty `path` array | DB integration | integration |
| G2.4-AC3 | No path returns `{"path": [], "path_type": "disconnected"}` | Unit test | unit |
| G2.4-AC4 | `source_entity` not in store returns error (not exception) | Unit test | unit |
| G2.4-AC5 | `max_path_depth` respected | Unit test mock | unit |

### Definition of Done

Path query tool registered and returns correct path or disconnected status. Unit and integration tests pass.

---

## Story G2.5 — Ego-Graph Neighborhood Query

**Story points:** 3  
**Owner:** hm-developer  
**Status:** Proposed  
**Prerequisite:** G2.1

### What

New `memory_query` mode: `graph_neighborhood`. Returns all entities within N hops of a target entity.

### Tool Interface

```python
@tool
def memory_query(query: str, mode: str = "hybrid",
                 entity: str | None = None,
                 depth: int = 1) -> dict:
    """
    mode='graph_neighborhood': ego-graph query
      entity: center entity name
      depth: hop radius (default 1, max 3)
    """
```

### Return Shape

```json
{
  "mode": "graph_neighborhood",
  "center_entity": "hermes-agent",
  "depth": 2,
  "entities": [
    {"name": "Qwen", "distance": 1, "facts_count": 7},
    {"name": "Spark2", "distance": 2, "facts_count": 3},
    {"name": "kanban", "distance": 1, "facts_count": 2}
  ],
  "total_entities": 3,
  "total_facts": 12
}
```

### Tasks

- [ ] Register `mode='graph_neighborhood'` handler in `memory_query`
- [ ] Implement `graph.py` handler:
  - Build entity graph
  - `graph.ego_neighbors(entity, depth)` → list of neighbor entity names
  - `graph.entity_facts(name)` → fact counts per neighbor
  - Format response with distances and fact counts
- [ ] Add depth cap at 3 (warn on > 3, cap without error)
- [ ] Add unit tests:
  - `test_ego_depth_1` — only directly connected returned
  - `test_ego_depth_2` — entities at depth 2 included
  - `test_ego_empty_center` — center entity with no neighbors returns empty list
- [ ] Add integration test against live store

### Acceptance Criteria

| # | Criterion | Test | | Quality tier |
|---|---|---|---:
| G2.5-AC1 | `graph_neighborhood` with depth=1 returns only immediate neighbors | Unit test | unit |
| G2.5-AC2 | Each returned entity includes `distance` and `facts_count` | Unit test | unit |
| G2.5-AC3 | Empty center entity returns `{"entities": [], "total_entities": 0}` | Unit test | unit |
| G2.5-AC4 | Depth > 3 capped without error (logged warning) | Unit test + log check | unit |
| G2.5-AC5 | Fact count reflects all facts linked to each neighbor entity | DB integration | integration |

### Definition of Done

Ego-graph query tool registered and returns neighborhood with distances and fact counts. All tests pass.

---

## Epic G2 — Definition of Done

All five stories complete. All acceptance criteria pass.

## Quality Gate

1. ✅ **`pytest tests/smoke/ -v`** — all collected tests pass (exit 0)
2. ✅ **`pytest tests/unit/ -v --tb=short`** — all collected tests pass
3. ✅ **Coverage:** new module `hermes_memory_core/graph/` ≥ **80%** branch coverage (`--cov-report=term-missing`)
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

# 6. Build entity graph
python -c "
from hermes_memory_core.graph import EntityGraph
from hermes_memory_core.store.sqlite import get_memory_store
g = EntityGraph(get_memory_store())
g.build()
print('Nodes:', g._graph.number_of_nodes())
print('Edges:', g._graph.number_of_edges())
print('PageRank top 5:', g.page_rank(5))
"

# 7. Path query
hermes-cli memory query --mode graph_path --source Qwen --target Spark2

# 8. Ego query
hermes-cli memory query --mode graph_neighborhood --entity hermes-agent --depth 2
```

---

## Dependencies

| Story | Blocked by |
|---|---|
| G2.1 EntityGraph class | G1.5 (entities + fact_entities must be populated) |
| G2.2 Contradiction traversal | G2.1 |
| G2.3 Entity importance retrieval | G2.1 |
| G2.4 Path query tool | G2.1 |
| G2.5 Ego-graph query | G2.1 |

*G2.1 is the critical path. G2.2–G2.5 can all proceed in parallel after G2.1 is done.*
