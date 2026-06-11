# Graph Memory — Code Quality Standards

**Doc Version:** 0.1  
**Date:** 2026-05-23  
**Status:** Proposed  
**Parent:** `docs/GRAPH_MEMORY.md`  
**Applies to:** Epic G1, G2, G3

---

## 1. Purpose

 Every story in Graph Memory (G1/G2/G3) ships code. This document defines:

1. What "tests pass" means — concretely
2. Coverage floors
3. Type-check and lint requirements  
4. How smoke / unit / integration tests are divided
5. The shared pytest infrastructure that all stories depend on

Do not write a story's Definition of Done without using this document as a reference. Every Epic-level DoD includes the **Epic Quality Gate** (§7). Every story-level AC includes the **Quality tier** it belongs to.

---

## 2. Test Taxonomy

| Tier | Purpose | Runs against | Mocked | Execution speed |
|---|---|---|---|---|
| **Smoke** | Fatal errors only — import, interface, schema | Real Python imports | No | < 5 s |
| **Unit** | Logic correctness per function / class | Real Python objects | DB/NN/LLM mocked | < 30 s |
| **Integration** | End-to-end with real SQLite | Real `memory.sqlite` (temp file, scoped) | No | < 5 min |

**Rule:** A story must pass **all three tiers** before its story-level DoD is met. Smoke precedes unit; integration runs last. If smoke fails, halt — don't run unit tests.

---

## 3. pytest Infrastructure

### 3.1 Config (`pyproject.toml` or `pytest.ini`)

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = [
    "-v",
    "--tb=short",
    "--ignore=tests/integration/test_live_*.py",  # opt-in via env
]
filterwarnings = [
    "error",                         # warnings → failures
    "ignore::DeprecationWarning",
]

[tool.coverage.run]
branch = true
source = ["hermes_memory_core"]
omit = [
    "*/tests/*",
    "*/migrations/*",
    "hermes_memory_core/dream/prompts/*",
]

[tool.coverage.report]
fail_under = 80
show_missing = true
skip_low = true

[tool.mypy]
python_version = "3.11"
strict = false
warn_return_any = true
warn_unused_ignores = true
ignore_missing_imports = true
```

### 3.2 Shared Fixtures (`tests/conftest.py`)

Every test needs SQLite and MemoryDB fixtures. `conftest.py` is the **single source of truth** for test infrastructure. Stories must not re-implement fixtures.

```python
# tests/conftest.py — required fixtures
import pytest, sqlite3, tempfile, os
from hermes_memory_core.store.sqlite import MemoryDB

@pytest.fixture
def temp_sqlite_path():
    """Temp SQLite path, cleaned up after test."""
    fd, path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    yield path
    os.unlink(path) if os.path.exists(path) else None

@pytest.fixture
def fresh_db(temp_sqlite_path):
    """MemoryDB on temp SQLite, schema initialized."""
    db = MemoryDB(db_path=temp_sqlite_path)
    db._ensure_init_full_schema()
    return db

@pytest.fixture
def seeded_db(fresh_db):
    """fresh_db with a small known dataset for query tests."""
    # Insert 3 facts, 2 entities, 1 relation for repeatable query tests
    ...

@pytest.fixture
def entity_graph_fresh(temp_sqlite_path):
    """EntityGraph backed by a fresh empty store for graph tests."""
    db = MemoryDB(db_path=temp_sqlite_path)
    db._ensure_init_full_schema()
    from hermes_memory_core.graph import EntityGraph
    return EntityGraph(db)

@pytest.fixture
def mock_llm(monkeypatch):
    """Patches LLM calls to return controlled JSON."""
    ...

@pytest.fixture
def mock_spacy(monkeypatch):
    """Patches spaCy to return a controlled Doc with known entities."""
    ...
```

### 3.3 Test File Naming Convention

```
tests/
  conftest.py                    ← fixtures only, no tests
  smoke/
    test_imports.py              ← smoke: can the module load?
    test_schema.py               ← smoke: does schema init succeed?
  unit/
    test_entity.py               ← unit: entity extraction logic
    test_contradict.py            ← unit: negation detection
    test_memorydb_upsert.py       ← unit: DB write operations
    test_memorydb_query.py        ← unit: DB query operations
    test_upsert_entity_relation.py
  integration/
    test_dream_pipeline.py       ← integration: full dream run
    test_backpopulate.py         ← integration: migration
    test_entity_graph_full.py     ← integration: EntityGraph + real data
```

### 3.4 Execution Commands

```bash
# Smoke only (fast — CI first-step)
pytest tests/smoke/ -v

# Unit tests only
pytest tests/unit/ -v

