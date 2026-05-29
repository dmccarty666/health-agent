# Phase 0 — Hume Body Pod Dashboard

**Phase:** G0 (foundation — blocked by nothing, blocks G1–G4)
**Doc Version:** 1.0
**Date:** 2026-05-29
**Status:** Ready to Execute
**Parent:** docs/EPICS.md
**Quality Standard:** docs/QUALITY.md, docs/STYLE-GUIDE.md
**Execution:** tmux-workers (NL mode) — 6 parallelizable stories
**Est. Stories:** 6

---

## Overview

Build a complete Hume Body Pod dashboard tab with all 39 body composition metrics. This is the first visible deliverable — a fully functional Body tab using data we already have flowing through `sync_hume.py` → PostgreSQL.

**Each story is a self-contained tmux worker task.** Workers get the full Blue2Scale reference code, the STYLE-GUIDE, and the PostgreSQL schema as context. They work independently and produce verifiable outputs.

## What We Already Have

| Asset | File | Status |
|-------|------|--------|
| Hume → PostgreSQL sync | `sync_hume.py` | ✅ Working, 39-field mapping |
| PostgreSQL schema | `schema.sql` | ✅ users + measurements + goals |
| Blue2Scale reference UI | `Blue2Scale.com/` | ✅ Full PHP/JS app analyzed in STYLE-GUIDE |
| Style guide | `docs/STYLE-GUIDE.md` | ✅ Color system, components, chart patterns |
| Worker constitution | `tmux-workers/WORKER_SOUL.md` | ✅ Baked into `tmux-worker` profile |

---

## Story Assignments (Maximum Parallelism: 3)

### Dependencies

```
S0.1 (Sync) ──── S0.2 (API) ──── S0.3 (Shell) ──── S0.6 (Integration)
                                         │
                    ┌────────────────────┤
                    │                    │
              S0.4 (Overview)    S0.5 (Body Map + Trends)
```

**Execution order:**
1. **Wave 1:** S0.1 + S0.2 (parallel — infrastructure)
2. **Wave 2:** S0.3 (blocked by S0.2 API existing)
3. **Wave 3:** S0.4 + S0.5 (parallel — blocked by S0.3 shell)
4. **Final:** S0.6 (blocked by all)

---

## Story S0.1 — Hume Sync Infrastructure

**Points:** 2 | **Owner:** tmux-worker | **Blocked by:** None | **Blocks:** S0.2

**Goal:** Ensure PostgreSQL is running, the health_agent database exists, the schema is applied, and `sync_hume.py` runs successfully with real data. Set up cron for automatic sync.

**Context for worker:**
- PostgreSQL is installed on this host
- Database name: `health_agent`
- Schema file: `~/.hermes/PROJECTS/health-agent/schema.sql`
- Sync script: `~/.hermes/PROJECTS/health-agent/sync_hume.py`
- The script needs `psycopg2` and `requests` — install if missing
- Run the script once to populate measurements, then verify data exists

**Worker task:**

```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Create database if missing
sudo -u postgres createdb health_agent 2>/dev/null || echo "DB exists"

# Apply schema
sudo -u postgres psql -d health_agent -f ~/.hermes/PROJECTS/health-agent/schema.sql

# Install dependencies
pip install psycopg2-binary requests

# Run sync
cd ~/.hermes/PROJECTS/health-agent && python3 sync_hume.py

# Verify data
sudo -u postgres psql -d health_agent -c "SELECT COUNT(*) as total, MAX(measured_at) as latest FROM measurements;"

# List latest measurement
sudo -u postgres psql -d health_agent -c "SELECT measured_at, weight_kg, bmi, body_fat_pct, skel_muscle_kg, body_water_pct, visceral_fat FROM measurements ORDER BY measured_at DESC LIMIT 1;"
```

**Acceptance Criteria:**

