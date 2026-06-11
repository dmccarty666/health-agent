# Memory Hardening — Task List

**Priority key:** 🔴 critical · 🟡 medium · 🟢 low · 🎯 feature

---

## Defensive Fixes

### 🔴 Critical (silent data corruption risk)

- [x] **[MEM-001]** WAL mode runtime verification  
  `hermes_memory_core/store/sqlite.py`  
  `PRAGMA journal_mode = WAL` is declared but the result is never read back. Some NFS/docker overlay filesystems silently reject WAL and fall back to rollback mode. Add: read back after setting, log error if not `"wal"`.

- [x] **[MEM-002]** MemoryStore singleton thread-safety  
  `hermes_memory_core/store/sqlite.py`  
  `get_memory_store()` returns a process-global `_singleton` with a single `_conn` used by both the indexer thread and agent tool calls concurrently. Add `threading.RLock()` around `_conn` access. Replace bare `_conn` attribute with a reentrant lock pattern.

- [x] **[MEM-003]** embed_batch response length validation  
  `hermes_memory_core/embed/__init__.py`  
  If LMS returns N embeddings for M texts where N ≠ M, the code maps by index position — extra texts silently get `[0.0]*768`. Add explicit count check and raise `EmbeddingError` on mismatch.

---

### 🟡 Medium (wrong behavior, no error raised)

- [x] **[MEM-004]** sync_turn sequence is not thread-atomic  
  `plugins/memory/hermes-local/__init__.py`  
  Two concurrent `sync_turn` calls can read the same `_turn_sequence` before either increments. Add `threading.Lock()` around the increment + turn_id construction.

- [x] **[MEM-005]** Partial batch failure leaves inconsistent index state  
  `hermes_memory_core/indexer.py`  
  When Qdrant upsert succeeds for turn A but SQLite update fails for turn B mid-batch, turn A is stuck as `"indexed"` and turn B stays `"pending"` forever. Implement claim-first-then-update-all-or-none: claim turns as a group, if any Qdrant upsert fails, roll back claims to `"pending"`.

- [ ] **[MEM-006]** `_pagerank_cache` never invalidates after new entities  
  `hermes_memory_core/search/hybrid.py`  
  Module-level `_pagerank_cache` is computed once at first call and cached for process lifetime. Dream runs that add new entities produce scores of 0.0 for those entities until restart. Add cache invalidation after entity writes, or lazily compute per-entity on first miss.

- [ ] **[MEM-007]** memory_query response schema is mode-dependent  
  `plugins/memory/hermes-local/tools.py`  
  `keyword` mode returns `{results: [{content, score}]}` but `semantic`/`hybrid` return `{results: [{content, score, kind, id, source, project, entity}]}`. Normalize all modes to a consistent `_format_hit` schema.

- [ ] **[MEM-008]** prefetch returns content from un-indexed turns  
  `plugins/memory/hermes-local/__init__.py`  
  `prefetch()` falls back to FTS5 over all turns including those with `index_status = 'pending'`. Filter to `WHERE index_status = 'indexed'` so prefetch only surfaces processed content.

---

### 🟢 Low (operational blind spots)

- [ ] **[MEM-009]** No circuit breaker on repeated indexer failures  
  `hermes_memory_core/indexer.py`  
  Indexer polls every 15 seconds indefinitely. If LMS is down, every poll hammers it. After 3 consecutive failures, back off to 5 min, then 30 min. Reset on success.

- [ ] **[MEM-010]** `_llm_complete` has no request/response logging  
  `hermes_memory_core/write/pipeline.py`  
  When the dreamer LLM fails, there is no way to replay the prompt. Add structured debug logging of request sizes and first-200-char response (no secrets).

- [ ] **[MEM-011]** `is_available()` can race with schema init  
  `plugins/memory/hermes-local/__init__.py`  
  If two processes start simultaneously and the DB file doesn't exist yet, both may attempt schema creation. Add a file-based lock sentinel (`DB_PATH.with_suffix('.lock')`) to serialize init.

---

## Feature Enhancements

### 🎯 High-Impact

- [ ] **[MEM-012]** Episodic session grouping  
  Add `sessions.episode_id` column + `episodes` table (episode_id, project, started_at, ended_at, title). Allows querying *"what were we doing in the last 3 sessions on project X"* — currently impossible with flat session list. Schema migration required.

- [ ] **[MEM-013]** Trust-score weighted retrieval  
  `hermes_memory_core/search/hybrid.py`  
  `fact_feedback` exists in the schema but no query uses `trust_score` as a ranking signal. Plug trust into `_score()`: `final_score = relevance * trust_score * freshness`. Creates a feedback loop — facts used successfully get boosted.

- [ ] **[MEM-014]** Open-question surfacing at query time  
  `plugins/memory/hermes-local/tools.py`  
  Unanswered questions in `open_questions` are invisible until explicitly queried. When a new query's semantic neighbors include an open question about the same entity, surface it under a `resolved_questions: []` note in the response with a "still open since [date]" message.

- [ ] **[MEM-015]** Automatic session synopsis on session end  
  `plugins/memory/hermes-local/__init__.py`  
  When a session ends, generate a 2-sentence synopsis (what was worked on + key decision) via a lightweight LLM call. Store in `sessions.summary`. `memory_recent_context` then shows *"In the last session: worked on X, decided Y"* — real semantic continuity vs fact counts.

- [ ] **[MEM-016]** Cross-fact dependency graph  
  `hermes_memory_core/dream/graph.py`  
  Facts extracted from the same turn are implicitly related but not linked. Add an adjacency table (`fact_links`: fact_id_a, fact_id_b, link_type). When query retrieves fact A, surface linked facts B as "related context from that work". Mirrors how you actually reason about history.

### 🧠 Deeper Capabilities

- [ ] **[MEM-017]** "What don't I know yet" mode  
  `hermes_memory_core/write/` + new query mode `"unknown"`  
  The dreamer tracks questions that arose in a session but were never answered. New mode: `memory_query(mode="unknown")` — *"what questions came up in the last 5 sessions that we never resolved?"* Enables genuine research continuity.

- [ ] **[MEM-018]** Temporal decay tuning by fact category  
  `hermes_memory_core/search/hybrid.py`  
  Flat 90-day half-life for all facts is wrong — platform config decays very slowly, project state at project pace, conversation context fast. Add `fact.decay_rate_days` column and use it in `freshness_decay()` instead of the global `half_life_days`.

- [ ] **[MEM-019]** Memory usage analytics  
  `hermes_memory_core/store/sqlite.py`  
  Add lightweight `retrieval_audit` table logging every memory query hit (returned fact_id, mode, score, session_id, timestamp). After 30 days: answer *"which facts get used most, which modes does the agent rely on, which facts were never retrieved after being written?"*

---

## Done

- ✅ **[MEM-000]** Audit completed — 12 defensive gaps + 7 feature enhancements documented  
  Project scaffold created: `~/.hermes/PROJECTS/memory-hardening/PROJECT.md` + `TASKLIST.md`  
  Session: 2026-05-24