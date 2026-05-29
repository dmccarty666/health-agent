# Health Agent — Project Charter

**Status:** Active / Partial Implementation
**Created:** 2026-05-29
**Directory:** `~/.hermes/PROJECTS/health-agent/`
**Repo:** hermes-workspace

## Elevator Pitch

Personal Health Intelligence for Strength, Longevity, and Optimization. A unified dashboard that aggregates Hume Body Pod body composition data, bloodwork, DNA analysis, supplementation, diet, and weight training — with an embedded Hermes AI agent for personalized health coaching, trend analysis, and recommendations.

Not a fitness tracker. Not a medical app. Not a diet app. A health intelligence platform.

## Data Sources

| Source | Current State | Priority |
|--------|--------------|----------|
| Hume Body Pod scale (BLE) | Blue2Scale web app + hume-influx sync | P0 — core |
| Bloodwork / lab results | Not started | P0 — differentiator |
| DNA analysis (23andMe/Ancestry raw) | Not started | P1 |
| Supplementation tracking | Not started | P1 |
| Diet / nutrition | Not started | P1 |
| Weight training | Not started | P1 |
| Apple Health / HealthKit | Not started | P2 |
| Wearables (Oura, WHOOP, Garmin) | Not started | P3 |

## Visual North Star

**Oura** — premium, calm, dark-first, insight-over-data hierarchy.

Blended with:
- Apple Health: medical-data trust, privacy, clarity
- Function Health: labs/protocols, AI chat
- WHOOP: readiness/recovery coaching
- Cronometer: nutrition/supplement precision
- Strong/Hevy: gym logging speed
- Garmin: advanced performance analytics (drill-down only)

## AI Layer

Embedded Hermes agent for:
- Natural language health queries ("Why did my recovery drop?")
- Trend detection and correlation analysis
- Personalized protocol recommendations
- Monthly health board meeting reports
- Doctor-ready export summaries
- Decision support (NOT physician replacement)

## Methodology

**Docs-first:** PRD → TDD → Plan → adversarial critique → ADRs → SOULs → runbook → code.
One AI drafts, another critiques. For long-running phases: Hermes Kanban + specialist profiles.

## Constraints

- Local-first, self-hosted. Zero per-token inference costs where possible.
- Sensitive health data stays on-prem. No third-party cloud processing.
- Dark-first UI with optional light mode.
- Mobile-responsive web app (no native mobile required for MVP).

## MVP Phases (from ChatGPT competitive analysis)

1. **Health Data Hub:** Profile, body comp import, lab entry, supplement stack, training log, basic dashboard, Hermes chat
2. **Intelligence Layer:** Trend detection, lab explanations, supplement-to-biomarker mapping, readiness score, weekly review
3. **Automation:** Apple Health import, nutrition/strength app import, lab file parser, DNA parser, automated recommendations
4. **Full Protocol Engine:** Goal-based protocols, supplement timing optimizer, training/nutrition periodization, physician reports

## Existing Assets

- `schema.sql` — PostgreSQL schema (users, measurements, goals)
- `Blue2Scale.com/` — BLE body composition scale web app (PHP/MySQL, 39 metrics)
- `hume-influx/` — Docker service for Hume → InfluxDB sync
- `sync_hume.py` — Python sync script