| # | Criterion | Verify |
|---|---|---|
| AC1 | PostgreSQL running and health_agent DB exists | `psql -d health_agent -c "SELECT 1"` |
| AC2 | Schema applied with all tables | `\dt` shows users, measurements, goals |
| AC3 | sync_hume.py runs without error | exit code 0 |
| AC4 | Measurements table has data | `SELECT COUNT(*) > 0` |
| AC5 | Latest measurement has all key fields populated | weight_kg, bmi, body_fat_pct, skel_muscle_kg NOT NULL |

**Output:** Verified PostgreSQL with populated measurements table. Cron job configured.

**Artifact:** `S0.1_result.json` with row counts and latest measurement summary.

---

## Story S0.2 — Backend API (FastAPI)

**Points:** 3 | **Owner:** tmux-worker | **Blocked by:** S0.1 | **Blocks:** S0.3

**Goal:** Build a Python FastAPI backend that serves body composition data from PostgreSQL via REST endpoints. The API must match the frontend data needs defined in the component tree.

**Context for worker:**
- Database: PostgreSQL `health_agent` on localhost, peer auth
- Schema: `~/.hermes/PROJECTS/health-agent/schema.sql` — study the `measurements` table columns
- Framework: FastAPI with `psycopg2` for database access
- Output directory: `~/.hermes/PROJECTS/health-agent/backend/`
- Start file: `app.py` (FastAPI entry point)
- Port: 8765 (avoiding conflicts with existing services)

**Worker task:**
1. Create `backend/app.py` — FastAPI application
2. Create `backend/db.py` — database connection helper
3. Create `backend/models.py` — Pydantic models for responses
4. Implement these endpoints:

```
GET  /api/health/measurements          — list (?limit=30&offset=0)
GET  /api/health/measurements/latest   — single latest measurement
GET  /api/health/measurements/trends   — selected fields over time (?metrics=weight_kg,bmi&limit=90)
GET  /api/health/profile               — user profile
GET  /api/health/healthz               — health check
```

5. Add CORS headers (allow all origins for local dev)
6. Add `backend/requirements.txt`
7. Test: start the server, curl each endpoint, verify JSON responses

**API Response Format (measurements):**
```json
{
  "measurements": [
    {
      "measured_at": "2026-05-28T08:15:00",
      "weight_kg": 82.3,
      "bmi": 24.5,
      "body_fat_pct": 18.2,
      "skel_muscle_kg": 35.1,
      "body_water_pct": 58.4,
      "visceral_fat": 8.0,
      "lean_mass_kg": 67.4,
      "fat_mass_kg": 15.0,
      "bmr_kcal": 1820,
      "metabolic_age": 35,
      ...all 39 fields included
    }
  ],
  "count": 1,
  "total": 124
}
```

**Acceptance Criteria:**

| # | Criterion | Verify |
|---|---|---|
| AC1 | Server starts on port 8765 | `curl localhost:8765/api/health/healthz` → 200 |
| AC2 | Latest measurement returns real data | `curl localhost:8765/api/health/measurements/latest` → JSON with values |
| AC3 | List endpoint respects limit | `?limit=5` returns max 5 items |
| AC4 | Trends endpoint returns time-series array | 90 data points for requested metrics |
| AC5 | Profile endpoint returns user data | name "David McCarty", height 183cm |
| AC6 | CORS headers present | `Access-Control-Allow-Origin: *` |

**Output:** Running FastAPI server on port 8765 with all endpoints working.

**Artifacts:** `backend/app.py`, `backend/db.py`, `backend/models.py`, `backend/requirements.txt`

---

## Story S0.3 — Dashboard Shell + Body Tab Navigation

**Points:** 3 | **Owner:** tmux-worker | **Blocked by:** S0.2 | **Blocks:** S0.4, S0.5

**Goal:** Build the HTML/CSS/JS app shell with sidebar navigation (Today, Body, Labs, Fuel, Training, Hermes) and the Body tab container with sub-tab switching. Follow the STYLE-GUIDE patterns exactly — dark-first, card-based, Lucide icons, stagger animations.

