# Health Agent — Master Spec

**Version:** 0.1
**Date:** 2026-05-29
**Status:** Active
**Parent:** PROJECT.md
**Source:** ChatGPT competitive analysis + existing codebase inventory

---

## 1. Feature Definition

**What it is:** A unified personal health intelligence dashboard that aggregates body composition data (Hume Body Pod), bloodwork, DNA analysis, supplementation, diet, and weight training — with an embedded Hermes AI agent for coaching, trend analysis, and recommendations.

**What it is NOT:**
- A fitness tracker (though it can display training data)
- A medical device or diagnostic tool
- A diet app (though it tracks nutrition)
- A clone of any single competitor

## 2. Why It Matters

| Without | With |
|---------|------|
| Data scattered across 6+ apps/sources | Single unified health command center |
| No cross-source correlation | AI-powered trend detection across all streams |
| Generic supplement advice | Personalized stack tied to actual lab results |
| Guesswork on training readiness | Readiness score from sleep, HRV, body comp, blood markers |
| Blood work results sit in a PDF | Biomarker dashboard with plain-English explanations |
| Doctor visits with incomplete context | Doctor-ready export with training, diet, supplement context |

## 3. Current State Analysis

### What's Built

| Component | Location | Status |
|-----------|----------|--------|
| PostgreSQL schema | `schema.sql` | ✅ Users, measurements (39 BIA metrics), goals, device_reports |
| Blue2Scale BLE scale app | `Blue2Scale.com/` | ✅ PHP/MySQL web app, Web Bluetooth API |
| Hume → InfluxDB sync | `hume-influx/` | ✅ Docker service |
| Python sync script | `sync_hume.py` | ✅ |

### What's Missing

| Capability | Severity | Notes |
|-----------|----------|-------|
| Bloodwork/bio marker tracking | Critical | Core differentiator, nothing built |
| DNA genetic risk layer | High | 23andMe/Ancestry raw data parsing needed |
| Supplement stack management | High | No module exists |
| Diet/nutrition tracking | High | Cronometer integration or custom |
| Weight training log | High | Strong/Hevy-style tracking |
| Unified dashboard/UI | Critical | Blue2Scale covers BIA only |
| Hermes AI chat integration | Critical | Named feature, nothing built |
| Readiness/recovery scoring | Medium | Depends on multiple data streams |
| Protocol/recommendation engine | Medium | Depends on Hermes + data |
| Apple Health integration | Low | Phase 3 |
| Lab report parsing (PDF) | Medium | Phase 3 |
| Doctor-ready export | Low | Phase 4 |

## 4. Competitor Reference — What to Borrow and What to Skip

| Product | Borrow | Skip |
|---------|--------|------|
| **Oura** | Aesthetic: dark-first, large score cards, insight-over-data, calm language | Hardware tie-in, ring form factor |
| **Apple Health** | Medical data clarity, privacy controls, conservative charting, HealthKit sync | iOS lock-in, white-only theme |
| **WHOOP** | "What should I do today?" coaching framing, recovery/strain model | Subscription lock-in, hardware tie-in |
| **Garmin Connect** | Advanced performance drill-downs (behind a click, not home screen) | Dense athlete-focused UX for home screen |
| **Cronometer** | Nutrient depth, micronutrient completeness, verified foods | Visual design (utility-first, not premium) |
| **Function Health** | Lab test → protocol pipeline, AI chat backed by labs, clinical framing | Lab ordering business model, clinician review dependency |
| **InsideTracker** | DNA + blood + nutrition + supplement mapping | Blood draw service, 3rd-party lab dependency |
| **Strong/Hevy** | Fast workout logging, PR tracking, volume by muscle group | Social community features |
| **MyFitnessPal** | Food database size, barcode scanning UX | Ad-supported freemium, calorie-only focus |
| **Hume Health** | Body composition metrics, Health Score concept | App lock-in, no public API |

## 5. Top 15 Features for Our App

Based on competitive analysis, these are the feature categories we should implement:

1. **Unified Health Home / Today Screen** — Default landing with Health Score, Recovery, Body Comp delta, Workout readiness, Lab alerts, Supplement adherence, Hermes daily insight
2. **Body Composition Dashboard** — Organized by fat loss, muscle gain, hydration, visceral fat, segmental balance, trend direction, confidence
3. **Bloodwork / Biomarker Tracking** — Optimal/normal/high-risk zones, change tracking, related supplements/diet/training, Hermes plain-English explanations
4. **DNA / Genetic Risk Layer** — Context layer only, tied to observed bloodwork and behavior, never deterministic predictions alone
5. **Readiness / Recovery Score** — Multi-signal: sleep, HRV, RHR, prior load, soreness, body comp trend, caloric state, blood markers
6. **Training Load & Strength Progression** — Calendar, exercise history, sets/reps/weight, volume per muscle group, e1RM, PRs, progressive overload, recovery cost
7. **Nutrition & Macro Tracking** — Cronometer-level depth: calories, macros, fiber, sodium, potassium, magnesium, omega-3, vitamin D, iron, B12, creatine, supplement overlap
8. **Food Logging** — Barcode, meal photo, voice, repeat meals, templates, import from Cronometer/MFP (Phase 3+)
9. **Supplement Stack Management** — Current stack, dose, timing, purpose, related biomarkers, interactions, adherence, optimization flags
10. **Multi-Score System** — Body Comp Score, Metabolic Health Score, Recovery Score, Strength Progress Score, Nutrition Quality Score, Supplement Adherence Score, Longevity Risk Score, overall Health Intelligence Score
11. **Trend Analytics & Correlation Engine** — Cross-source analysis (e.g., "HRV improves when magnesium adherence is high"), foundation for Hermes recommendations
12. **Personalized Protocols** — Goal-based cards with data basis, recommendation, tracking, re-test date, confidence level, "Ask Hermes"
13. **Hermes AI Chat** — "Why did my recovery drop?", "What supplements could affect my labs?", "Build me a training week", "What changed since last blood test?", "Summarize my health this month"
14. **Data Import / Device Sync** — Apple Health → Hume → lab PDFs → Cronometer/MFP → Strong/Hevy → Oura/WHOOP/Garmin → DNA raw data → manual supplement import
15. **Reports, Alerts & Monthly Review** — Weekly review, monthly body comp report, lab change report, training progress, supplement adherence, top 3 wins/risks/actions, Hermes monthly health board meeting

