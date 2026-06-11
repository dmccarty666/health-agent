# Plan — Dummy Project

## Phase 1 — Foundation

Stories must be completed before Phase 2 begins.

### T-001: Project Scaffold
**Size:** XS  
**Summary:** Create the initial package layout, config loader, and test infrastructure.

**Acceptance Criteria:**
- Given a fresh clone, when `pytest tests/` is run, then no errors are raised
- Given the package is imported, when `import src` succeeds, then all modules load

### T-002: Basic Feature
**Size:** S  
**Summary:** Implement a simple `greet(name)` function that returns `"Hello, {name}!"`.

**Acceptance Criteria:**
- Given `greet("Alice")` is called, then it returns `"Hello, Alice!"`
- Given `greet("")` is called, then it returns `"Hello, !"`
- Given a non-string is passed, then it raises `TypeError`

---

## Phase 2 — Extension

Phase 2 cannot start until T-PHASE1-GATE is approved.

### T-003: Advanced Feature
**Size:** M  
**Summary:** Extend `greet` to support a `salutation` parameter.

**Acceptance Criteria:**
- Given `greet("Bob", salutation="Yo")` is called, then it returns `"Yo, Bob!"`
- Given `greet("Bob")` with no salutation, then it returns `"Hello, Bob!"`
- Given `greet("Bob", salutation=123)` is called, then it raises `TypeError`

### T-004: Integration Tests
**Size:** S  
**Summary:** Add end-to-end tests that exercise the full call stack.

**Acceptance Criteria:**
- Given the full stack is exercised, when tests run, then all pass
- Given no services are mocked, when tests run against real code, then they pass

---

## §5 Acceptance Test Scenarios

**Scenario A:** `greet("World")` → `"Hello, World!"`  
**Scenario B:** `greet("X", salutation="Yo")` → `"Yo, X!"`  
**Scenario C:** Full stack integration tests green