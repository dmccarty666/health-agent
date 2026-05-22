# Operator Runbook — Hermes Local Memory

**Project:** hermes-memory
**Last Updated:** 2026-05-21

---

## Overview

This runbook covers operational procedures for the hermes-local memory system. It is intended for operators who need to manage backups, rebuilds, dreamer operations, and health monitoring.

## Directory Layout

```
~/.hermes/memory/
├── index/
│   └── memory.sqlite          # Main SQLite database (WAL mode)
├── raw/                       # Lossless JSONL capture (year/month/day/session.jsonl)
├── qmd/                       # QMD session exports
├── dreams/                    # Dreamer reports (YYYY-MM-DD-HHMM.md)
├── daily/                     # Daily memory files (YYYY-MM-DD.md)
├── projects/                  # Per-project memory files
├── entities/                  # Entity buckets for contradiction detection
├── prompts/                   # Dreamer prompt templates
├── exports/                   # Migration reports, exports
├── backups/                   # Backup archives (hermes-memory-backup-*.tar.gz)
├── config/                    # Plugin config state
├── metrics.json               # Auto-updated metrics (turns, chunks, facts, etc.)
└── memory_block.md            # Generated memory block injected into agent turns
```

## Log Locations

| Log | Path | Description |
|---|---|---|
| Agent log | `~/.hermes/logs/agent.log` | Agent turn logs (INFO+) |
| Error log | `~/.hermes/logs/errors.log` | Error-level logs (WARNING+) |
| Gateway log | `~/.hermes/logs/gateway.log` | Gateway HTTP request logs |
| Memory metrics | `~/.hermes/memory/metrics.json` | Auto-updated metrics gauge (turns, chunks, facts, Qdrant points, dream status) |

---

## Backup Procedure

### Creating a Backup

```bash
# Create a new backup (default: ~/.hermes/memory/backups/)
hermes memory backup

# With custom memory directory
hermes memory backup --memory-dir /path/to/memory

# List existing backups
hermes memory backup --list

# Verify a specific backup against its manifest
hermes memory backup --verify ~/.hermes/memory/backups/hermes-memory-backup-2026-05-21-030000.tar.gz
```

### What Gets Backed Up

The backup archive (`hermes-memory-backup-YYYY-MM-DD-HHMMSS.tar.gz`) includes:

- SQLite database snapshot (via `sqlite3.backup()` API for consistency)
- Raw JSONL sessions (all `raw/` subdirectories)
- QMD exports
- Project memory files (`projects/`)
- Dream reports (`dreams/`)
- Prompt templates (`prompts/`)
- Entity buckets (`entities/`)
- Daily memory files (`daily/`)
- Plugin config (`config/`)
- Qdrant collection snapshots (if Qdrant is running at `localhost:6333`)

### What Is Excluded

- `logs/` — log files
- `backups/` — prevents nested backups
- `.env` — secrets
- `*.db-wal`, `*.db-shm`, `*.db-journal` — SQLite transient files
- `__pycache__/`, `.git`, `node_modules`
- `hermes-agent` repo files

### Backup Verification

Always verify backups before relying on them:

```bash
hermes memory backup --verify /path/to/backup.tar.gz
```

Output:
- `VERIFIED: filename.tar.gz` — all files match manifest
- `VERIFICATION FAILED` — lists specific hash/size mismatches

### Restoring from Backup

```bash
# 1. Copy backup to memory directory
cp /path/to/hermes-memory-backup-YYYY-MM-DD-HHMMSS.tar.gz ~/.hermes/memory/backups/

# 2. Extract (preserves directory structure)
cd ~/.hermes/memory
tar xzf backups/hermes-memory-backup-YYYY-MM-DD-HHMMSS.tar.gz

# 3. Rebuild indexes from restored data
hermes memory rebuild-indexes --force
```

---

## Rebuild Procedure

### When to Rebuild

