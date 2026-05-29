# Epic G2 — Intelligence Layer

**Phase:** G2
**Doc Version:** 0.1
**Date:** 2026-05-29
**Status:** Proposed
**Parent:** docs/EPICS.md
**Quality Standard:** docs/QUALITY.md
**Prerequisite:** Epic G1 complete
**Est. Stories:** 5

---

## Scope

Multi-score system, trend detection, lab explanations, supplement-to-biomarker mapping, body composition trend analysis, workout readiness score, and weekly review automation.

---

## Story G2.1 — Multi-Score System

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.3, G1.4, G1.5, G1.6

**What:** Compute and display multiple health scores: Body Composition Score, Recovery Score, Nutrition Quality Score, Supplement Adherence Score, Strength Progress Score, and a composite Health Intelligence Score. Each score is 0–100 with breakdown of contributing factors.

**Tasks:**
- [ ] Define scoring algorithms for each score type
- [ ] Build score computation service (Python)
- [ ] Create `GET /api/health/scores` endpoint — returns all scores
- [ ] Build Today screen score cards with gauges
- [ ] Add score breakdown tooltips (what contributed + or −)
- [ ] Cache scores to avoid recomputation on every load

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G2.1-AC1 | All 6 scores rendered on Today screen | smoke |
| G2.1-AC2 | Body Composition Score uses latest measurement data | integration |
| G2.1-AC3 | Supplement Adherence Score reflects last 7-day adherence rate | integration |
| G2.1-AC4 | Composite Health Intelligence Score aggregates sub-scores > 0 | unit |
| G2.1-AC5 | Score breakdown visible on click/hover | smoke |
| G2.1-AC6 | Missing data results in "insufficient data" score state, not crash | unit |

**Definition of Done:** All scores compute from live data with transparent breakdowns. Missing data handled gracefully. Scores cache for performance.

---

## Story G2.2 — Trend Detection

**Points:** 4 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.3, G1.5, G1.6, G2.1

**What:** Detect and display trends across all data streams. Compare current values against rolling averages. Highlight statistically significant changes. Show trend direction arrows (↑ improving, ↓ declining, → stable).

**Tasks:**
- [ ] Build trend computation service — 7-day, 30-day, 90-day rolling averages
- [ ] Create `GET /api/health/labs/trends?marker=X` — trend data for a marker
- [ ] Build body composition trend charts (weight, BF%, lean mass, visceral fat over time)
- [ ] Build training volume trend (weekly volume per muscle group)
- [ ] Build diet macro trend (daily calorie/protein/carb/fat trends)
- [ ] Add trend arrows and color coding (green ↑ = improving, red ↓ = declining)

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G2.2-AC1 | Lab marker trends show rolling average with direction arrow | integration |
| G2.2-AC2 | Body comp metrics trend charts render with proper time axis | smoke |
| G2.2-AC3 | Training volume trends group by muscle group and week | integration |
| G2.2-AC4 | Diet macro trends display daily values + 7-day rolling average | integration |
| G2.2-AC5 | Trend direction correctly identifies improving/declining/stable | unit |
| G2.2-AC6 | < 3 data points shows "need more data" instead of trend line | unit |

**Definition of Done:** All data streams have trend visualization with rolling averages and direction indicators. Small datasets handled gracefully.

---

## Story G2.3 — Lab Explanations

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.3, G1.8

**What:** Plain-English explanations of lab markers. What each marker means, why it matters, what optimal range is, and what factors influence it (diet, supplements, training, genetics). Powered by a knowledge base + Hermes for complex explanations.

