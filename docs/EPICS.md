# Health Agent — Epics

**Version:** 0.1
**Date:** 2026-05-29
**Status:** Proposed
**Parent:** PROJECT.md, docs/prd.md, docs/TDD.md

---

**Epic Overview**

| Phase | Epic | Doc | Scope | Est. Stories |
|-------|------|-----|-------|-------------|
| **G0** | Hume Body Pod Dashboard | `docs/G0_HUME_DASHBOARD.md` | Hume sync infra, FastAPI backend, dashboard shell, Body tab with Overview/Body Map/Trends sub-tabs. 6 stories for tmux subagents. | 6 |
| **G1** | Health Data Hub | `docs/G1_DATA_HUB.md` | User profile, DB schema, manual data entry, Hume sync, ChatGPT supplement import, full workout CRUD, basic dashboard, Hermes chat | 8 |
| **G2** | Intelligence Layer | `docs/G2_INTELLIGENCE.md` | Trend detection, scores, correlations, lab explanations, weekly review | 5 |
| **G3** | Automation & Integrations | `docs/G3_AUTOMATION.md` | Blood work PDF ingestion (years backlog), Apple Health, DNA parser (partial + full genome), nutrition/strength import, automated recommendations | 5 |
| **G4** | Protocol Engine | `docs/G4_PROTOCOLS.md` | Goal-based protocols, supplement optimizer, periodization, physician reports | 4 |

## Quality Standard

All epics reference `docs/QUALITY.md` and `docs/STYLE-GUIDE.md` for shared quality gates:

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
G0 (Hume Dashboard) ──► G1 (Data Hub) ──► G2 (Intelligence) ──► G3 (Automation) ──► G4 (Protocols)
```

G0 is unblocked and produces the first visible deliverable. G1 extends with remaining data sources.
