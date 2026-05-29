# Epic G1 — Health Data Hub

**Phase:** G1
**Doc Version:** 0.1
**Date:** 2026-05-29
**Status:** Proposed
**Parent:** docs/EPICS.md
**Quality Standard:** docs/QUALITY.md
**Prerequisite:** None (first phase)
**Est. Stories:** 8

---

## Scope

User profile, database schema, manual data entry for all health streams, Hume Body Pod sync, basic dashboard shell, and Hermes chat over user-entered data.

---

## Story G1.1 — User Profile

**Points:** 2 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** None

**What:** Create user profile management — store and update sex, age, height, weight, activity level, unit preference, and theme preference. Builds on the existing `users` table in `schema.sql` with the default "david-mccarty" user.

**Tasks:**
- [ ] Extend `users` table if needed (verify existing schema covers all fields)
- [ ] Create `GET /api/health/profile` endpoint
- [ ] Create `PUT /api/health/profile` endpoint
- [ ] Build profile settings page in frontend (`/settings`)
- [ ] Add theme toggle (dark/light/system)

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G1.1-AC1 | Profile loads with correct user data on GET | unit |
| G1.1-AC2 | Profile updates persist across page reload | integration |
| G1.1-AC3 | Theme toggle switches between dark/light/system | smoke |
| G1.1-AC4 | Invalid height/age values rejected with 400 | unit |

**Definition of Done:** Profile endpoints return correct data, settings page saves changes that persist, theme toggle works across all pages.

---

## Story G1.2 — Database Schema Migration

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** None

**What:** Extend the PostgreSQL schema with new tables for labs, supplements, supplement_log, diet_log, training_log, genetic_markers, and hermes_health_chats. Write migration scripts. Verify against existing schema.

**Tasks:**
- [ ] Create migration SQL file for new tables
- [ ] Add indexes for common query patterns
- [ ] Write rollback migration
- [ ] Test migration on clean PostgreSQL
- [ ] Test migration on existing database (with Blue2Scale data)
- [ ] Verify foreign key constraints

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G1.2-AC1 | All 7 new tables created successfully | smoke |
| G1.2-AC2 | Indexes exist on user_id + date columns | smoke |
| G1.2-AC3 | Foreign keys cascade on user delete | integration |
| G1.2-AC4 | Migration runs idempotently (IF NOT EXISTS) | unit |
| G1.2-AC5 | Rollback drops all new tables without affecting existing data | integration |

**Definition of Done:** Schema migration applies cleanly to both fresh and existing databases, rollback works without data loss, all FK constraints verified.

---

## Story G1.3 — Lab Results CRUD

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.2

**What:** Build full CRUD for bloodwork/lab results. Manual entry form with marker name, value, unit, reference range, optimal range, test date, source, and notes. List view with filtering by marker and date range.

**Tasks:**
- [ ] Create `lab_results` SQLAlchemy model
- [ ] Build `GET /api/health/labs` — list with ?marker=&from=&to= filters
- [ ] Build `POST /api/health/labs` — create
- [ ] Build `DELETE /api/health/labs/:id` — delete
- [ ] Build `GET /api/health/labs/markers` — distinct markers
- [ ] Build Labs tab UI — list view + add form
- [ ] Add color-coded zones: green (optimal), amber (normal), red (high-risk)

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G1.3-AC1 | Lab result saved and retrievable via GET | integration |
| G1.3-AC2 | Filter by marker name returns only matching results | unit |
| G1.3-AC3 | Filter by date range excludes out-of-range results | unit |
| G1.3-AC4 | Deleting a lab result removes it from list | integration |
| G1.3-AC5 | Color zones render correctly based on optimal/normal/high-risk classification | smoke |
| G1.3-AC6 | Duplicate marker+date entries allowed (different test panels) | unit |

**Definition of Done:** User can add, view, filter, and delete lab results. Color-coded zones show at-a-glance status. Distinct marker names available for dropdown/filter.

---

## Story G1.4 — Supplement Stack + ChatGPT Import

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.2

**What:** Supplement CRUD + adherence logging. Active stack view, add/edit/remove, daily adherence check-in. **Initial data load from ChatGPT memory export** — parse the exported conversation memory to extract the full supplementation list (name, dose, timing, purpose).