**Tasks:**
- [ ] Build lab marker knowledge base (static explanations for common markers)
- [ ] Add "Explain" button on each lab marker in Labs tab
- [ ] Static explanation: what it is, why it matters, optimal range, influencing factors
- [ ] Hermes-enhanced: ask follow-up questions about specific marker
- [ ] Show related supplements and diet factors from user's actual data

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G2.3-AC1 | Clicking "Explain" on a marker shows plain-English description | smoke |
| G2.3-AC2 | Explanation includes optimal range context | integration |
| G2.3-AC3 | Related supplements from user's stack shown | integration |
| G2.3-AC4 | Related diet factors from user's data shown | integration |
| G2.3-AC5 | "Ask Hermes" button opens chat with pre-filled marker context | smoke |
| G2.3-AC6 | Unknown markers show Hermes-generated explanation | integration |

**Definition of Done:** Every lab marker has an explainable plain-English view. User's actual supplement and diet data is cross-referenced. Hermes available for deeper questions.

---

## Story G2.4 — Supplement-to-Biomarker Mapping

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.3, G1.4, G2.3

**What:** Map user's supplements to biomarkers they may influence. When viewing a lab marker, show which supplements could affect it. When viewing a supplement, show which markers it may influence. Alert on potential interactions.

**Tasks:**
- [ ] Build supplement-marker mapping database (static knowledge)
- [ ] Create correlation display — "You take X, it may influence Y marker"
- [ ] Add supplement influence panel on Labs tab (per marker)
- [ ] Add biomarker impact panel on Fuel tab (per supplement)
- [ ] Flag potential interactions (e.g., supplements competing for absorption)

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G2.4-AC1 | Lab marker detail shows related supplements from user's stack | integration |
| G2.4-AC2 | Supplement detail shows biomarkers it may influence | integration |
| G2.4-AC3 | Mapping is bidirectional and consistent | unit |
| G2.4-AC4 | No false mappings (verification against known supplement science) | unit |

**Definition of Done:** User can see supplement ↔ biomarker relationships in both directions. Knowledge base covers common supplements and markers.

---

## Story G2.5 — Workout Readiness Score + Weekly Review

**Points:** 4 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.5, G2.1, G2.2

**What:** Compute daily workout readiness score from multiple signals: sleep quality, recent training load, body comp trend, caloric state, and manual check-in (soreness, mood, energy). Generate automated weekly review summary.

**Tasks:**
- [ ] Build readiness score algorithm (weighted multi-signal)
- [ ] Add manual check-in form (soreness 1–10, mood, energy, sleep quality)
- [ ] Create `GET /api/health/readiness` — readiness score + breakdown
- [ ] Build readiness card on Today screen
- [ ] Add training recommendation: push / maintain / deload / recover
- [ ] Build weekly review generator — aggregates all streams, produces summary
- [ ] Create `GET /api/health/weekly-review` endpoint
- [ ] Add weekly review card on Hermes tab
- [ ] Schedule weekly review cron job (Monday 8am)

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G2.5-AC1 | Readiness score computes from all available signals | integration |
| G2.5-AC2 | Manual check-in saves and contributes to readiness | integration |
| G2.5-AC3 | Training recommendation (push/maintain/deload/recover) shown | smoke |
| G2.5-AC4 | Weekly review includes body comp delta, lab changes, training volume, supplement adherence, diet summary | integration |
| G2.5-AC5 | Weekly review cron generates without errors | integration |
| G2.5-AC6 | Missing signals degrade score gracefully (not crash) | unit |

**Definition of Done:** Daily readiness score with actionable training recommendation. Weekly review automated and accessible. Manual check-in available as additional signal.

---

## Epic G2 — Definition of Done

All 5 stories complete with acceptance criteria verified. Quality gate:

1. ✅ pytest tests/smoke/ -v
2. ✅ pytest tests/unit/ -v --tb=short
3. ✅ Coverage: new modules ≥ 80% branch coverage
4. ✅ Type check: mypy backend/
5. ✅ Lint: ruff check backend/
6. ✅ pytest tests/integration/ -v
7. ✅ Scores compute correctly on edge cases (0 data, 1 data point, all data)
8. ✅ Trend detection validated with known test datasets
9. ✅ Weekly review cron runs and produces output without errors