Use `rebuild-indexes` when:
- SQLite FTS tables are corrupted
- Qdrant collections are lost or inconsistent
- After restoring from backup
- After manual database edits

### Running a Rebuild

```bash
# Interactive (prompts for confirmation)
hermes memory rebuild-indexes

# Dry run (shows what would happen, no changes)
hermes memory rebuild-indexes --dry-run

# Skip confirmation prompt
hermes memory rebuild-indexes --force
```

### Rebuild Pipeline

The rebuild runs 5 phases:

1. **Drop FTS shadow tables** — `turns_fts`, `chunks_fts`, `facts_fts`, `decisions_fts`
2. **Delete Qdrant collections** — `hermes_memory_chunks_nomic_v15`, `hermes_memory_facts_nomic_v15`, `hermes_memory_decisions_nomic_v15`, `hermes_memory_summaries_nomic_v15`
3. **Re-scan raw JSONL** — re-inserts turns into SQLite (idempotent via content hash dedup)
4. **Re-chunk, re-embed, re-upsert Qdrant** — generates chunks from turns, embeds via LMS, upserts to Qdrant
5. **Recreate FTS shadow tables** — rebuilds full-text search indexes

### Important Notes

- Raw JSONL is **never modified** during rebuild
- The process is idempotent — re-running on the same data produces the same result
- If the embedding endpoint (LMS) is unavailable, chunks are still created but Qdrant upserts will be skipped
- The rebuild may take minutes to hours depending on the volume of raw JSONL
- Monitor progress in the output — it reports JSONL files scanned, turns inserted, chunks generated

---

## Dreamer Operations

### What the Dreamer Does

The dreamer runs nightly to process conversation sessions and extract structured memory:

1. Fetches sessions since last run (or configured scope)
2. Summarizes each session via LLM
3. Extracts facts, decisions, and open questions
4. Detects contradictions against existing memory
5. Writes new items to SQLite
6. Updates daily memory file (`~/.hermes/memories/YYYY-MM-DD.md`)
7. Updates per-project memory files
8. Writes a dream report to `dreams/`

### Default Schedule

- **Cron:** `0 3 * * *` (3:00 AM daily)
- **Scope:** `since_last` (processes sessions since the last dreamer run)
- **Model:** `qwen/qwen3.6-35b` (configurable in `config.yaml`)
- **Endpoint:** `http://192.168.2.105:1234` (LMS on Spark2)

### Configuring the Dreamer

In `~/.hermes/config.yaml`:

```yaml
memory:
  hermes-local:
    dreamer_enabled: true          # Set false to disable
    dreamer_schedule: "0 3 * * *" # Cron expression
    dreamer_scope: since_last      # session | project | since_last | all
    dreamer_model: qwen/qwen3.6-35b
    max_dreamer_input_tokens: 200000
    dreamer_contradiction_threshold: 3
```

### Manual Trigger

```bash
# Trigger dreamer manually (uses configured scope)
hermes memory dreamer
```

### Dreamer Output

Each run produces:

- **New facts** — extracted from sessions, stored in SQLite `facts` table
- **New decisions** — stored in `decisions` table
- **New open questions** — stored in `open_questions` table
- **Contradictions** — flagged between new and existing facts (stored as `status='disputed'`)
- **Dream report** — written to `~/.hermes/memory/dreams/YYYY-MM-DD-HHMM.md`
- **Daily memory file** — updated at `~/.hermes/memories/YYYY-MM-DD.md`
- **Project memory files** — updated under `~/.hermes/memory/projects/`
- **Metrics** — updated in `~/.hermes/memory/metrics.json`

### Checking Dreamer Status

```bash
# Check metrics for last dream run
cat ~/.hermes/memory/metrics.json | grep -E "last_dream"

# List recent dream reports
ls -t ~/.hermes/memory/dreams/ | head -10

# Read the latest dream report
cat ~/.hermes/memory/dreams/$(ls -t ~/.hermes/memory/dreams/ | head -1)
```

