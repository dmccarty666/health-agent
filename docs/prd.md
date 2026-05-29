# Health Agent — Product Requirements Document

**Version:** 0.1
**Date:** 2026-05-29
**Status:** Proposed
**Parent:** PROJECT.md, docs/HEALTH_APP_SPEC.md

---

## Product Vision

A self-hosted personal health intelligence platform that aggregates all of David's health data streams (body composition, bloodwork, DNA, supplements, diet, training) into a unified dashboard with an embedded Hermes AI agent for coaching, trend analysis, and actionable recommendations.

## Target User

**Primary:** David McCarty — health-optimizing individual tracking body composition, bloodwork, supplementation, diet, and strength training.
**Future:** Power users who want self-hosted health data aggregation with AI coaching.

## Functional Requirements

### FR1: Health Data Hub

| ID | Requirement | Priority |
|----|------------|----------|
| FR1.1 | User profile with sex, age, height, weight, activity level | P0 |
| FR1.2 | Body composition import from Hume Body Pod (via Blue2Scale/hume-influx) | P0 |
| FR1.3 | Bloodwork/lab entry — manual input with date, marker name, value, unit, reference range | P0 |
| FR1.4 | Supplement stack — name, dose, timing, purpose, adherence tracking | P1 |
| FR1.5 | Weight training log — exercise, sets, reps, weight, date | P1 |
| FR1.6 | Diet/nutrition — calories, macros, key micronutrients | P1 |
| FR1.7 | DNA genetic context — raw data upload with marker/risk mapping | P2 |
| FR1.8 | Apple Health / HealthKit data import | P3 |

### FR2: Unified Dashboard

| ID | Requirement | Priority |
|----|------------|----------|
| FR2.1 | "Today" home screen — Health Intelligence Score, recovery, body comp delta, workout readiness, lab alerts, supplement reminders, Hermes insight | P0 |
| FR2.2 | Body tab — weight, BF%, lean mass, skeletal muscle, visceral fat, hydration, metabolic age, trend graphs | P0 |
| FR2.3 | Labs tab — biomarker dashboard with optimal/normal/high-risk zones, history, Hermes explanations | P0 |
| FR2.4 | Fuel tab — macros, micronutrients, supplement stack with adherence, diet-lab correlations | P1 |
| FR2.5 | Training tab — schedule, workout log, volume by muscle group, progressive overload, PRs, recovery cost | P1 |
| FR2.6 | Hermes tab — AI chat interface for health queries | P0 |

### FR3: Intelligence Layer

| ID | Requirement | Priority |
|----|------------|----------|
| FR3.1 | Trend detection across all data streams | P1 |
| FR3.2 | Lab result explanations in plain English | P1 |
| FR3.3 | Supplement-to-biomarker mapping ("You take X, it may influence Y") | P1 |
| FR3.4 | Body composition trend analysis with deltas | P1 |
| FR3.5 | Workout readiness score — multi-signal (sleep, HRV, RHR, prior load, body comp, caloric state) | P1 |
| FR3.6 | Weekly health review — automated summary of changes and recommendations | P1 |

### FR4: Hermes AI Agent

| ID | Requirement | Priority |
|----|------------|----------|
| FR4.1 | Natural language chat over all health data | P0 |
| FR4.2 | Context-aware health queries ("Why did my recovery drop?") | P0 |
| FR4.3 | Training week builder based on readiness | P1 |
| FR4.4 | Monthly health board meeting — AI-generated executive report | P1 |
| FR4.5 | Protocol recommendations with confidence scoring | P2 |
| FR4.6 | Doctor-ready PDF export with context (labs, supplements, training, diet) | P2 |

### FR5: Data Privacy & Security

| ID | Requirement | Priority |
|----|------------|----------|
| FR5.1 | All health data stored locally, no third-party cloud processing | P0 |
| FR5.2 | Authentication required for dashboard access | P0 |
| FR5.3 | Data export in standard formats (CSV, JSON) | P1 |
| FR5.4 | Account deletion with all data removal | P1 |
| FR5.5 | HTTPS for all web access | P0 |

## Non-Functional Requirements

### NFR1: Performance
- Dashboard home screen loads in <2 seconds
- Lab history queries return in <500ms
- Hermes chat responses in <5 seconds for simple queries, <30 seconds for complex analysis

### NFR2: UI/UX
- Dark-first theme with optional light mode
- Card-based layout with large rounded corners
- Semantic color system: green (good), amber (watch), red (action), blue (info), purple (AI/Hermes)
- Mobile-responsive (primary use: desktop, secondary: tablet/phone)
- Insight-over-data hierarchy — interpretation first, raw numbers second

### NFR3: Reliability
- Body composition sync from Hume runs on cron (configurable interval)
- All user-entered data persisted to PostgreSQL immediately
- Hermes agent available when data is present

### NFR4: Maintainability
- PostgreSQL schema versioned and migratable
- Python backend with type hints
- Frontend in vanilla HTML/CSS/JS or lightweight framework
- All code under version control (hermes-workspace repo)

## Out of Scope (MVP)

- Native iOS/Android apps (mobile web only for MVP)
- Real-time wearable sync (batch import only for MVP)
- Social/sharing features
- Multi-user support
- Third-party API integrations beyond data import
- Telehealth or clinician review
- Medical certification (not a medical device)
- Billing/subscription (single-user self-hosted)

## Success Metrics

1. David uses the dashboard daily for health decisions
2. All 6 data streams (body comp, bloodwork, DNA, supplements, diet, training) present in one place
3. Hermes provides 3+ actionable recommendations per week
4. Bloodwork trends and supplement correlations are visible within 30 days of data entry
5. Monthly health board meeting report is generated automatically
