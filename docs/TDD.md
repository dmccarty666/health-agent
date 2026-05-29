# Health Agent — Technical Design Document

**Version:** 0.1
**Date:** 2026-05-29
**Status:** Proposed
**Parent:** PROJECT.md, docs/prd.md

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Web App)                     │
│  ┌─────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────────┐  │
│  │  Today  │ │ Body │ │ Labs │ │ Fuel │ │ Training  │  │
│  └─────────┘ └──────┘ └──────┘ └──────┘ └───────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │                   Hermes Chat                     │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP REST API
┌──────────────────────▼──────────────────────────────────┐
│               Python Flask/FastAPI Backend               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Users   │ │ Health   │ │ AI/Hermes│ │  Import   │  │
│  │  Auth    │ │ Data CRUD│ │ Service  │ │  Parsers  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                   PostgreSQL                             │
│  ┌────────┐ ┌──────────────┐ ┌──────┐ ┌────────────┐   │
│  │ users  │ │ measurements │ │ labs │ │ supplements│   │
│  └────────┘ └──────────────┘ └──────┘ └────────────┘   │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐               │
│  │diet_logs │ │train_logs │ │ protocols│               │
│  └──────────┘ └───────────┘ └──────────┘               │
└─────────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Local Hermes Agent (API)                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Health context injection → Qwen3.6-35B (Spark2) │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vanilla HTML/CSS/JS or Svelte | Lightweight, no build step overhead, mobile-responsive |
| CSS | Tailwind CSS (CDN or bundled) | Dark-first theme, card-based layout, rapid iteration |
| Charts | Chart.js | Line trends, sparklines, score rings, already used in Blue2Scale |
| Backend | Python + Flask or FastAPI | David's preferred stack, type-safe, async support |
| Database | PostgreSQL (existing) | Already has schema, relational, JSONB for flexible data |
| ORM/DB | psycopg2 or SQLAlchemy | Direct SQL for existing schema, ORM for new tables |
| AI Agent | Hermes API (localhost:8642) | Existing infrastructure, local inference |
| Auth | Session-based or simple token | Single-user, local network |
| Web Server | Nginx reverse proxy + uvicorn/gunicorn | Standard Python deployment |
| Cron | Hermes cronjob system | Existing, for Hume sync, weekly reports |
| Container | Optional Docker Compose | For PostgreSQL + backend + frontend |

## Database Schema (Extensions)

### Existing (from `schema.sql`)
- `users` — profile, preferences, metrics
- `measurements` — 39 BIA body composition fields
- `goals` — metric targets with dates
- `device_reports` — BLE scale compatibility

### New Tables to Add

```sql
-- Bloodwork / lab results
CREATE TABLE lab_results (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    test_date       DATE          NOT NULL,
    marker_name     VARCHAR(100)  NOT NULL,
    marker_value    DECIMAL(12,4) NOT NULL,
    unit            VARCHAR(20)   NOT NULL,
    reference_low   DECIMAL(12,4),
    reference_high  DECIMAL(12,4),
    optimal_low     DECIMAL(12,4),
    optimal_high    DECIMAL(12,4),
    source          VARCHAR(50)   DEFAULT 'manual',  -- manual, pdf_parse, lab_corps, etc.
    notes           TEXT,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Supplement stack
CREATE TABLE supplements (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    name            VARCHAR(100)  NOT NULL,
    dose            VARCHAR(50),         -- e.g. "500mg"
    timing          VARCHAR(50),         -- "morning", "evening", "with food"
    purpose         TEXT,                -- why taking it
    active          BOOLEAN       DEFAULT TRUE,
    started_at      DATE,
    ended_at        DATE,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Supplement adherence log
CREATE TABLE supplement_log (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    supplement_id   VARCHAR(36)   NOT NULL,
    taken_at        TIMESTAMPTZ   DEFAULT NOW(),
    taken           BOOLEAN       DEFAULT TRUE,
    note            TEXT
);

-- Diet / nutrition log
CREATE TABLE diet_log (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    log_date        DATE          NOT NULL,
    meal_type       VARCHAR(20),         -- breakfast, lunch, dinner, snack
    calories        INTEGER,
    protein_g       DECIMAL(6,1),
    carbs_g         DECIMAL(6,1),
    fat_g           DECIMAL(6,1),
    fiber_g         DECIMAL(5,1),
    sodium_mg       DECIMAL(7,1),
    potassium_mg    DECIMAL(7,1),
    magnesium_mg    DECIMAL(7,1),
    omega3_g        DECIMAL(5,2),
    vitamin_d_iu    DECIMAL(7,0),
    iron_mg         DECIMAL(5,1),
    b12_mcg         DECIMAL(6,1),
    source          VARCHAR(50)   DEFAULT 'manual',
    notes           TEXT,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Training: exercise library
CREATE TABLE exercises (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    name            VARCHAR(100)  NOT NULL,
    muscle_group    VARCHAR(50),         -- chest, back, legs, shoulders, arms, core
    category        VARCHAR(30),         -- compound, isolation, bodyweight, machine, cable
    notes           TEXT,
    active          BOOLEAN       DEFAULT TRUE,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Training log
CREATE TABLE training_log (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    workout_date    DATE          NOT NULL,
    exercise_name   VARCHAR(100)  NOT NULL,
    set_number      SMALLINT      NOT NULL,
    reps            SMALLINT,
    weight_kg       DECIMAL(6,1),
    rpe             DECIMAL(3,1),
    notes           TEXT,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- DNA / genetic markers
CREATE TABLE genetic_markers (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    rsid            VARCHAR(20)   NOT NULL,
    genotype        VARCHAR(10),
    gene_name       VARCHAR(50),
    category        VARCHAR(50),         -- methylation, vitamin, recovery, etc.
    risk_allele     VARCHAR(10),
    interpretation  TEXT,
    source_file     VARCHAR(100),        -- 23andMe, Ancestry, etc.
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Hermes chat history (optional, can use Hermes session DB)
CREATE TABLE hermes_health_chats (
    id              VARCHAR(36)   NOT NULL PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    question        TEXT          NOT NULL,
    answer          TEXT,
    context_refs    JSONB,               -- refs to lab_results, measurements, etc.
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lab_results_user_date   ON lab_results (user_id, test_date);
CREATE INDEX idx_lab_results_marker      ON lab_results (user_id, marker_name);
CREATE INDEX idx_supplements_user        ON supplements (user_id);
CREATE INDEX idx_supplement_log_user     ON supplement_log (user_id, taken_at);
CREATE INDEX idx_diet_log_user_date      ON diet_log (user_id, log_date);
CREATE INDEX idx_training_log_user_date  ON training_log (user_id, workout_date);
CREATE INDEX idx_genetic_markers_user    ON genetic_markers (user_id);
```