# Integration tests (opt-in — real DB, slower)
pytest tests/integration/ -v

# All tests + coverage
pytest tests/ --cov=hermes_memory_core --cov-report=term-missing

# Coverage floor check (fails below threshold)
pytest tests/unit/ --cov=hermes_memory_core --cov-fail-under=80
```

---

## 4. Coverage Floors

| Code type | Floor | Rationale |
|---|---|---|
| New modules (`hermes_memory_core/graph/`, `hermes_memory_core/dream/entity.py`) | **≥ 80%** branch coverage | Graph ops and entity extraction are new — must be well-covered |
| Modified modules (existing `sqlite.py`, `contradict.py`) | **≥ 70%** branch coverage | Don't break what already works |
| Schema migrations + CLI scripts | **0%** (documented, manual verification OK) | Scripts run once; manual verification accepted |
| Prompt templates (`dream/prompts/*.md`) | N/A | Not code |

**Measuring:** `pytest --cov=hermes_memory_core --cov-report=term-missing`. Missing lines shown explicitly — developer must justify any `<80%` line with a `// pragma: no cover` comment + inline explanation or an override in `pyproject.toml`.

---

## 5. Type Checking

**Tool:** `python -m mypy hermes_memory_core/`

| Rule | Why |
|---|---|
| New modules: strict-ish (`warn_return_any`, `warn_unused_ignores`) | Entity extraction and graph classes are new surface area — type soundness matters |
| Existing modules: ignored unless modified | Don't retrofit types into 10k lines of unrelated code in this feature |
| `tests/`: ignored | Test code can use `Any` |
| `# type: ignore` allowed only with reason | Blanket ignores are prohibited; specific line ignores must cite the exception |

---

## 6. Lint

**Tool:** `ruff check hermes_memory_core/`

| Rule | Setting |
|---|---|
| `E`, `F` (errors, Pyflakes) | Error — CI fails |
| `W` (warnings) | Warn — CI fails |
| `I` (import order) | Enabled |
| `N` (naming convention) | Warn only |
| `UP` (pyupgrade) | Warn only |
| `B` (flake8-bugbear) | Warn only |

**No formatter** (black) — preserve existing style for modified lines. If formatter needed later, separate PR.

---

## 7. Epic Quality Gate (mandatory — every Epic-level DoD includes this)

The Epic-level Definition of Done includes a **standardized quality checklist**:

```
## Epic [G1/G2/G3] — Definition of Done

[Story-level DoD blocks …]

## Quality Gate

All tiers pass before the Epic is done:

1. ✅  Smoke tests: `pytest tests/smoke/ -v` — all collected tests pass (exit 0)
2. ✅  Unit tests: `pytest tests/unit/ -v --tb=short` — all collected tests pass
3. ✅  Coverage: new modules ≤ 80% branch coverage (shown in `cov-report`)
4. ✅  Type check: `python -m mypy hermes_memory_core/graph/` — no new errors
5. ✅  Lint: `ruff check hermes_memory_core/` — exit 0
6. ✅  Integration tests: `pytest tests/integration/ -v` — all collected tests pass
7. ✅  `conftest.py` exists in `tests/` with all required fixtures (§3.2)
```

Stories that add new modules are responsible for:
- Adding that module to `source` in `pyproject.toml` coverage config
- Writing smoke + unit tests for the new module
- Keeping coverage above floor

---

## 8. Story DoD Template (for reference)

Every story's DoD block should look like:

```
### [Story X.Y] — Definition of Done

**Quality tier:** unit  

**Acceptance Criteria:**  
| # | Criterion | Quality tie |
|---|---|---|
| AC1 | … | Smoke |
| AC2 | … | Unit |
| AC3 | … | Integration |

**Definition of Done:**  
All acceptance criteria pass. Smoke → unit → integration sequence succeeds. Coverage on new module ≥ 80%.

**Code written:**  
- `hermes_memory_core/path/to/file.py` — [description]
- `tests/unit/test_file.py` — [test names]
```

---

## 9. Defect Handling

| Severity | Definition | Response |
|---|---|---|
| **Bug** | AC fails; logic is wrong | Fix in same story; add regression test |
| **Chore** | Fixture broken; conftest missing | Fix before next story; assign to same epic |
| **Tech debt** | Ruff/mypy violation from pre-existing code | Log in `graphs/TECH_DEBT.md`, fix in cleanup PR |
| **Critical gap** | Schema assumption violated mid-story | Halt; re-assess story scope |

---

*Document status: Proposed — cross-reference from Epic G1, G2, G3 story DoD blocks.*
*Next action: G1.1 creates `conftest.py` + `pyproject.toml` as its first action item.*
