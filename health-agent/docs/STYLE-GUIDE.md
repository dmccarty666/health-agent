# Health Agent — Style Guide

**Version:** 0.1
**Date:** 2026-05-29
**Source:** Blue2Scale codebase analysis + Oura-inspired direction
**Applies to:** All frontend development

---

## Design System Reference

Blue2Scale is our direct reference implementation for Hume Body Pod data visualization. Its CSS, chart, and component patterns should be carried forward into health-agent.

---

## Color System (HSL Space)

```css
:root {
  --background: 220 20% 97%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --primary: 210 100% 50%;        /* Blue */
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
  --border: 220 13% 91%;
  --ring: 210 100% 50%;

  /* Health status */
  --health-good: 160 84% 39%;     /* Green */
  --health-moderate: 38 92% 50%;  /* Amber */
  --health-concern: 0 84% 60%;    /* Red */
}

.dark {
  --background: 222 47% 6%;
  --foreground: 210 40% 92%;
  --card: 222 40% 10%;
  --primary: 213 94% 58%;
  --muted: 217 33% 13%;
  --muted-foreground: 215 20% 55%;
  --border: 217 33% 17%;
}
```

**Extended for health-agent:**

```css
/* Additional semantic colors beyond Blue2Scale */
--health-good: 160 84% 39%;       /* Green — optimal range */
--health-moderate: 38 92% 50%;    /* Amber — watch */
--health-concern: 0 84% 60%;      /* Red — action needed */
--health-info: 210 100% 50%;      /* Blue — informational */
--health-ai: 270 70% 60%;         /* Purple — Hermes/AI presence */
```

---

## Gradient System (8-Preset Palette)

Borrowed directly from Blue2Scale. Each gradient is a 135° linear gradient with two stops.

| Class | Colors | Use |
|-------|--------|-----|
| `grad-blue` | #3b82f6 → #1d4ed8 | Weight, general metrics |
| `grad-teal` | #14b8a6 → #0d9488 | Hydration, water |
| `grad-green` | #22c55e → #16a34a | Muscle mass, lean mass |
| `grad-amber` | #f59e0b → #d97706 | Body fat, warnings |
| `grad-red` | #ef4444 → #dc2626 | High-risk labs, alerts |
| `grad-purple` | #8b5cf6 → #7c3aed | Hermes/AI, protocols |
| `grad-pink` | #ec4899 → #db2777 | Metabolic, DNA |
| `grad-cyan` | #06b6d4 → #0891b2 | Recovery, readiness |

---

## Component Patterns

### Stat Cards (Gradient)

```html
<div class="stat-card stat-card-green">
  <div class="stat-card-bg-icon"><i data-lucide="dumbbell" style="width:64px;height:64px"></i></div>
  <div class="relative z-10">
    <p class="text-xs font-medium text-white/80 uppercase tracking-wider">Muscle Mass</p>
    <div class="flex items-baseline gap-1.5 mt-1">
      <span class="text-3xl font-bold font-mono">72.3</span>
      <span class="text-sm font-medium text-white/70">kg</span>
    </div>
    <div class="flex items-center gap-1 mt-1.5 text-xs text-white/70">
      <i data-lucide="trending-up" style="width:12px;height:12px"></i>
      <span>+2.1 kg vs oldest</span>
    </div>
    <!-- Sparkline bar chart -->
  </div>
</div>
```

**When to use:** Today screen summary cards. Choose gradient by metric type.
**Hover:** `transform: translateY(-2px)` + elevated shadow.

### Card with Accent Border

```html
<div class="card card-shadow card-accent-blue">
  <div class="card-header">
    <div class="flex items-center gap-2">
      <div class="h-2 w-2 rounded-full bg-blue-500"></div>
      <h3 class="card-title text-sm font-semibold uppercase tracking-wide">Category</h3>
    </div>
  </div>
  <div class="card-content space-y-2">
    <!-- Content rows -->
  </div>
</div>
```

**When to use:** Content sections within tabs. Category group cards.

### Metric Row

```html
<div class="flex items-center justify-between py-2 border-b border-border last:border-0">
  <div class="flex items-center gap-2.5">
    <i data-lucide="heart" style="width:16px;height:16px" class="text-blue-500"></i>
    <span class="text-sm">BMI</span>
  </div>
  <span class="font-mono text-sm font-bold">24.3</span>
</div>
```