**Context for worker:**
- API: `http://localhost:8765/api/health/` (S0.2)
- Style guide: `~/.hermes/PROJECTS/health-agent/docs/STYLE-GUIDE.md` — read this first
- Blue2Scale reference: Study `Blue2Scale.com/php/assets/css/app.css` and `dashboard.php`
- Output: `~/.hermes/PROJECTS/health-agent/frontend/`
- Start: `frontend/index.html` (main entry point)
- CSS from Blue2Scale: copy the HSL variable system, `.card` components, `.stat-card` gradients from `app.css`

**Worker task:**
1. Create `frontend/index.html` — full SPA shell with:
   - Sticky sidebar (6 tabs: Today, Body, Labs, Fuel, Training, Hermes)
   - Mobile bottom tab bar (<640px)
   - Main content area with tab switching (JS-based SPA routing)
   - Dark theme default with light toggle
   - Staggered entrance animations
   - Lucide icons via CDN
2. Create `frontend/css/app.css` — copy Blue2Scale CSS variables, card system, gradient stat cards, sidebar styles
3. Create `frontend/js/app.js` — tab switching router, API client, theme toggle
4. Body tab container with 3 sub-tabs: Overview | Body Map | Trends
5. Loading spinner, empty state, error state components
6. Serve the frontend — can use Python `http.server` or open `index.html` directly

**Tab navigation structure:**
```
Sidebar:
  📊 Today
  ⚖️  Body        ← active (default for Phase 0)
  🔬 Labs         ← disabled (no data yet)
  🍎 Fuel         ← disabled
  🏋️ Training     ← disabled
  ✨ Hermes       ← disabled
```

**Acceptance Criteria:**

| # | Criterion | Verify |
|---|---|---|
| AC1 | All 6 tabs render in sidebar | Visual |
| AC2 | Tab switching works (content area changes) | Click each tab |
| AC3 | Body tab selected by default | Page load |
| AC4 | Body sub-tabs (Overview/Body Map/Trends) render and switch | Click sub-tabs |
| AC5 | Dark theme is default | Page load background is dark |
| AC6 | Light toggle works | Click toggle → light theme |
| AC7 | Mobile bottom nav appears <640px | Resize browser |
| AC8 | Stagger animations play on load | Cards fade in sequentially |
| AC9 | Disabled tabs show muted styling | Labs/Fuel/Training/Hermes grayed out |

**Output:** Functional app shell with Body tab ready for content.

**Artifacts:** `frontend/index.html`, `frontend/css/app.css`, `frontend/js/app.js`

---

## Story S0.4 — Overview Sub-tab (Stat Cards + Donut + Metrics)

**Points:** 4 | **Owner:** tmux-worker | **Blocked by:** S0.3 | **Requires:** S0.2 API

**Goal:** Build the Overview sub-tab for the Body page — 4 gradient stat cards (Weight, Body Fat, Muscle Mass, Body Water), a body composition donut chart, and a Key Metrics card. Follow Blue2Scale's `dashboard.js` patterns exactly.

**Context for worker:**
- API: `GET http://localhost:8765/api/health/measurements/latest` for current values
- API: `GET http://localhost:8765/api/health/measurements?limit=30` for trends
- Reference: `Blue2Scale.com/php/assets/js/dashboard.js` — study stat card rendering, donut chart
- Charts: Chart.js 4 from CDN
- Insert content into the Overview sub-tab container created by S0.3

**Worker task:**
1. Create `frontend/js/body-overview.js` — fetches data, renders Overview
2. Gradient stat cards (4 across):
   - **Weight** (grad-blue, icon: scale) — current kg + trend arrow + sparkline
   - **Body Fat** (grad-amber, icon: activity) — current % + trend + sparkline
   - **Muscle Mass** (grad-green, icon: dumbbell) — skeletal muscle kg + trend + sparkline
   - **Body Water** (grad-cyan, icon: droplets) — water % + trend + sparkline
3. Body Composition donut chart — lean mass / fat mass / water
4. Key Metrics card (card-accent-teal) — BMI, Visceral Fat, BMR, Metabolic Age, Bone Mineral
5. Category cards (3 across):
   - **Fat Analysis** (card-accent-amber) — Body Fat %, Subcut Fat, Visceral Fat, Android Fat
   - **Lean Mass** (card-accent-green) — Lean Mass, Lean %, Muscle, Cell Mass
   - **Hydration** (card-accent-cyan) — Body Water %, Total Water, ECW, ICW