## API Design

### REST Endpoints

```
GET    /api/health/profile              — user profile
PUT    /api/health/profile              — update profile

# Body Composition (extends Blue2Scale)
GET    /api/health/measurements         — list measurements (?from=&to=&limit=)
GET    /api/health/measurements/latest  — latest measurement
POST   /api/health/measurements         — manual entry

# Labs
GET    /api/health/labs                 — list lab results (?marker=&from=&to=)
POST   /api/health/labs                 — add lab result
GET    /api/health/labs/markers         — distinct marker names
GET    /api/health/labs/trends          — trend data for a marker
DELETE /api/health/labs/:id             — delete lab result

# Supplements
GET    /api/health/supplements          — list current stack
POST   /api/health/supplements          — add supplement
PUT    /api/health/supplements/:id      — update
DELETE /api/health/supplements/:id      — remove
POST   /api/health/supplements/:id/log  — log adherence

# Diet
GET    /api/health/diet                 — list diet logs (?date=&from=&to=)
POST   /api/health/diet                 — add diet log
GET    /api/health/diet/summary         — daily/weekly summary

# Training
GET    /api/health/training             — list training logs (?from=&to=&exercise=)
POST   /api/health/training             — add training log
GET    /api/health/training/summary     — volume/PR/progression summary
GET    /api/health/training/exercises   — distinct exercises

# DNA
GET    /api/health/dna                  — list genetic markers
POST   /api/health/dna                  — add marker
POST   /api/health/dna/upload           — upload raw DNA file

# Intelligence
GET    /api/health/readiness            — readiness score + breakdown
GET    /api/health/scores               — all health scores
GET    /api/health/correlations         — significant correlations found
GET    /api/health/weekly-review        — automated weekly summary

# Hermes
POST   /api/health/hermes/chat          — send question, get AI response
GET    /api/health/hermes/daily-insight — today's Hermes insight
POST   /api/health/hermes/report        — generate monthly report

# Export
GET    /api/health/export/json          — full data export
GET    /api/health/export/doctor        — doctor-ready PDF summary
```

## AI Integration

### Hermes Agent Context Injection

When the user asks Hermes a health question, the backend:
1. Gathers relevant context from all data sources
2. Injects it as system context into the Hermes API call
3. Streams or returns the response

```python
# Pseudocode
def ask_hermes(question: str, user_id: str) -> str:
    context = {
        "profile": get_profile(user_id),
        "latest_measurement": get_latest_measurement(user_id),
        "recent_labs": get_recent_labs(user_id, days=90),
        "current_supplements": get_active_supplements(user_id),
        "recent_diet": get_diet_summary(user_id, days=7),
        "recent_training": get_training_summary(user_id, days=14),
    }
    
    prompt = f"""You are Hermes, David's personal health AI advisor.
    
Current health context:
{json.dumps(context, indent=2)}

User question: {question}

Respond as a knowledgeable health advisor. Be specific, cite the data, 
and note when more data would be needed for a stronger recommendation.
Never present yourself as a doctor — you are a decision support tool."""

    return hermes_api.chat(prompt, model="qwen/qwen3.6-35b-a3b")
```