### Dreamer Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Dreamer doesn't run | Cron not installed/enabled | Check `systemctl list-timers | grep hermes` |
| Dreamer fails with LLM error | LMS endpoint down or model unavailable | Verify `curl http://192.168.2.105:1234/models` |
| Dreamer fails with SQLite error | Database corruption | Run `hermes memory rebuild-indexes` |
| Dreamer produces no output | `dreamer_enabled: false` or `dreamer_scope` has no new sessions | Check config; run `hermes memory dreamer` manually with `--scope all` |
| Contradictions not detected | `dreamer_contradiction_threshold` too high | Lower threshold in config |

---

## Health Checks

### Quick Health Check

```bash
# Check memory provider status
hermes memory status
```

This shows:
- Provider name (should be `hermes-local`)
- Plugin status (installed/available)
- Database path and size
- Fact/decision/question counts
- Last dreamer run time and status

### Component Health

Check individual components:

```bash
# SQLite health
# Check journal mode (should be 'wal') and DB size
sqlite3 ~/.hermes/memory/index/memory.sqlite "PRAGMA journal_mode;"
sqlite3 ~/.hermes/memory/index/memory.sqlite "SELECT page_count * page_size / 1024 / 1024 AS size_mb FROM pragma_page_count(), pragma_page_size();"

# Qdrant health
curl -s http://localhost:6333/collections | python3 -m json.tool

# Embedding endpoint (LMS) health
curl -s http://192.168.2.105:1235/v1/models | python3 -m json.tool | head -20

# LLM endpoint (Qwen) health
curl -s http://192.168.2.105:1234/models | python3 -m json.tool | head -20

# Disk space
df -h ~/.hermes
```

### Gateway Health Endpoints

If the gateway is running on port 8787:

```bash
# Overall health
curl -s http://127.0.0.1:8787/health

# Detailed health (all components)
curl -s http://127.0.0.1:8787/health/detailed | python3 -m json.tool
```

### Metrics File

```bash
# View current metrics
cat ~/.hermes/memory/metrics.json
```

Metrics include:
- `captured_turns_24h` — turns captured in the last 24 hours
- `chunks_indexed_24h` — chunks indexed in the last 24 hours
- `chunks_pending` — chunks waiting to be indexed
- `facts_total` / `facts_active` — fact counts
- `qdrant_points` — total vector points
- `last_dream_run_at` / `last_dream_status` — last dream run
- `redactions_24h` — secrets redacted in the last 24 hours

---

## Migration from Holographic

### Running Migration

```bash
# Standard migration (reads from default holographic DB)
python ~/.hermes/hermes-agent/scripts/migrate_from_holographic.py

# With custom paths
python ~/.hermes/hermes-agent/scripts/migrate_from_holographic.py \
  --holo-db ~/.hermes/memory_store.db \
  --hl-db ~/.hermes/memory/index/memory.sqlite

# Dry run (shows what would be migrated)
python ~/.hermes/hermes-agent/scripts/migrate_from_holographic.py --dry-run
```

### What Migration Does

- Reads holographic `memory_store.db` read-only
- Migrates all facts with `content_hash` for idempotency
- Creates source refs: `migration:holographic#fact_id={old_id}`
- Writes a report to `~/.hermes/memory/exports/migration-holographic-{timestamp}.md`
- Re-run is safe: 0 new rows if already migrated

### Post-Migration

After migration:
1. Run `hermes memory rebuild-indexes` to rebuild FTS and Qdrant indexes
2. Verify fact counts match between old and new databases
3. Check the migration report for any warnings
4. Run `hermes memory status` to confirm facts are visible

---

## Common Failure Modes

### SQLite Corruption

**Symptoms:** `memory_query` returns errors, `hermes memory status` shows DB errors

