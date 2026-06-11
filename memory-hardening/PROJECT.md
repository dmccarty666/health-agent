# Hermes Local Memory — Hardening & Enhancement

**Status:** Active  
**Started:** 2026-05-24  
**Owner:** David McCarty  

---

## Context

A full audit of the hermes-local memory pipeline (plugins/memory/hermes-local/, hermes_memory_core/) identified 12 defensive gaps and 7 feature enhancement opportunities. This project captures all of them as tracked work.

---

## Scope

### In Scope
- All code under `hermes_memory_core/` (store, search, indexer, embed, dream, write)
- `plugins/memory/hermes-local/` (provider, tools, narrative, prefetch)
- SQLite schema and WAL mode enforcement
- Embedding client (LMSClient) robustness
- Hybrid search scoring and response schemas
- Thread-safety and concurrency correctness
- Backup verification logic

### Out of Scope
- OpenClaw qdrant-memory (separate system)
- Honcho/mem0/third-party plugins (not in use)
- Frontend React changes (dashboard docs already done 2026-05-24)

---

## Background

The memory pipeline was built across 5 phases (Phase 1–5). It handles:
1. **Capture** — lossless turn sync to SQLite + JSONL
2. **Index** — async chunking + embedding → Qdrant
3. **Dream** — nightly LLM extraction of facts/decisions/questions from raw turns
4. **Retrieve** — hybrid FTS5 + Qdrant + Jaccard + HRR search
5. **Ingest** — daily memory summaries written to `~/.hermes/memories/YYYY-MM-DD.md`

Yesterday's session (2026-05-24) hardened the dreamer pipeline (SIGPIPE guard, 45-min watchdog, connection error retry). This project addresses everything else found in the audit.

---

## Key Files Under Review

```
hermes_memory_core/store/sqlite.py       — MemoryStore singleton, WAL, schema init
hermes_memory_core/store/sqlite.py       — _compute_centrality_boost (search/hybrid.py call)
hermes_memory_core/search/hybrid.py      — scoring, PageRank cache, dedup, weight redistribution
hermes_memory_core/indexer.py           — batch_index, Qdrant upsert, claim/update cycle
hermes_memory_core/embed/__init__.py    — LMSClient, embed_batch length validation
hermes_memory_core/write/pipeline.py    — write_memory, redaction, audit
plugins/memory/hermes-local/__init__.py — provider, sync_turn thread-safety
plugins/memory/hermes-local/tools.py     — memory_query response schema normalization
plugins/memory/hermes-local/prefetch.py — prefetch, indexed turn filtering
hermes_memory_core/store/backup.py      — WAL verification, backup CLI
```

---

## Success Criteria

- No silent data corruption under concurrent write load
- WAL mode verified at runtime (not just declared)
- Hybrid query response schemas are mode-consistent
- embed_batch raises on length mismatch (no silent wrong vectors)
- All 12 defensive items resolved
- All 7 feature enhancements scoped and optionally implemented