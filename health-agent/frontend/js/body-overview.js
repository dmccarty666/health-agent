/**
 * Health Agent — Body Overview Sub-Tab
 *
 * Self-contained module that fetches body measurement data from the
 * Health Agent API and renders the Overview sub-tab inside the Body
 * dashboard. Follows Blue2Scale /dashboard.js stat-card, donut chart,
 * and category card conventions.
 *
 * Renders five sections:
 *   1. Four gradient stat cards in a 2×2 grid (Weight, Body Fat,
 *      Muscle Mass, Body Water) — each with current value, trend vs
 *      oldest, and a sparkline bar row.
 *   2. Body Composition donut chart (Chart.js) — lean mass vs fat
 *      mass vs water with 62 % cutout, no legend, tooltip values.
 *   3. Key Metrics card (card-accent-teal) — BMI, Visceral Fat, BMR,
 *      Metabolic Age, Bone Mineral with Lucide icons.
 *   4. Three category cards in a 3-column grid — Fat Analysis (amber),
 *      Lean Mass (green), Hydration (cyan).
 *   5. Summary bar — last measured date, this-month count, total count.
 *
 * Target container: #subtab-body-overview (the data-subtab="body-overview"
 * panel inside the Body tab). Falls back to #body-overview if found.
 */

(function () {
  'use strict';

  /* ==================================================================
   * CONSTANTS
   * ================================================================== */

  var API_BASE = (window.HealthAgent && window.HealthAgent.api && window.HealthAgent.api.baseUrl)
    ? window.HealthAgent.api.baseUrl
    : 'http://localhost:8765';

  var CONTAINER_ID = 'subtab-body-overview';   // actual id in index.html
  var FALLBACK_ID   = 'body-overview';          // alternate container ID from task spec

  var CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';

  /* ==================================================================
   * HELPERS
   * ================================================================== */

  /**
   * Format a value for display.  null / undefined → '--'.
   * Numbers are rounded: integers stay whole, fractions get 1 decimal.
   */
  function fmtVal(v) {
    if (v === null || v === undefined) return '--';
    if (typeof v === 'number') {
      return v % 1 === 0 ? String(v) : v.toFixed(1);
    }
    return v;
  }

  /**
   * Compute a delta trend string.
   *   cur  — current value
   *   prev — oldest comparison value
   *   unit — unit label (kg, %, etc.)
   * Returns empty string if prev is invalid or unavailable.
   */
  function trend(cur, prev, unit) {
    if (prev === null || prev === undefined || prev === 0 && cur === 0) return '';
    var diff = cur - prev;
    var sign = diff >= 0 ? '+' : '';
    return sign + diff.toFixed(1) + ' ' + unit + ' vs oldest';
  }

  /**
   * Build a sparkline row of tiny bars from an array of values.
   * Returns empty string when fewer than 2 values exist.
   */
  function sparklineHTML(values, unit) {
    if (!values || values.length < 2) return '';
    var min = Infinity;
    var max = -Infinity;
    for (var i = 0; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
    }
    var range = max - min || 1;
    var bars = '';
    for (var j = 0; j < values.length; j++) {
      var h = Math.max(15, ((values[j] - min) / range) * 100);
      bars += '<div class="flex-1 rounded-sm bg-white/40" ' +
        'style="height:' + h + '%;min-width:3px;max-width:6px" ' +
        'title="' + values[j].toFixed(1) + ' ' + unit + '"></div>';
    }
    return '<div class="flex items-end gap-[2px] mt-2 h-4">' + bars + '</div>';
  }

  /**
   * Extract the last `count` values for a given field from the rows
   * array (most-recent-first).  Returns oldest→newest order for sparklines.
   */
  function getSparkline(rows, key, count) {
    count = count || 7;
    var vals = [];
    var limit = Math.min(count, rows.length);
    for (var i = 0; i < limit; i++) {
      var v = rows[i][key];
      vals.push(v !== null && v !== undefined ? Number(v) : 0);
    }
    return vals.reverse();  // oldest → newest
  }

  /* ==================================================================
   * DATA FETCHING
   * ================================================================== */

  /**
   * Fetch the latest measurement + up to 30 recent measurements from
   * the Health Agent API.  Returns { latest, rows } or null on failure.
   *
   * Uses HealthAgent.api.get() when the app shell is present; falls
   * back to bare fetch() for standalone testing.
   */
  async function fetchData() {
    var apiGet;
    if (window.HealthAgent && window.HealthAgent.api && window.HealthAgent.api.get) {
      apiGet = function (url) { return window.HealthAgent.api.get(url); };
    } else {
      apiGet = function (url) {
        return fetch(API_BASE + url, { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(r); });
      };
    }

    try {
      var results = await Promise.all([
        apiGet('/api/health/measurements/latest'),
        apiGet('/api/health/measurements?limit=30')
      ]);
      var latest = results[0];
      var rows   = results[1];
      // Ensure rows is an array and contains at least `latest`
      if (!Array.isArray(rows)) rows = [];
      return { latest: latest, rows: rows };
    } catch (e) {
      console.error('[body-overview] Failed to fetch measurements:', e);
      return null;
    }
  }

  /* ==================================================================
   * CHART.JS DYNAMIC LOADER
   * ================================================================== */

  /**
   * Guarantee Chart.js is available.  If already loaded, calls back
   * immediately; otherwise injects a <script> tag from CDN.
   */
  function ensureChart(callback) {
    if (window.Chart) return callback();

    var script = document.createElement('script');
    script.src = CHART_CDN;
    script.onload = callback;
    script.onerror = function () {
      console.error('[body-overview] Failed to load Chart.js from CDN');
      callback();  // proceed without chart
    };
    document.head.appendChild(script);
  }

  /* ==================================================================
   * RENDERERS
   * ================================================================== */

  /**
   * Build the 2×2 stat-card grid HTML.
   */
  function renderStatCards(latest, rows) {
    // Sparkline data (last 7 measurements, oldest→newest)
    var wSpark = rows.length > 1 ? getSparkline(rows, 'weight_kg', 7) : null;
    var fSpark = rows.length > 1 ? getSparkline(rows, 'body_fat_pct', 7) : null;
    var mSpark = rows.length > 1 ? getSparkline(rows, 'skel_muscle_kg', 7) : null;
    var hSpark = rows.length > 1 ? getSparkline(rows, 'body_water_pct', 7) : null;

    var oldest = rows.length > 1 ? rows[rows.length - 1] : null;

    var stats = [
      {
        title: 'Weight', value: latest.weight_kg, unit: 'kg',
        gradient: 'stat-card-blue', icon: 'scale',
        trend: oldest ? trend(latest.weight_kg, oldest.weight_kg, 'kg') : '',
        spark: wSpark
      },
      {
        title: 'Body Fat', value: latest.body_fat_pct, unit: '%',
        gradient: 'stat-card-amber', icon: 'activity',
        trend: oldest ? trend(latest.body_fat_pct, oldest.body_fat_pct, '%') : '',
        spark: fSpark
      },
      {
        title: 'Muscle Mass', value: latest.skel_muscle_kg, unit: 'kg',
        gradient: 'stat-card-green', icon: 'dumbbell',
        trend: oldest ? trend(latest.skel_muscle_kg, oldest.skel_muscle_kg, 'kg') : '',
        spark: mSpark
      },
      {
        title: 'Body Water', value: latest.body_water_pct, unit: '%',
        gradient: 'stat-card-cyan', icon: 'droplets',
        trend: oldest ? trend(latest.body_water_pct, oldest.body_water_pct, '%') : '',
        spark: hSpark
      }
    ];

    var html = '<div class="grid grid-cols-2 lg-grid-cols-4 gap-4 stagger-children">';
    for (var i = 0; i < stats.length; i++) {
      var s = stats[i];
      var trendIcon = '';
      var trendHtml = '';
      if (s.trend) {
        trendIcon = s.trend.charAt(0) === '+' ? 'trending-up' : 'trending-down';
        trendHtml = '<div class="flex items-center gap-1 mt-1.5 text-xs text-white/70">' +
          '<i data-lucide="' + trendIcon + '" style="width:12px;height:12px"></i>' +
          '<span>' + s.trend + '</span></div>';
      }
      html += '<div class="stat-card ' + s.gradient + '">' +
        '<div class="stat-card-bg-icon">' +
        '<i data-lucide="' + s.icon + '" style="width:64px;height:64px"></i>' +
        '</div>' +
        '<div class="relative z-10">' +
        '<p class="text-xs font-medium text-white/80 uppercase tracking-wider">' + s.title + '</p>' +
        '<div class="flex items-baseline gap-1.5 mt-1">' +
        '<span class="text-3xl font-bold font-mono">' + fmtVal(s.value) + '</span>' +
        '<span class="text-sm font-medium text-white/70">' + s.unit + '</span>' +
        '</div>' +
        trendHtml +
        (s.spark ? sparklineHTML(s.spark, s.unit) : '') +
        '</div></div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Build the Body Composition card with donut chart canvas + side legend.
   */
  function renderCompositionCard(latest) {
    // Compute values, filling nulls where possible
    var fatMass = latest.fat_mass_kg != null ? Number(latest.fat_mass_kg) : 0;
    var leanMass = latest.lean_mass_kg != null
      ? Number(latest.lean_mass_kg)
      : (latest.weight_kg != null ? Number(latest.weight_kg) - fatMass : 0);
    var waterKg  = latest.total_water_kg != null
      ? Number(latest.total_water_kg)
      : (latest.weight_kg != null && latest.body_water_pct != null
        ? Number(latest.weight_kg) * Number(latest.body_water_pct) / 100 : 0);

    // Lean % — compute if missing
    var leanPct = latest.lean_mass_pct != null
      ? Number(latest.lean_mass_pct)
      : (latest.weight_kg != null && latest.weight_kg > 0
        ? (leanMass / Number(latest.weight_kg)) * 100 : 0);

    var html = '<div class="grid lg-grid-cols-2 gap-4" style="margin-top:1.5rem">' +

      // --- Donut card ---
      '<div class="card card-shadow card-accent-blue">' +
      '<div class="card-header">' +
      '<h3 class="card-title text-base font-semibold">Body Composition</h3>' +
      '</div>' +
      '<div class="card-content">' +
      '<div class="flex items-center gap-6">' +
      '<div class="w-44 h-44 flex-shrink-0"><canvas id="body-overview-donut"></canvas></div>' +
      '<div class="flex-1 space-y-3">' +
      '<div class="flex items-center justify-between">' +
      '<div class="flex items-center gap-2"><div class="h-3 w-3 rounded-full bg-blue-500"></div>' +
      '<span class="text-sm">Lean Mass</span></div>' +
      '<span class="font-mono text-sm font-semibold">' + fmtVal(leanMass) + ' kg</span></div>' +
      '<div class="flex items-center justify-between">' +
      '<div class="flex items-center gap-2"><div class="h-3 w-3 rounded-full bg-amber-500"></div>' +
      '<span class="text-sm">Fat Mass</span></div>' +
      '<span class="font-mono text-sm font-semibold">' + fmtVal(fatMass) + ' kg</span></div>' +
      '<div class="flex items-center justify-between">' +
      '<div class="flex items-center gap-2"><div class="h-3 w-3 rounded-full bg-cyan-500"></div>' +
      '<span class="text-sm">Water</span></div>' +
      '<span class="font-mono text-sm font-semibold">' + fmtVal(waterKg) + ' kg</span></div>' +
      '<div class="pt-2 border-t border-border">' +
      '<div class="flex items-center justify-between">' +
      '<span class="text-sm font-medium">Lean %</span>' +
      '<span class="font-mono text-lg font-bold text-blue-500">' + Math.round(leanPct) + '%</span>' +
      '</div></div>' +
      '</div></div></div></div>' +

      // --- Key Metrics card ---
      renderKeyMetricsCard(latest) +

      '</div>';  // close .grid

    return { html: html, donutData: { leanMass: leanMass, fatMass: fatMass, waterKg: waterKg } };
  }

  /**
   * Build the Key Metrics card (card-accent-teal).
   */
  function renderKeyMetricsCard(latest) {
    var metrics = [
      { label: 'BMI',           value: latest.bmi,            unit: '',     icon: 'heart',       color: 'text-blue-500' },
      { label: 'Visceral Fat',  value: latest.visceral_fat,   unit: '',     icon: 'activity',    color: 'text-red-500' },
      { label: 'BMR',           value: latest.bmr_kcal,       unit: 'kcal', icon: 'flame',       color: 'text-amber-500' },
      { label: 'Metabolic Age', value: latest.metabolic_age,  unit: 'yrs',  icon: 'zap',         color: 'text-purple-500' },
      { label: 'Bone Mineral',  value: latest.bone_mineral_kg, unit: 'kg',  icon: 'dumbbell',    color: 'text-teal-500' }
    ];

    var html = '<div class="card card-shadow card-accent-teal">' +
      '<div class="card-header">' +
      '<h3 class="card-title text-base font-semibold">Key Metrics</h3>' +
      '</div>' +
      '<div class="card-content"><div class="space-y-2.5">';

    for (var i = 0; i < metrics.length; i++) {
      var m = metrics[i];
      html += '<div class="flex items-center justify-between py-2 border-b border-border last:border-0">' +
        '<div class="flex items-center gap-2.5">' +
        '<i data-lucide="' + m.icon + '" style="width:16px;height:16px" class="' + m.color + '"></i>' +
        '<span class="text-sm">' + m.label + '</span></div>' +
        '<span class="font-mono text-sm font-bold">' + fmtVal(m.value) +
        (m.unit ? '<span class="text-xs text-muted-foreground ml-1 font-normal">' + m.unit + '</span>' : '') +
        '</span></div>';
    }

    html += '</div></div></div>';
    return html;
  }

  /**
   * Build the three category cards in a 3-column grid.
   */
  function renderCategoryCards(latest) {
    var categories = [
      {
        title: 'Fat Analysis', accent: 'card-accent-amber', dotColor: 'bg-amber-500',
        items: [
          { label: 'Body Fat',     value: latest.body_fat_pct,  unit: '%' },
          { label: 'Subcut. Fat',  value: latest.subcut_fat_kg, unit: 'kg' },
          { label: 'Visceral Fat', value: latest.visceral_fat,  unit: '' },
          { label: 'Android Fat',  value: latest.android_fat_kg, unit: 'kg' }
        ]
      },
      {
        title: 'Lean Mass', accent: 'card-accent-green', dotColor: 'bg-green-500',
        items: [
          { label: 'Lean Mass',   value: latest.lean_mass_kg,    unit: 'kg' },
          { label: 'Lean %',      value: latest.lean_mass_pct,   unit: '%' },
          { label: 'Muscle',      value: latest.skel_muscle_kg,  unit: 'kg' },
          { label: 'Cell Mass',   value: latest.body_cell_mass_kg, unit: 'kg' }
        ]
      },
      {
        title: 'Hydration', accent: 'card-accent-cyan', dotColor: 'bg-cyan-500',
        items: [
          { label: 'Body Water',   value: latest.body_water_pct,  unit: '%' },
          { label: 'Total Water',  value: latest.total_water_kg,  unit: 'kg' },
          { label: 'ECW',          value: latest.ecw_kg,          unit: 'kg' },
          { label: 'ICW',          value: latest.icw_kg,          unit: 'kg' }
        ]
      }
    ];

    var html = '<div class="grid grid-cols-1 md:grid-cols-3 gap-4" style="margin-top:1.5rem">';
    for (var c = 0; c < categories.length; c++) {
      var cat = categories[c];
      html += '<div class="card card-shadow ' + cat.accent + '">' +
        '<div class="card-header" style="padding-bottom:0.75rem">' +
        '<div class="flex items-center gap-2">' +
        '<div class="h-2 w-2 rounded-full ' + cat.dotColor + '"></div>' +
        '<h3 class="card-title text-sm font-semibold uppercase tracking-wide">' + cat.title + '</h3>' +
        '</div></div>' +
        '<div class="card-content space-y-2">';
      for (var i = 0; i < cat.items.length; i++) {
        var m = cat.items[i];
        html += '<div class="flex justify-between items-center">' +
          '<span class="text-xs text-muted-foreground">' + m.label + '</span>' +
          '<span class="font-mono text-xs font-semibold">' + fmtVal(m.value) +
          (m.unit ? '<span class="text-muted-foreground ml-0.5">' + m.unit + '</span>' : '') +
          '</span></div>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Build the summary bar at the bottom.
   */
  function renderSummaryBar(rows) {
    if (!rows || rows.length === 0) return '';

    var lastDate = new Date(rows[0].measured_at);
    var now = new Date();

    var monthCount = 0;
    for (var i = 0; i < rows.length; i++) {
      var d = new Date(rows[i].measured_at);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        monthCount++;
      }
    }

    var dateStr = lastDate.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    return '<div class="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg bg-muted/50 text-sm text-muted-foreground" style="margin-top:1.5rem">' +
      '<span>Last measured: <span class="font-semibold text-foreground">' + dateStr + '</span></span>' +
      '<span class="hidden sm:inline text-border">|</span>' +
      '<span>This month: <span class="font-semibold text-foreground">' + monthCount + '</span></span>' +
      (rows.length > 1
        ? '<span class="hidden sm:inline text-border">|</span>' +
          '<span>Total: <span class="font-semibold text-foreground">' + rows.length + '</span></span>'
        : '') +
      '</div>';
  }

  /**
   * Render the Chart.js donut for body composition.
   */
  function renderDonut(donutData) {
    var ctx = document.getElementById('body-overview-donut');
    if (!ctx || !window.Chart) return;

    new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Lean Mass', 'Fat Mass', 'Water'],
        datasets: [{
          data: [donutData.leanMass, donutData.fatMass, donutData.waterKg],
          backgroundColor: ['#3b82f6', '#f59e0b', '#06b6d4'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '62%',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.label + ': ' + ctx.parsed.toFixed(1) + ' kg';
              }
            }
          }
        }
      }
    });
  }

  /* ==================================================================
   * MAIN
   * ================================================================== */

  /**
   * Top-level render orchestrator.  Fetches data, builds all five
   * sections, injects into the DOM, initializes Chart.js, and
   * refreshes Lucide icons.
   */
  async function render() {
    // Resolve target container
    var container = document.getElementById(CONTAINER_ID) || document.getElementById(FALLBACK_ID);
    if (!container) {
      console.warn('[body-overview] Container #' + CONTAINER_ID + ' / #' + FALLBACK_ID + ' not found — skipping render');
      return;
    }

    // Show loading state
    container.innerHTML = '<div class="loading-container">' +
      '<i data-lucide="loader-2" class="loading-spinner"></i>' +
      '</div>';
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

    // Fetch data
    var data = await fetchData();
    if (!data || !data.latest) {
      container.innerHTML = '<div class="empty-state">' +
        '<div class="empty-state-icon">' +
        '<i data-lucide="scale" style="width:40px;height:40px;color:white"></i>' +
        '</div>' +
        '<h2 class="empty-state-title">No body data yet</h2>' +
        '<p class="empty-state-desc">Take a measurement to see your body composition overview.</p>' +
        '</div>';
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
      return;
    }

    var latest = data.latest;
    var rows   = data.rows;

    // Build all sections
    var html = '';

    // 1. Stat cards
    html += renderStatCards(latest, rows);

    // 2. Body Composition + Key Metrics
    var compResult = renderCompositionCard(latest);
    html += compResult.html;

    // 3. Category cards
    html += renderCategoryCards(latest);

    // 4. Summary bar
    html += renderSummaryBar(rows);

    // Inject into container
    container.innerHTML = html;

    // Refresh Lucide icons
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

    // Render donut chart (Chart.js may need dynamic loading)
    ensureChart(function () {
      renderDonut(compResult.donutData);
    });
  }

  /* ==================================================================
   * BOOTSTRAP
   * ================================================================== */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

})();
