# Health Agent — Quality Standard

**Version:** 0.1
**Date:** 2026-05-29
**Applies to:** All epics (G1–G4)

---

## Quality Gates (Every Epic)

1. ✅ `pytest tests/smoke/ -v` — smoke tests pass
2. ✅ `pytest tests/unit/ -v --tb=short` — unit tests pass
3. ✅ Coverage: new modules ≥ 80% branch coverage
4. ✅ `mypy backend/` — type check passes
5. ✅ `ruff check backend/` — lint passes
6. ✅ `pytest tests/integration/ -v` — integration tests pass
7. ✅ Frontend: no console errors, mobile-responsive at 375px

## Gate Test (Manual Verification)

```bash
# 1. Run all tests
cd ~/.hermes/PROJECTS/health-agent
python -m pytest tests/smoke/ -v
python -m pytest tests/unit/ -v --tb=short
python -m pytest tests/integration/ -v

# 2. Coverage
python -m pytest --cov=backend --cov-report=term --cov-fail-under=80

# 3. Type check
mypy backend/

# 4. Lint
ruff check backend/

# 5. Frontend check
# Open http://localhost:<port> in Chrome, check console, resize to 375px
```

## Test Organization

```
tests/
├── smoke/          # App boots, endpoints respond, DB connected
├── unit/           # Pure function tests, no DB/network
├── integration/    # DB writes, API round-trips, parsers
└── conftest.py     # Shared fixtures (test DB, client, sample data)
```

## Code Style

- Python: PEP 8, type hints on all public functions
- SQL: lowercase keywords, snake_case names, IF NOT EXISTS for migrations
- JS: ES6+, no global pollution, modules where possible
- CSS: Tailwind utility classes, semantic color variables

## Commit Convention

```
feat: add <feature>
fix: fix <bug>
docs: update <document>
test: add tests for <thing>
refactor: restructure <component>
schema: database migration for <table>
```