## 6. UI Styleguide Direction

| Element | Recommendation |
|---------|---------------|
| Primary theme | Dark-first, optional light mode |
| Mood | Premium, calm, analytical, masculine-neutral |
| Layout | Card-based dashboard, tab-separated (not infinite scroll) |
| Corners | Large rounded cards |
| Typography | Clean sans-serif, Apple-like readability |
| Data density | Low on home, high in drill-downs |
| Color use | Semantic: green (good), amber (watch), red (action needed), blue (informational), purple (AI/Hermes) |
| Charts | Line trends, sparklines, score rings, body comp deltas |
| AI presence | Persistent advisor layer, not gimmicky chatbot bubble |
| Medical data | Apple/Function style: conservative, clear, precise |
| Performance data | WHOOP/Garmin style: readiness, load, recovery |
| Nutrition data | Cronometer style: accurate, complete, drillable |

## 7. App Information Architecture

**CRITICAL: Tab Separation Rule.** Each main tab is a SEPARATE page with its own focused, scrollable content. Do NOT build one long-scrolling page with sections, and do NOT use accordions/collapse panels to hide content. The sidebar navigation switches between entirely different views.

**Content density rule:** Each tab's scrollable content should fit within ~2–3 viewport heights. If a tab exceeds this, it needs its own sub-tabs (like Blue2Scale's Overview/Body Map pattern).

### Main Tabs

1. **Today** — Health Intelligence Score, recovery/readiness, body comp delta, workout readiness, nutrition target, supplement reminders, Hermes daily insight. *Max 4 stat cards + 2 content cards + insight card.*
2. **Body** — Weight, body fat %, lean mass, skeletal muscle, visceral fat, hydration, metabolic age. *Sub-tabs: Overview (donut + key metrics) | Body Map (segmental SVG) | Trends (line charts).*
3. **Labs** — Biomarker dashboard with optimal/normal/high-risk zones, lab history, DNA context. *Sub-tabs: Dashboard (color-zoned table) | Trends (per-marker charts) | DNA (genetic context).*
4. **Fuel** — Macros, micronutrients, supplement stack with adherence. *Sub-tabs: Diet (daily log + macro summary) | Supplements (stack + adherence calendar).*
5. **Training** — Workout calendar, exercise log, volume by muscle group, PRs. *Sub-tabs: Calendar (month view) | Log (exercise CRUD) | Progress (volume charts + PRs).*
6. **Hermes** — Chat, weekly review, recommendations, protocols. *Sub-tabs: Chat | Reports | Protocols.*

## 8. MVP Phase Plan

### Phase 1: Health Data Hub
- User profile
- Manual body composition import
- Hume data import/export workflow (extend existing)
- Bloodwork PDF/manual entry
- Supplement stack
- Weight training log (basic)
- Basic dashboard
- Hermes chat over user-entered data

### Phase 2: Intelligence Layer
- Trend detection
- Lab explanations
- Supplement-to-biomarker mapping
- Body composition trend analysis
- Workout readiness score
- Weekly review

### Phase 3: Automation / Integrations
- Apple Health import
- Nutrition app import (Cronometer/MFP)
- Strength app import (Strong/Hevy)
- Lab file parser (PDF)
- DNA raw data parser
- Automated Hermes recommendations

### Phase 4: Full Protocol Engine
- Goal-based health protocols
- Supplement timing optimizer
- Training/nutrition periodization
- Lab retest planner
- Physician-ready reports

## 9. Unique Differentiators

1. **Supplement-to-lab mapping** — "You take X. It may influence Y biomarker. Track Z."
2. **Training-to-bloodwork interpretation** — Contextualizes markers against muscle mass, creatine use, intense lifting, TRT, protein intake
3. **Body composition + strength correlation** — "Lean mass is up 2.1 lb while body fat is down 1.3%. Strength trend confirms recomposition."
4. **Hermes monthly health board meeting** — AI-generated executive report across all data streams
5. **Protocol cards** — Each recommendation tied to evidence from personal data
6. **Confidence scoring** — "Strong signal," "possible signal," "insufficient data"
7. **Doctor-ready export** — PDF summary with labs, supplements, TRT context, training load, diet patterns, questions

## 10. Verification Criteria

- [ ] All 6 main tabs accessible from a single view
- [ ] "Today" screen loads as default landing
- [ ] Body composition data flows from Hume via Blue2Scale/hume-influx
- [ ] Bloodwork can be entered manually and displays in biomarker dashboard
- [ ] Supplement stack shows interactions with lab markers
- [ ] Training log captures sets/reps/weight with volume tracking
- [ ] Hermes can answer health questions drawing from all data streams
- [ ] Dark theme is default, light theme is available
- [ ] All sensitive health data stays local, no cloud processing