6. Summary bar at bottom — last measured date, month count, total count
7. Follow Blue2Scale conventions: `.stat-card` with background icon, `.card` with accent borders, metric rows with Lucide icons, stagger animation, hover lift

**Acceptance Criteria:**

| # | Criterion | Verify |
|---|---|---|
| AC1 | 4 gradient stat cards render with real data | View Overview sub-tab |
| AC2 | Donut chart renders lean/fat/water proportions | Visual + tooltip values |
| AC3 | Key Metrics card shows 5 metrics with icons | Visual |
| AC4 | 3 category cards (Fat/Lean/Hydration) render with real values | Visual |
| AC5 | Summary bar shows last measured date and counts | Visual |
| AC6 | Cards animate in with stagger effect | Page load transition |
| AC7 | Empty state renders when API returns no data | Kill API, reload |
| AC8 | Sparkline bars render in stat cards | Visual |

**Output:** Fully populated Overview sub-tab with live Hume data.

**Artifact:** `frontend/js/body-overview.js`

---

## Story S0.5 — Body Map + Trends Sub-tabs

**Points:** 5 | **Owner:** tmux-worker | **Blocked by:** S0.3 | **Requires:** S0.2 API

**Goal:** Build the Body Map sub-tab (SVG segmental visualization) and the Trends sub-tab (line charts for body comp metrics). Port directly from Blue2Scale's `body-map.js` and `charts-page.js`.

**Context for worker:**
- API: `GET http://localhost:8765/api/health/measurements/latest` for segmental data
- API: `GET http://localhost:8765/api/health/measurements/trends?metrics=weight_kg,bmi,body_fat_pct,skel_muscle_kg,lean_mass_kg,fat_mass_kg,body_water_pct,visceral_fat,bmr_kcal,metabolic_age&limit=90` for trends
- Reference: `Blue2Scale.com/php/assets/js/body-map.js` — study full render logic
- Reference: `Blue2Scale.com/php/assets/js/charts-page.js` — study chart rendering
- Charts: Chart.js 4 from CDN
- Insert content into Body Map and Trends sub-tab containers

**Worker task:**

**Body Map Sub-tab (frontend/js/body-map.js):**
1. Port the SVG silhouette rendering from Blue2Scale `body-map.js`
2. Use the MALE_PATH and FEMALE_PATH from the reference
3. 5 segmental regions (right arm, left arm, trunk, right leg, left leg)
4. 3 view modes: Muscle (kg), Fat (%), Fat (kg)
5. Color-coded overlays: green (good), blue (normal), amber (warning), red (concern)
6. Value labels in pill overlays on each segment
7. Top stats bar: Weight, Body Fat %, Lean Mass %, BMI
8. Color legend at bottom
9. View mode toggle pills
10. Handle missing segmental data gracefully (show "no segmental data" message)

**Trends Sub-tab (frontend/js/body-trends.js):**
1. Port the chart rendering from Blue2Scale `charts-page.js`
2. 6 line charts in a 2-column grid:
   - **Weight Trend** (blue accent, `#3b82f6`) — weight over time
   - **Body Fat %** (amber accent, `#f59e0b`)
   - **Muscle & Lean Mass** (green accent, `#22c55e`) — dual-line: skeletal muscle + lean mass
   - **Body Composition** (purple accent, `#8b5cf6`) — stacked: lean mass + fat mass
   - **Hydration** (cyan accent, `#06b6d4`) — body water % + ECW/ICW dual axis
   - **BMI & Metabolic Age** (pink accent, `#ec4899`) — dual axis
3. Each chart: per-chart time range selector (1W | 1M | 3M | 6M | 1Y | ALL)
4. Blue2Scale chart conventions: gradient fill, 0.35 tension, 800ms easeOutQuart, crosshair plugin, JetBrains Mono values, dark-aware theme colors, fullscreen button
5. Chart card structure: `card card-shadow card-accent-<color>` with header + range pills + canvas
6. Custom metric chart (teal accent) — dropdown to select any metric

