# Epic G3 — Automation & Integrations

**Phase:** G3
**Doc Version:** 0.1
**Date:** 2026-05-29
**Status:** Proposed
**Parent:** docs/EPICS.md
**Quality Standard:** docs/QUALITY.md
**Prerequisite:** Epic G2 complete
**Est. Stories:** 5

---

## Scope

Apple Health / HealthKit data import, lab report PDF parsing, DNA raw data file parsing, nutrition app import (Cronometer/MyFitnessPal), strength app import (Strong/Hevy), and automated Hermes recommendations.

---

## Story G3.1 — Lab Report PDF Parser

**Points:** 4 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.3

**What:** Accept uploaded lab report PDFs, extract marker names, values, units, and reference ranges. Support common lab report formats (LabCorp, Quest, etc.). Manual review/confirmation before saving.

**Tasks:**
- [ ] Build PDF upload endpoint with file validation
- [ ] Implement PDF text extraction (pymupdf or pdfplumber)
- [ ] Parse marker name + value + unit + reference range from extracted text
- [ ] Build review/confirmation UI — show parsed results, let user edit before saving
- [ ] Handle multi-page reports and table-format results
- [ ] Support common lab report layouts

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G3.1-AC1 | PDF upload accepted and text extracted | integration |
| G3.1-AC2 | Common markers (CBC, CMP, lipids, hormones) correctly parsed | integration |
| G3.1-AC3 | Parsed results shown for review before saving | smoke |
| G3.1-AC4 | User can edit parsed values before confirming | smoke |
| G3.1-AC5 | Unparseable markers flagged for manual entry | integration |
| G3.1-AC6 | Multi-page reports handled correctly | integration |

**Definition of Done:** User can upload a lab PDF, review extracted markers, edit as needed, and save to database. Common lab formats work reliably.

---

## Story G3.2 — DNA Raw Data Parser

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.2

**What:** Parse 23andMe and AncestryDNA raw data files. Extract relevant health/trait markers (not full genome). Map to known interpretations. Store as context layer, not deterministic predictions.

**Tasks:**
- [ ] Build DNA file upload endpoint
- [ ] Implement 23andMe raw data parser (tab-separated, rsid + genotype format)
- [ ] Implement AncestryDNA raw data parser
- [ ] Filter to health-relevant markers only (methylation, vitamin metabolism, recovery, etc.)
- [ ] Build marker interpretation lookup (static knowledge base)
- [ ] Display DNA panel on Labs tab — context layer, not predictions

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G3.2-AC1 | 23andMe file parsed and health markers extracted | integration |
| G3.2-AC2 | AncestryDNA file parsed and health markers extracted | integration |
| G3.2-AC3 | Non-health markers filtered out | unit |
| G3.2-AC4 | Marker interpretations shown as context, not deterministic | smoke |
| G3.2-AC5 | DNA panel shows gene → interpretation → relevance | integration |

**Definition of Done:** DNA raw data files from 23andMe and Ancestry parse correctly. Health-relevant markers extracted with contextual interpretation.

---

## Story G3.3 — Nutrition App Import

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.6

**What:** Import diet/nutrition data from Cronometer and MyFitnessPal exports. Parse CSV or JSON export formats. Map to internal diet_log schema.

**Tasks:**
- [ ] Build file upload endpoint for nutrition exports
- [ ] Implement Cronometer CSV export parser
- [ ] Implement MyFitnessPal CSV export parser
- [ ] Map Cronometer fields → diet_log columns
- [ ] Map MyFitnessPal fields → diet_log columns
- [ ] Handle date deduplication (skip already-imported dates)
- [ ] Build import preview UI — show what will be imported

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G3.3-AC1 | Cronometer export file parsed into diet_log entries | integration |
| G3.3-AC2 | MyFitnessPal export file parsed into diet_log entries | integration |
| G3.3-AC3 | Duplicate dates skipped on re-import | unit |
| G3.3-AC4 | Import preview shows count of new entries before confirming | smoke |
| G3.3-AC5 | Failed imports show clear error messages | integration |

**Definition of Done:** User can upload nutrition exports from Cronometer and MFP, preview the import, and save to their diet log.

---

## Story G3.4 — Strength App Import

**Points:** 2 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.5

**What:** Import training data from Strong and Hevy app exports. Parse CSV format. Map to internal training_log schema.

**Tasks:**
- [ ] Build file upload endpoint for training exports
- [ ] Implement Strong CSV export parser
- [ ] Implement Hevy CSV export parser
- [ ] Map Strong/Hevy fields → training_log columns
- [ ] Handle deduplication
- [ ] Build import preview UI

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G3.3-AC1 | Strong export parsed into training_log entries | integration |
| G3.3-AC2 | Hevy export parsed into training_log entries | integration |
| G3.3-AC3 | Duplicate workouts skipped on re-import | unit |
| G3.3-AC4 | Import preview shows new entry count | smoke |

**Definition of Done:** Training data from Strong and Hevy imports correctly with deduplication.

---

## Story G3.5 — Apple Health Import + Automated Hermes Recommendations

**Points:** 4 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.8, G2.2

**What:** Import health data from Apple Health export (XML format). Parse relevant metrics (sleep, HRV, RHR, steps, workouts). Additionally, set up automated Hermes recommendations — daily insight and weekly recommendation based on trends.

**Tasks:**
- [ ] Build Apple Health XML export parser (the `export.xml` format)
- [ ] Extract sleep, HRV, resting heart rate, steps, workout data
- [ ] Map to internal data model (extend schema if needed)
- [ ] Build `GET /api/health/hermes/daily-insight` — automated daily recommendation
- [ ] Build daily insight generation using Hermes with current data context
- [ ] Schedule daily insight cron (morning)
- [ ] Add daily insight card to Today screen

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G3.5-AC1 | Apple Health export XML parsed successfully | integration |
| G3.5-AC2 | Sleep, HRV, RHR extracted and stored | integration |
| G3.5-AC3 | Daily Hermes insight generated from latest data | integration |
| G3.5-AC4 | Daily insight appears on Today screen | smoke |
| G3.5-AC5 | Insight generation handles missing data gracefully | unit |
| G3.5-AC6 | Cron job runs without errors (verified via logs) | integration |

**Definition of Done:** Apple Health data imports and enriches sleep/recovery data. Hermes generates daily insight automatically. Cron stable.

---

## Epic G3 — Definition of Done

All 5 stories complete with acceptance criteria verified. Quality gate:

1. ✅ pytest tests/smoke/ -v
2. ✅ pytest tests/unit/ -v --tb=short
3. ✅ Coverage: new modules ≥ 80% branch coverage
4. ✅ Type check: mypy backend/
5. ✅ Lint: ruff check backend/
6. ✅ pytest tests/integration/ -v
7. ✅ PDF parsing tested with 3+ real lab report formats
8. ✅ DNA parsing tested with sample 23andMe and Ancestry files
9. ✅ Nutrition/strength imports tested with real export files
10. ✅ Apple Health XML parsing tested with sample export
11. ✅ All import flows have preview → confirm → save pattern
12. ✅ Automated Hermes cron runs without errors