**Fix:**
```bash
# Check for corruption
sqlite3 ~/.hermes/memory/index/memory.sqlite "PRAGMA integrity_check;"

# If corrupted, rebuild from raw JSONL
hermes memory rebuild-indexes --force
```

### Qdrant Unavailable

**Symptoms:** Semantic search returns no results, `chunks_pending` grows

**Fix:**
1. Verify Qdrant is running: `curl http://localhost:6333/`
2. Check collections: `curl http://localhost:6333/collections`
3. If Qdrant data is lost: `hermes memory rebuild-indexes --force`
4. If Qdrant is down temporarily: reads still work via keyword (FTS5) with degraded mode

### Embedding Endpoint Down

**Symptoms:** Chunks stay `pending`, semantic search degrades to keyword-only

**Fix:**
1. Verify LMS is running: `curl http://192.168.2.105:1235/v1/models`
2. Check model is loaded: `lms list`
3. If model is unloaded: `lms load <model-id>`
4. Pending chunks will be processed automatically when endpoint is available

### Memory Block Empty

**Symptoms:** Agent turns show no memory context

**Fix:**
1. Run `hermes memory init` to regenerate the memory block
2. Check facts exist: `hermes memory status` should show fact count > 0
3. Check dreamer ran: `cat ~/.hermes/memory/metrics.json | grep last_dream`
4. If facts exist but block is still empty, restart the Hermes agent

### Redaction Not Working

**Symptoms:** Secrets appear in raw JSONL or SQLite

**Fix:**
1. Check redaction is enabled in config
2. Check `metrics.json` for `redactions_24h` count
3. Check `audit_log` table: `sqlite3 ~/.hermes/memory/index/memory.sqlite "SELECT * FROM audit_log WHERE action='redact' ORDER BY timestamp DESC LIMIT 10;"`
4. Verify redaction patterns in `hermes_memory_core/write/redaction.py`

### Dreamer Stuck

**Symptoms:** `last_dream_status` shows `error`, or dreamer hasn't run in days

**Fix:**
1. Check the latest dream report: `cat ~/.hermes/memory/dreams/$(ls -t ~/.hermes/memory/dreams/ | head -1)`
2. Check LLM endpoint: `curl http://192.168.2.105:1234/models`
3. Check for pending turns: `sqlite3 ~/.hermes/memory/index/memory.sqlite "SELECT COUNT(*) FROM turns WHERE dream_status='pending';"`
4. Run manually: `hermes memory dreamer`
5. Check cron: `systemctl list-timers | grep hermes`

---

## Emergency Procedures

### Full Data Loss (SQLite + Qdrant both gone)

```bash
# 1. Verify raw JSONL is intact
ls ~/.hermes/memory/raw/

# 2. Rebuild everything from raw
hermes memory rebuild-indexes --force

# 3. Verify restoration
hermes memory status
cat ~/.hermes/memory/metrics.json
```

### Database File Lock Error

```bash
# Check for stuck processes holding the WAL
fuser ~/.hermes/memory/index/memory.sqlite

# If found, kill the process
kill <PID>

# Or wait for the process to release the lock
# SQLite WAL mode should auto-release after a few seconds
```

### Disk Space Full

```bash
# Check usage
df -h ~/.hermes

# Clean old backups (keep last 5)
ls -t ~/.hermes/memory/backups/hermes-memory-backup-*.tar.gz | tail -n +6 | xargs rm

# Clean old dream reports (keep last 30)
find ~/.hermes/memory/dreams/ -name "*.md" -mtime +30 -delete

# Check raw JSONL size
du -sh ~/.hermes/memory/raw/
```

---

## Reference

- **Plan.md:** §8 Epic 6.4, Story 6.4.1 — Documentation
- **Acceptance test suite:** See Plan.md §9 MVP Acceptance Test Suite
- **Plugin README:** `plugins/memory/hermes-local/README.md`
- **TDD.md:** Full technical specification