**Tasks:**
- [ ] Create `supplements` + `supplement_log` SQLAlchemy models
- [ ] Build ChatGPT memory export parser — extract supplement entries from JSON/text export
- [ ] Build import preview UI — review parsed supplements before saving
- [ ] Build `GET /api/health/supplements` — active stack
- [ ] Build `POST /api/health/supplements` — add (manual or bulk import)
- [ ] Build `PUT /api/health/supplements/:id` — edit
- [ ] Build `DELETE /api/health/supplements/:id` — deactivate (soft)
- [ ] Build `POST /api/health/supplements/:id/log` — adherence
- [ ] Build Fuel tab — supplement section UI

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G1.4-AC1 | Supplement added with name, dose, timing, purpose, start date | integration |
| G1.4-AC2 | ChatGPT memory export parsed and supplements extracted | integration |
| G1.4-AC3 | Import preview shows parsed supplements before saving | smoke |
| G1.4-AC4 | Active supplements list excludes soft-deleted items | unit |
| G1.4-AC5 | Adherence log records taken/not-taken with timestamp | integration |
| G1.4-AC6 | Editing supplement updates all fields | unit |
| G1.4-AC7 | Adherence calendar shows daily check-in history | smoke |

**Definition of Done:** Full supplement lifecycle (import → add → edit → log → deactivate). ChatGPT export provides initial dataset. Adherence tracking visible day-by-day. Active stack always shows current supplements only.

---

## Story G1.5 — Weight Training: Full CRUD Calendar System

**Points:** 4 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.2

**What:** Full-featured workout tracker with CRUD operations on exercises and workouts across a calendar. Create/edit/delete exercises. Log workouts with sets, reps, weight, RPE per set. Calendar view for workout history. Exercise library management. Volume tracking by muscle group and week. PR detection. This is the primary training interface — not a side feature.

**Tasks:**
- [ ] Create `training_log` SQLAlchemy model
- [ ] Create `exercises` table — exercise library with name, muscle group, category
- [ ] Build `GET /api/health/training` — list with ?from=&to=&exercise=&muscle_group=
- [ ] Build `POST /api/health/training` — add set(s) to a workout
- [ ] Build `PUT /api/health/training/:id` — edit a set
- [ ] Build `DELETE /api/health/training/:id` — delete a set
- [ ] Build `GET /api/health/training/exercises` — exercise library CRUD
- [ ] Build `POST /api/health/training/exercises` — add exercise to library
- [ ] Build `GET /api/health/training/summary` — volume/PR/progression summary
- [ ] Build calendar view UI — month grid with workout indicators
- [ ] Build workout log form — exercise selector (from library), sets with reps/weight/RPE
- [ ] Build exercise library manager UI — add/edit/delete exercises
- [ ] Build volume by muscle group visualization (bar chart)
- [ ] Build PR detection — flag new 1RM estimates

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G1.5-AC1 | Training set recorded with exercise, sets, reps, weight, date | integration |
| G1.5-AC2 | Exercise library CRUD — add, list, edit, delete exercises | integration |
| G1.5-AC3 | Filter by exercise returns only that exercise's history | unit |
| G1.5-AC4 | Filter by date range works correctly | unit |
| G1.5-AC5 | Multiple sets for same exercise+date stored and displayed correctly | integration |
| G1.5-AC6 | Calendar view shows month grid with workout indicators on active days | smoke |
| G1.5-AC7 | Volume summary grouped by muscle group and week | integration |
| G1.5-AC8 | PR detection identifies new estimated 1RM | unit |
| G1.5-AC9 | Editing a set updates correctly | integration |
| G1.5-AC10 | Deleting a set removes it from history | integration |

**Definition of Done:** Full CRUD workout tracker with exercise library, calendar view, volume tracking, and PR detection. User can manage their exercise catalog and log daily workouts with full edit/delete capabilities.

---

## Story G1.6 — Diet Log

**Points:** 2 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.2

**What:** Daily diet/nutrition logging with calories, macros, and key micronutrients. Meal type tagging (breakfast, lunch, dinner, snack).

