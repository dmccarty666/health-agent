# Health Agent — Epics

**Version:** 0.1
**Date:** 2026-05-29
**Status:** Proposed
**Parent:** PROJECT.md, docs/prd.md, docs/TDD.md

---

## Epic Overview

| Phase | Epic | Doc | Scope | Est. Stories |
|-------|------|-----|-------|-------------|
| **G1** | Health Data Hub | `docs/G1_DATA_HUB.md` | User profile, DB schema, manual data entry, Hume sync, basic dashboard, Hermes chat | 8 |
| **G2** | Intelligence Layer | `docs/G2_INTELLIGENCE.md` | Trend detection, scores, correlations, lab explanations, weekly review | 5 |
| **G3** | Automation & Integrations | `docs/G3_AUTOMATION.md` | Apple Health, lab PDF parser, DNA parser, nutrition/strength import, automated recommendations | 5 |
| **G4** | Protocol Engine | `docs/G4_PROTOCOLS.md` | Goal-based protocols, supplement optimizer, periodization, physician reports | 4 |

## Quality Standard

All epics reference `docs/QUALITY.md` for shared quality gates:

1. ✅ pytest tests/smoke/ -v
2. ✅ pytest tests/unit/ -v --tb=short
3. ✅ Coverage: new modules ≥ 80% branch coverage
4. ✅ Type check: mypy new/module/
5. ✅ Lint: ruff check new/module/
6. ✅ pytest tests/integration/ -v
7. ✅ Frontend: no console errors, mobile-responsive
8. ✅ DB migrations tested on clean PostgreSQL

## Dependency Chain

```
G1 (Data Hub) ──────► G2 (Intelligence) ──────► G3 (Automation) ──────► G4 (Protocols)
```

G2 requires G1 data streams. G3 requires G2 intelligence layer. G4 requires G3 data breadth.