### Model Choice
- **Primary:** Qwen3.6-35B on Spark2 (.105) — fast, cheap, good enough for health Q&A
- **Fallback:** Nemotron 120B on Spark (.249) — when deeper analysis needed
- **Offline availability:** Both are local, no external API costs

## Frontend Architecture

**UI Reference:** Blue2Scale codebase (`Blue2Scale.com/`) — analyzed and documented in `docs/STYLE-GUIDE.md`. All chart patterns, color system, component patterns, and animation behaviors should follow Blue2Scale conventions.

### Tab Separation Rule (CRITICAL)

**Each main nav tab is its own isolated page.** No single-page infinite scroll. No accordions. No collapsible sections that hide content. The sidebar switches between entirely separate views. Within each tab, use Blue2Scale-style sub-tabs where content would otherwise overflow (e.g., Body → Overview | Body Map | Trends).

### Page Structure (SPA routing)

### Component Tree (Per-Tab Isolation)

Each tab is a self-contained page with its own components. No component spans across tabs.

**Today Tab:** HealthScoreCard, RecoveryGauge, BodyCompDelta, WorkoutReadiness, LabAlertBanner, SupplementReminder, HermesInsight

**Body Tab (sub-tabs: Overview | Body Map | Trends):** MetricCardGrid, BodyCompDonut, KeyMetricsList, BodyMapSVG (from Blue2Scale), MetricTrendChart

**Labs Tab (sub-tabs: Dashboard | Trends | DNA):** BiomarkerTable (color-zoned rows), LabTrendChart, LabEntryForm, DNAContextPanel

**Fuel Tab (sub-tabs: Diet | Supplements):** MacroSummaryChart, MicroRadarChart, DailyDietLog, SupplementStackList, AdherenceCalendar

**Training Tab (sub-tabs: Calendar | Log | Progress):** WorkoutCalendar, ExerciseLibraryManager, SetLogForm, VolumeByMuscleChart, PRTracker

**Hermes Tab (sub-tabs: Chat | Reports | Protocols):** ChatInterface, WeeklyReviewCard, ProtocolCardList, MonthlyReportViewer

## Security Considerations

1. **Local-only by default** — no external API dependencies for health data
2. **No cloud storage** — all data in local PostgreSQL
3. **HTTPS required** — self-signed cert for local network or Let's Encrypt
4. **No PII in logs** — sanitize health data from log output
5. **Hermes context sanitization** — ensure lab values aren't leaked to external models if using OpenRouter fallback
6. **Data export** — user can export and delete all data

## Deployment

```
├── backend/
│   ├── app.py              # FastAPI/Flask entry point
│   ├── models/             # SQLAlchemy models
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic (hermes, scores, correlations)
│   └── parsers/            # Lab PDF, DNA raw data parsers
├── frontend/
│   ├── index.html          # SPA shell
│   ├── css/
│   ├── js/
│   │   ├── app.js          # Router + state
│   │   ├── pages/          # Per-page logic
│   │   └── components/     # Reusable UI components
│   └── assets/
├── schema.sql              # Full DB schema
├── docker-compose.yml      # Optional: PostgreSQL + backend + frontend
└── scripts/
    ├── sync_hume.py        # Hume sync (existing)
    └── weekly_report.py    # Hermes weekly review generator
```

### Cron Jobs

| Job | Schedule | Script |
|-----|----------|--------|
| Hume body comp sync | Every 30 min | `sync_hume.py` |
| Weekly health review | Monday 8am | `weekly_report.py` |
| Monthly board meeting | 1st of month 9am | `monthly_report.py` |

## Open Questions

1. **Backend framework:** Flask (simpler, synchronous) or FastAPI (async, type-safe)? Recommendation: FastAPI for type safety and async support.
2. **Frontend framework:** Vanilla JS (like Blue2Scale) or Svelte (reactive, small bundle)? Recommendation: Svelte for component reusability, but vanilla JS acceptable for MVP.
3. **Hermes context window:** Health data could be large. How to chunk/filter context for the AI? Recommendation: Summary-first approach — generate a compact context digest before sending to Hermes.
4. **Chart library:** Chart.js (already in Blue2Scale) or something more specialized like D3? Recommendation: Chart.js for MVP, D3 for advanced correlation charts later.
5. **Auth:** Needed for single-user local app? Recommendation: Simple auth for network access, skip for localhost-only MVP.
6. **Blue2Scale migration:** Stay PHP/MySQL or migrate to Python/PostgreSQL? Recommendation: Keep Blue2Scale as-is for BLE scale capture, new backend reads from PostgreSQL (sync from MySQL if needed).