**When to use:** Key metrics list, supplement list, lab marker rows.

### Metric Grid Cards

```html
<div class="metric-card">
  <span class="text-xs text-muted-foreground">Label</span>
  <div class="font-mono text-lg font-bold mt-0.5">Value<span class="text-sm ml-0.5">unit</span></div>
</div>
```

**Hover:** `translateY(-1px)` + border color shifts to primary.

---

## Chart System (Chart.js)

### Line Charts — Signature Blue2Scale Pattern

```javascript
{
  type: 'line',
  data: {
    labels: dates,
    datasets: [{
      label: 'Weight (kg)',
      data: values,
      borderColor: '#3b82f6',
      backgroundColor: createGradient(canvasId, '#3b82f6'),
      fill: true,
      tension: 0.35,
      pointRadius: dataPoints > 60 ? 0 : 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: darkTheme ? '#1e293b' : '#ffffff',
        cornerRadius: 10,
        bodyFont: { family: "'JetBrains Mono', monospace" },
      },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: tickColor } },
      y: { grid: { color: gridColor }, ticks: { font: { family: "'JetBrains Mono', monospace" } } },
    },
  }
}
```

### Gradient Fill Helper

```javascript
function createGradient(canvasId, color) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  const h = canvas.parentElement?.clientHeight || 200;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '30');
  grad.addColorStop(1, color + '02');
  return grad;
}
```

### Crosshair Plugin

Dashed vertical line tracking cursor position. Borrow directly from Blue2Scale.

### Time Range Selector

Pill button group: `1W | 1M | 3M | 6M | 1Y | ALL`
Active state: `bg-primary text-white shadow-sm`
Inactive: `text-muted-foreground hover:text-foreground`

### Chart Card Structure

```html
<div class="card card-shadow card-accent-blue chart-card-animate">
  <div class="card-header">
    <h3 class="card-title text-sm font-semibold">Chart Title</h3>
    <div class="flex items-center gap-1">
      <div class="flex items-center bg-muted/60 rounded-lg p-0.5">[Range Pills]</div>
      <button onclick="openFullscreen()" title="Fullscreen">
        <i data-lucide="maximize-2" style="width:14px;height:14px"></i>
      </button>
    </div>
  </div>
  <div class="card-content" style="padding-top:0">
    <div style="position:relative;height:200px"><canvas id="chart-id"></canvas></div>
  </div>
</div>
```

### Chart Color Mapping

| Metric | Chart.js Color | Grad. Accent |
|--------|---------------|-------------|
| Weight | `#3b82f6` | blue |
| Body Fat % | `#f59e0b` | amber |
| Muscle/Lean | `#22c55e` | green |
| Body Composition | `#8b5cf6` | purple |
| Hydration | `#06b6d4` | cyan |
| BMI / Metabolic | `#ec4899` | pink |
| Blood markers | `#14b8a6` | teal |

---

## Layout Patterns

### Navigation — Sidebar + Bottom Tabs

```
Desktop (>1024px): Sticky sidebar (left, ~240px)
Tablet (640-1024px): Collapsible sidebar
Mobile (<640px): Fixed bottom tab bar

Sidebar structure:
  - App logo + name (top)
  - Section: "Health" → Today, Body, Labs
  - Section: "Performance" → Fuel, Training
  - Section: "AI" → Hermes
  - Section: "Settings" → Profile, Export
```

**Active nav item:** `bg-primary text-white shadow-[0_4px_6px_-1px_hsl(var(--primary)/0.3)]`
**Hover:** `bg-(--sidebar-hover-bg)`

### Content Layout — TAB SEPARATION RULE

**CRITICAL:** Each main nav tab is a SEPARATE page with its own focused content. Do NOT put everything on one page with sections, do NOT use accordions to hide/show content.

```
Today tab → summary dashboard (scrolls only its own content)
Body tab  → body composition (scrolls only its own content)
Labs tab  → bloodwork + DNA (scrolls only its own content)
Fuel tab  → diet + supplements (scrolls only its own content)
Train tab → workout log (scrolls only its own content)
Hermes tab → AI chat + reports (scrolls only its own content)
```

**Content density rule:** Each tab's content should fit within ~2-3 viewport heights on desktop. If it grows beyond that, the tab itself is trying to do too much — split into sub-tabs within the tab (like Blue2Scale's Overview/Body Map sub-tabs).