**Acceptance Criteria:**

| # | Criterion | Verify |
|---|---|---|
| AC1 | Body map SVG renders with 5 colored segments | Visual |
| AC2 | Toggle between Muscle/Fat%/Fat kg updates colors and labels | Click toggles |
| AC3 | Value pills show correct segmental data | Read pill labels |
| AC4 | Missing segmental data shows graceful empty state | Test with non-segmental measurement |
| AC5 | 6 trend charts render with real data | Visual |
| AC6 | Per-chart time range pills filter data | Click 1W → fewer points |
| AC7 | Crosshair line tracks cursor on charts | Hover chart |
| AC8 | Fullscreen button opens chart in overlay | Click maximize icon |
| AC9 | Custom metric dropdown works | Select different metric → chart updates |
| AC10 | Dark/light theme affects chart colors | Toggle theme → chart colors change |

**Output:** Body Map and Trends sub-tabs fully functional with live Hume data.

**Artifacts:** `frontend/js/body-map.js`, `frontend/js/body-trends.js`

---

## Story S0.6 — Integration & Polish

**Points:** 2 | **Owner:** tmux-worker | **Blocked by:** S0.3, S0.4, S0.5

**Goal:** Wire all components together, verify end-to-end data flow, fix layout issues, ensure responsive behavior, and make the app production-ready for serving.

**Context for worker:**
- All frontend files exist in `frontend/`
- Backend API running on port 8765
- Must produce a single runnable app

**Worker task:**
1. Wire S0.4 and S0.5 JS files into S0.3's tab switching system
2. Ensure each sub-tab loads its content when activated
3. Fix any JS errors, missing imports, or broken references
4. Verify responsive layout: desktop sidebar → mobile bottom nav at 640px
5. Test dark/light theme on all components (charts, cards, body map)
6. Add a Python HTTP server wrapper or update `frontend/index.html` to work with file:// or a simple server
7. Run through manual verification checklist (below)
8. Fix any issues found

**Verification Checklist:**

```
□ Open index.html → dark theme, sidebar visible
□ Body tab selected by default
□ Overview sub-tab: 4 stat cards + donut + key metrics + 3 category cards
□ All values match database
□ Switch to Body Map sub-tab → SVG silhouette with segmental colors
□ Toggle view modes → colors and labels update
□ Switch to Trends sub-tab → 6 charts in grid
□ Click 1W range on Weight chart → fewer data points
□ Hover chart → crosshair appears
□ Click fullscreen → overlay with full-size chart
□ Toggle light theme → all components switch
□ Resize to 375px → bottom nav appears, sidebar hides
□ Resize to 1440px → sidebar visible, cards in grid
□ No console errors
□ No layout overflow
```

**Acceptance Criteria:**

| # | Criterion | Verify |
|---|---|---|
| AC1 | All 3 sub-tabs load with live data | Manual walkthrough |
| AC2 | Tab switching between sub-tabs works without page reload | Click sub-tabs |
| AC3 | Dark/light theme applies globally | Toggle → all components update |
| AC4 | Mobile responsive at 375px, 768px, 1024px, 1440px | Resize browser |
| AC5 | No JavaScript console errors | DevTools console |
| AC6 | Data matches database (spot-check 5 values) | Compare with `psql` query |

**Output:** Production-ready Body tab dashboard, fully integrated.

---

## Execution Plan (tmux-workers)

### Wave 1: Infrastructure (parallel — 2 workers)

```bash
cd ~/.hermes/PROJECTS/tmux-workers

# S0.1 — Hume Sync
python3 cli.py enqueue \
  "S0.1 Hume Sync Infrastructure" \
  "Verify PostgreSQL health_agent DB, apply schema, run sync_hume.py, confirm data exists, set up cron." \
  --project health-agent --story S0.1

# S0.2 — Backend API
python3 cli.py enqueue \
  "S0.2 Backend API" \
  "Build FastAPI backend at port 8765 serving measurements from PostgreSQL health_agent DB. Study ~/.hermes/PROJECTS/health-agent/schema.sql for table columns. Create ~/.hermes/PROJECTS/health-agent/backend/ with app.py, db.py, models.py. Implement GET /api/health/measurements, /measurements/latest, /measurements/trends, /profile, /healthz." \
  --project health-agent --story S0.2
```