**Tasks:**
- [ ] Create `diet_log` SQLAlchemy model
- [ ] Build `GET /api/health/diet` — list with ?date=&from=&to=
- [ ] Build `POST /api/health/diet` — add entry
- [ ] Build `GET /api/health/diet/summary` — daily totals
- [ ] Build Fuel tab — diet log section UI

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G1.6-AC1 | Diet entry saved with calories, macros, meal type | integration |
| G1.6-AC2 | Filter by date returns that day's entries | unit |
| G1.6-AC3 | Summary endpoint returns daily totals for calories, protein, carbs, fat | integration |
| G1.6-AC4 | Micronutrient fields (fiber, sodium, potassium, etc.) accept NULL | unit |

**Definition of Done:** User can log meals with nutrition data, view daily history, and get daily macro/micro summaries.

---

## Story G1.7 — Basic Dashboard Shell

**Points:** 3 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.1

**What:** Build the app shell with 6-tab navigation (Today, Body, Labs, Fuel, Training, Hermes). Dark-first card-based layout. Today screen shows summary cards pulling from all data streams.

**Tasks:**
- [ ] Create SPA shell with sidebar navigation
- [ ] Implement dark/light theme (from G1.1)
- [ ] Build Today screen with placeholder cards
- [ ] Wire up live data cards: latest measurement, recent labs, active supplements, today's diet, recent training
- [ ] Add mobile-responsive layout (sidebar → bottom nav on mobile)
- [ ] Add semantic color system throughout app

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G1.7-AC1 | All 6 tabs render and navigation works | smoke |
| G1.7-AC2 | Today screen shows summary cards with real data | integration |
| G1.7-AC3 | Dark theme is default, light toggle works | smoke |
| G1.7-AC4 | Layout is usable on mobile (375px width) | smoke |
| G1.7-AC5 | Cards use semantic colors (green/amber/red) correctly | smoke |
| G1.7-AC6 | Empty states render when no data exists (no crash) | integration |

**Definition of Done:** Fully navigable app shell with 6 tabs, dark-first theme, responsive layout, Today screen with live summary cards, graceful empty states.

---

## Story G1.8 — Hermes Chat (Phase 1)

**Points:** 4 | **Owner:** dev | **Status:** Proposed | **Prerequisite:** G1.1, G1.3, G1.4, G1.5, G1.6

**What:** Embed Hermes AI chat in the Hermes tab. Chat interface that gathers context from all data sources and sends to Hermes API (localhost:8642). Supports basic health queries.

**Tasks:**
- [ ] Build context aggregation service (profile + latest measurement + recent labs + supplements + diet + training)
- [ ] Create `POST /api/health/hermes/chat` endpoint — sends question + context to Hermes API
- [ ] Build chat UI (message list + input + send)
- [ ] Add loading state while Hermes responds
- [ ] Add source citations in Hermes responses (reference which data informed answer)
- [ ] Store chat history in `hermes_health_chats` table
- [ ] Handle Hermes API errors gracefully (offline, timeout)

**Acceptance Criteria:**

| # | Criterion | Test |
|---|---|---|
| G1.8-AC1 | User can ask a health question and receive Hermes response | integration |
| G1.8-AC2 | Context includes latest measurement, recent labs, active supplements, diet, training | integration |
| G1.8-AC3 | Chat UI scrolls, shows loading state, handles errors | smoke |
| G1.8-AC4 | Hermes responses include references to data sources when applicable | integration |
| G1.8-AC5 | Chat history persists across page reload | integration |
| G1.8-AC6 | Offline Hermes API returns graceful error message | unit |

**Definition of Done:** User can chat with Hermes about their health data. Hermes has access to all data streams with proper context injection. Chat history is saved. Error states handled gracefully.

---

## Epic G1 — Definition of Done

All 8 stories complete with acceptance criteria verified. Quality gate:

1. ✅ pytest tests/smoke/ -v
2. ✅ pytest tests/unit/ -v --tb=short
3. ✅ Coverage: new modules ≥ 80% branch coverage
4. ✅ Type check: mypy backend/
5. ✅ Lint: ruff check backend/
6. ✅ pytest tests/integration/ -v
7. ✅ Frontend: no console errors, mobile-responsive at 375px
8. ✅ DB migrations tested on clean and existing PostgreSQL
9. ✅ Hume sync cron running (existing, verify baseline)
10. ✅ Hermes chat responding with health context