**Within each tab:**
- Compact card grid (2–4 columns)
- `space-y-4` or `space-y-6` gaps
- No full-page scroll accumulation — each card row is meaningful
- Summary cards at top, detail cards below, charts at bottom

### Page Structure Template

```html
<main>
  <div class="space-y-6">
    <!-- Section 1: Summary/stat cards (gradient cards) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
      <!-- 4 gradient stat cards -->
    </div>

    <!-- Section 2: Primary content (cards with accent borders) -->
    <div class="grid lg:grid-cols-2 gap-4">
      <!-- Left: chart or primary view | Right: key metrics or detail -->
    </div>

    <!-- Section 3: Secondary detail (category cards) -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Category cards with metric rows -->
    </div>
  </div>
</main>
```

---

## Animation Patterns

### Staggered Entrance

```css
.stagger-children > * {
  opacity: 0;
  animation: fade-in-up 0.4s ease-out forwards;
}
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 50ms; }
.stagger-children > *:nth-child(3) { animation-delay: 100ms; }
.stagger-children > *:nth-child(4) { animation-delay: 150ms; }
/* ... up to 8 */
```

### Page Transition

```css
main { animation: fade-in-up 0.25s ease-out; }
```

### Chart Entrance

```css
.chart-card-animate {
  animation: fade-in-up 0.4s ease-out both;
}
```

---

## Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page title | DM Sans / system | 1.5rem (2xl) | 700 |
| Card title | DM Sans / system | 0.875rem (sm) | 600 |
| Stat value | JetBrains Mono | 1.875rem (3xl) | 700 |
| Metric label | system | 0.75rem (xs) | 400 |
| Chart tooltip | JetBrains Mono | 0.75rem | 500 |
| Nav items | system | 0.875rem | 500 |
| Body text | system | 0.875rem | 400 |

---

## Icons: Lucide

All icons from Lucide (CDN). Consistent sizing: 16px for inline, 14px for compact, 64px for background decor.

**Health-agent icon mapping:**
- Today: `layout-dashboard`
- Body: `scale` or `person-standing`
- Labs: `flask-conical` or `microscope`
- Fuel: `apple` or `utensils`
- Training: `dumbbell`
- Hermes: `sparkles` or `brain-circuit`

---

## State Management

### Loading State

Blue2Scale pattern: centered spinner with `animate-spin`, hidden when data loads.
```html
<div id="loading" class="flex items-center justify-center py-20">
  <i data-lucide="loader-2" class="h-6 w-6 animate-spin text-muted-foreground"></i>
</div>
```

### Empty State

Centered icon + heading + description + CTA button. Use gradient icon container.
```html
<div class="card card-shadow">
  <div class="card-content flex flex-col items-center justify-center py-16">
    <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 mb-5 shadow-lg">
      <i data-lucide="flask-conical" style="width:40px;height:40px;color:white"></i>
    </div>
    <h2 class="text-xl font-bold mb-2">No lab results yet</h2>
    <p class="text-sm text-muted-foreground text-center max-w-sm mb-5">Add your first bloodwork result.</p>
    <button class="btn btn-primary">Add Lab Result</button>
  </div>
</div>
```

### Error State

Toast notification, top-right, border-left colored. Auto-dismiss or manual close.

---

## What Blue2Scale Does NOT Have (We Add)

These are patterns health-agent needs that Blue2Scale doesn't cover:

1. **Multi-source dashboard** — Blue2Scale is body comp only. We need unified cards pulling from 6+ data types.
2. **Lab result tables with color zones** — Optimal (green), normal (amber), high-risk (red).
3. **AI chat interface** — Hermes tab needs chat bubbles, loading dots, source citations.
4. **Calendar views** — Training tab needs month calendar, diet tab needs day-by-day view.
5. **Adherence tracking** — Supplement check-in calendar, streak indicators.
6. **Score gauges** — Semi-circular or ring gauges for Health Intelligence Score, Readiness Score.
7. **Protocol cards** — Goal-driven recommendation cards with confidence indicators.
8. **Import preview UI** — File upload → parsed data preview → confirm save flow.
9. **Multi-chart correlation views** — Overlay two metrics on same timeline (e.g., supplement adherence vs. lab marker).
10. **Doctor export PDF** — Print-friendly layout, not on-screen dashboard.