### Wave 2: Shell (1 worker — blocked by S0.2)

```bash
# S0.3 — Dashboard Shell
python3 cli.py enqueue \
  "S0.3 Dashboard Shell + Body Tab" \
  "Build the HTML/CSS/JS app shell for health-agent. Study ~/.hermes/PROJECTS/health-agent/docs/STYLE-GUIDE.md and Blue2Scale app.css. Create ~/.hermes/PROJECTS/health-agent/frontend/ with index.html, css/app.css, js/app.js. 6-tab sidebar, dark-first, mobile bottom nav, Body tab with 3 sub-tabs." \
  --project health-agent --story S0.3
```

### Wave 3: Content (parallel — 2 workers, blocked by S0.3)

```bash
# S0.4 — Overview Sub-tab
python3 cli.py enqueue \
  "S0.4 Body Overview Sub-tab" \
  "Build the Overview sub-tab for the Body dashboard. Study Blue2Scale dashboard.js patterns. Create ~/.hermes/PROJECTS/health-agent/frontend/js/body-overview.js. Render 4 gradient stat cards, donut chart, key metrics card, 3 category cards, summary bar from http://localhost:8765 API." \
  --project health-agent --story S0.4

# S0.5 — Body Map + Trends
python3 cli.py enqueue \
  "S0.5 Body Map + Trends Sub-tabs" \
  "Build Body Map and Trends sub-tabs. Study Blue2Scale body-map.js and charts-page.js. Create ~/.hermes/PROJECTS/health-agent/frontend/js/body-map.js and body-trends.js. Port SVG body map with segmental overlays. Build 6 trend charts with time range selectors. All data from http://localhost:8765 API." \
  --project health-agent --story S0.5
```

### Wave 4: Integration (1 worker — blocked by all)

```bash
# S0.6 — Integration
python3 cli.py enqueue \
  "S0.6 Integration & Polish" \
  "Wire all frontend components together. Ensure tab navigation loads correct sub-tab content. Fix any JS errors. Verify responsive layout at 375/768/1024/1440px. Test dark/light theme globally. Run through verification checklist." \
  --project health-agent --story S0.6
```

---

## Timeline Estimate

| Worker | Est. Duration | Mode |
|--------|--------------|------|
| S0.1 | 3–5 min | Bash (script execution) |
| S0.2 | 8–15 min | NL (FastAPI code) |
| S0.3 | 10–20 min | NL (HTML/CSS/JS shell) |
| S0.4 | 12–25 min | NL (Dashboard JS) |
| S0.5 | 15–30 min | NL (Body map + charts) |
| S0.6 | 5–10 min | NL (Integration fixes) |

**Total wall-clock:** ~40–55 min (with 3-worker concurrency)

---

## Verification (Post-Execution)

After all 6 workers complete:

```bash
# 1. Check all workers passed
curl -s http://localhost:9876/api/tmux-workers | python3 -c "
import json,sys; d=json.load(sys.stdin)
for t in d['tasks']:
    print(f\"{t['display_name']}: {t['status']}  gates={t.get('gates_passed','?')}/{t.get('gates_failed','?')}\")
"

# 2. Verify backend
curl -s http://localhost:8765/api/health/healthz
curl -s http://localhost:8765/api/health/measurements/latest | python3 -m json.tool | head -20

# 3. Open frontend
python3 -m http.server 8080 -d ~/.hermes/PROJECTS/health-agent/frontend &
# Open http://localhost:8080 in browser

# 4. Verify data match
sudo -u postgres psql -d health_agent -c "SELECT measured_at, weight_kg, body_fat_pct FROM measurements ORDER BY measured_at DESC LIMIT 3;"
# Compare with dashboard display
```