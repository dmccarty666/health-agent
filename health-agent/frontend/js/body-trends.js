/**
 * Health Agent — Body Trends Charts
 *
 * Renders Chart.js line charts for body measurement trends over time.
 * Includes gradient fills, crosshair plugin, dark-aware theming,
 * per-chart time range pills, fullscreen button, and custom metric selector.
 * Ported from Blue2Scale.com charts-page.js patterns.
 */

(function () {
  'use strict';

  /* ================================================================
   * CONSTANTS
   * ================================================================ */

  /** All valid measurement field names — mirrors backend ALL_METRIC_COLUMNS */
  var ALL_METRIC_FIELDS = [
    'weight_kg', 'bmi', 'body_fat_pct', 'fat_mass_kg',
    'subcut_fat_kg', 'subcut_fat_pct', 'visceral_fat',
    'android_fat_kg', 'gynoid_fat_kg', 'ag_ratio_pct',
    'lean_mass_kg', 'lean_mass_pct', 'skel_muscle_kg',
    'body_cell_mass_kg', 'body_water_pct', 'total_water_kg',
    'ecw_kg', 'icw_kg', 'bone_mineral_kg', 'mineral_mass_kg',
    'skeletal_mass_kg', 'organ_mass_kg', 'bmr_kcal', 'metabolic_age'
  ];

  /** Friendly labels for metric fields */
  var METRIC_LABELS = {
    weight_kg: 'Weight (lbs)',
    bmi: 'BMI',
    body_fat_pct: 'Body Fat %',
    fat_mass_kg: 'Fat Mass (lbs)',
    subcut_fat_kg: 'Subcut Fat (lbs)',
    subcut_fat_pct: 'Subcut Fat %',
    visceral_fat: 'Visceral Fat',
    android_fat_kg: 'Android Fat (lbs)',
    gynoid_fat_kg: 'Gynoid Fat (lbs)',
    ag_ratio_pct: 'A/G Ratio %',
    lean_mass_kg: 'Lean Mass (lbs)',
    lean_mass_pct: 'Lean Mass %',
    skel_muscle_kg: 'Skeletal Muscle (lbs)',
    body_cell_mass_kg: 'Body Cell Mass (lbs)',
    body_water_pct: 'Body Water %',
    total_water_kg: 'Total Water (lbs)',
    ecw_kg: 'ECW (lbs)',
    icw_kg: 'ICW (lbs)',
    bone_mineral_kg: 'Bone Mineral (lbs)',
    mineral_mass_kg: 'Mineral Mass (lbs)',
    skeletal_mass_kg: 'Skeletal Mass (lbs)',
    organ_mass_kg: 'Organ Mass (lbs)',
    bmr_kcal: 'BMR (kcal)',
    metabolic_age: 'Metabolic Age'
  };

  /** Time range presets — each maps to a limit for the API */
  var TIME_RANGES = {
    '1W':  { label: '1W',  days: 7,  limit: 7  },
    '1M':  { label: '1M',  days: 30, limit: 30 },
    '3M':  { label: '3M',  days: 90, limit: 90 },
    '6M':  { label: '6M',  days: 180, limit: 90 },
    '1Y':  { label: '1Y',  days: 365, limit: 90 },
    'ALL': { label: 'ALL', days: 3650, limit: 90 }
  };

  var DEFAULT_RANGE = '3M';

  /* ================================================================
   * WEIGHT CONVERSION HELPERS
   * ================================================================ */

  /**
   * Convert kg to lbs for display.  null/undefined → '--'.
   * Conversion: lbs = kg × 2.20462
   */
  function fmtWeight(kg) {
    if (kg === null || kg === undefined) return '--';
    var lbs = Number(kg) * 2.20462;
    return lbs % 1 === 0 ? String(Math.round(lbs)) : lbs.toFixed(1);
  }

  /** Return true if a metric field holds a kg weight (not pct/bmi/kcal/age). */
  function isWeightField(field) {
    return typeof field === 'string' && field.endsWith('_kg');
  }

  /* ================================================================
   * CHART DEFINITIONS
   * ================================================================ */

  /**
   * Each chart definition specifies:
   *   id            — DOM container id suffix
   *   title         — card header title
   *   accentClass   — card-accent-* class
   *   accentDot     — accent dot color for header
   *   metrics       — API metric field names
   *   datasets      — Chart.js dataset configs (each: key, label, color, yAxisID, fill, dashed)
   *   stacked       — if true, use stacked layout
   *   dualAxis      — if true, dual y-axes (left + right)
   */
  var CHART_DEFS = [
    {
      id: 'weight-trend',
      title: 'Weight Trend',
      accentClass: 'card-accent-blue',
      accentDot: '#3b82f6',
      metrics: ['weight_kg'],
      datasets: [
        { key: 'weight_kg', label: 'Weight', color: '#3b82f6', yAxisID: 'y', fill: true }
      ],
      stacked: false,
      dualAxis: false
    },
    {
      id: 'bodyfat-trend',
      title: 'Body Fat %',
      accentClass: 'card-accent-amber',
      accentDot: '#f59e0b',
      metrics: ['body_fat_pct'],
      datasets: [
        { key: 'body_fat_pct', label: 'Body Fat %', color: '#f59e0b', yAxisID: 'y', fill: true }
      ],
      stacked: false,
      dualAxis: false
    },
    {
      id: 'muscle-lean-trend',
      title: 'Muscle & Lean Mass',
      accentClass: 'card-accent-green',
      accentDot: '#22c55e',
      metrics: ['skel_muscle_kg', 'lean_mass_kg'],
      datasets: [
        { key: 'skel_muscle_kg', label: 'Skeletal Muscle', color: '#22c55e', yAxisID: 'y', fill: true },
        { key: 'lean_mass_kg', label: 'Lean Mass', color: '#4ade80', yAxisID: 'y', fill: true, dashed: true }
      ],
      stacked: false,
      dualAxis: false
    },
    {
      id: 'bodycomp-stacked',
      title: 'Body Composition',
      accentClass: 'card-accent-purple',
      accentDot: '#8b5cf6',
      metrics: ['fat_mass_kg', 'lean_mass_kg', 'bone_mineral_kg'],
      datasets: [
        { key: 'fat_mass_kg', label: 'Fat Mass', color: '#a78bfa', yAxisID: 'y', fill: true },
        { key: 'lean_mass_kg', label: 'Lean Mass', color: '#8b5cf6', yAxisID: 'y', fill: true },
        { key: 'bone_mineral_kg', label: 'Bone', color: '#c4b5fd', yAxisID: 'y', fill: true }
      ],
      stacked: true,
      dualAxis: false
    },
    {
      id: 'hydration-trend',
      title: 'Hydration',
      accentClass: 'card-accent-cyan',
      accentDot: '#06b6d4',
      metrics: ['body_water_pct', 'ecw_kg', 'icw_kg'],
      datasets: [
        { key: 'body_water_pct', label: 'Body Water %', color: '#06b6d4', yAxisID: 'y', fill: true },
        { key: 'ecw_kg', label: 'ECW', color: '#22d3ee', yAxisID: 'y1', fill: true },
        { key: 'icw_kg', label: 'ICW', color: '#67e8f9', yAxisID: 'y1', fill: true }
      ],
      stacked: false,
      dualAxis: true
    },
    {
      id: 'bmi-metabolic-trend',
      title: 'BMI & Metabolic Age',
      accentClass: 'card-accent-pink',
      accentDot: '#ec4899',
      metrics: ['bmi', 'metabolic_age'],
      datasets: [
        { key: 'bmi', label: 'BMI', color: '#ec4899', yAxisID: 'y', fill: true },
        { key: 'metabolic_age', label: 'Metabolic Age', color: '#f472b6', yAxisID: 'y1', fill: true }
      ],
      stacked: false,
      dualAxis: true
    }
  ];

  /** Custom metric chart template (generated dynamically) */
  var CUSTOM_CHART_DEF = {
    id: 'custom-metric-trend',
    title: 'Custom Metric',
    accentClass: 'card-accent-teal',
    accentDot: '#14b8a6',
    metrics: ['weight_kg'],
    datasets: [
      { key: 'weight_kg', label: 'Weight', color: '#14b8a6', yAxisID: 'y', fill: true }
    ],
    stacked: false,
    dualAxis: false
  };

  /* ================================================================
   * STATE
   * ================================================================ */

  /** Map: chartId -> { instance: Chart, range: string, container: Element } */
  var activeCharts = {};
  var customMetricSelection = 'weight_kg';

  /* ================================================================
   * THEME DETECTION
   * ================================================================ */

  /** Return true if dark mode is active */
  function isDarkMode() {
    return document.documentElement.classList.contains('dark') ||
           (!document.documentElement.classList.contains('light') &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /** Get the current theme-appropriate text color */
  function getTextColor() {
    return isDarkMode() ? '#94a3b8' : '#64748b';
  }

  /** Get the current theme-appropriate grid color */
  function getGridColor() {
    return isDarkMode() ? 'rgba(148,163,184,0.1)' : 'rgba(100,116,139,0.12)';
  }

  /* ================================================================
   * CHART.JS PLUGINS
   * ================================================================ */

  /**
   * Crosshair plugin — shows vertical/horizontal guide lines on hover.
   * Follows cursor position within the chart area.
   */
  var crosshairPlugin = {
    id: 'crosshair',
    afterInit: function (chart) {
      chart.crosshair = { x: null, y: null };
    },
    afterEvent: function (chart, args) {
      var event = args.event;
      if (!event || !event.native) return;
      var native = event.native;

      if (native.type === 'mousemove') {
        var rect = chart.canvas.getBoundingClientRect();
        chart.crosshair.x = native.clientX - rect.left;
        chart.crosshair.y = native.clientY - rect.top;
        chart.draw();
      } else if (native.type === 'mouseout') {
        chart.crosshair.x = null;
        chart.crosshair.y = null;
        chart.draw();
      }
    },
    afterDraw: function (chart) {
      var ctx = chart.ctx;
      var x = chart.crosshair.x;
      var y = chart.crosshair.y;
      var chartArea = chart.chartArea;

      if (x == null || y == null) return;
      if (x < chartArea.left || x > chartArea.right ||
          y < chartArea.top || y > chartArea.bottom) return;

      /* Only draw if a tooltip would be active */
      var active = chart.tooltip && chart.tooltip.getActiveElements &&
                   chart.tooltip.getActiveElements().length > 0;
      if (!active) return;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDarkMode() ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.25)';

      /* Vertical line */
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();

      /* Horizontal line */
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();

      ctx.restore();
    }
  };

  /**
   * Custom animation easing: easeOutQuart
   * t: elapsed time ratio (0..1), returns eased ratio (0..1)
   */
  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  /* ================================================================
   * CHART FACTORY
   * ================================================================ */

  /**
   * Build Chart.js config from a chart definition.
   *
   * @param {object} def — chart definition from CHART_DEFS
   * @param {Array} trendData — API response (array of TrendPoint)
   * @returns {object} Chart.js configuration object
   */
  function buildChartConfig(def, trendData) {
    if (!trendData || trendData.length === 0) return null;

    /* Extract labels from measured_at */
    var labels = trendData.map(function (d) {
      var dt = new Date(d.measured_at);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    /* Build datasets */
    var datasets = def.datasets.map(function (dsDef, idx) {
      var data = trendData.map(function (d) {
        var v = d.metrics[dsDef.key];
        if (v != null && !isNaN(v)) {
          var num = Number(v);
          return isWeightField(dsDef.key) ? num * 2.20462 : num;
        }
        return null;
      });

      var ds = {
        label: dsDef.label,
        data: data,
        borderColor: dsDef.color,
        backgroundColor: dsDef.color,
        yAxisID: dsDef.yAxisID || 'y',
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: dsDef.color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        borderWidth: 2,
        fill: dsDef.fill !== false ? { target: 'origin', above: dsDef.color + '33', below: dsDef.color + '08' } : false
      };

      /* Dashed line for secondary datasets */
      if (dsDef.dashed) {
        ds.borderDash = [6, 3];
        ds.borderWidth = 1.5;
      }

      return ds;
    });

    /* Y-axes configuration */
    var yAxes = {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: { color: getGridColor(), drawBorder: false },
        ticks: { color: getTextColor(), font: { size: 10 }, padding: 6, maxTicksLimit: 5 },
        title: { display: false }
      }
    };

    if (def.dualAxis) {
      yAxes.y1 = {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false, drawBorder: false },
        ticks: { color: getTextColor(), font: { size: 10 }, padding: 6, maxTicksLimit: 5 },
        title: { display: false }
      };
    }

    return {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: yAxes,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyleWidth: 8,
              padding: 16,
              color: getTextColor(),
              font: { size: 10 },
              boxWidth: 8,
              boxHeight: 8
            }
          },
          tooltip: {
            backgroundColor: isDarkMode() ? '#1e293b' : '#ffffff',
            titleColor: isDarkMode() ? '#e2e8f0' : '#1e293b',
            bodyColor: isDarkMode() ? '#cbd5e1' : '#475569',
            borderColor: isDarkMode() ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            padding: 10,
            displayColors: true,
            boxPadding: 4
          }
        },
        layout: {
          padding: { top: 8, right: 8, bottom: 0, left: 0 }
        }
      },
      plugins: [crosshairPlugin]
    };
  }

  /**
   * Create a gradient fill for a dataset from the chart context.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} color — hex color (e.g. '#3b82f6')
   * @returns {CanvasGradient}
   */
  function createGradient(ctx, color) {
    var gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, color + '33');
    gradient.addColorStop(0.5, color + '14');
    gradient.addColorStop(1, color + '00');
    return gradient;
  }

  /* ================================================================
   * CHART RENDERING
   * ================================================================ */

  /**
   * Render a single chart card into the container.
   *
   * @param {object} def — chart definition
   * @param {Element} container — parent element to append into
   * @param {Array} trendData — API trend data
   * @param {string} range — active time range key (e.g. '3M')
   */
  function renderChartCard(def, container, trendData, range) {
    range = range || DEFAULT_RANGE;

    var cardId = 'chart-card-' + def.id;
    var canvasId = 'chart-canvas-' + def.id;

    /* Build card HTML */
    var html = '<div class="card card-shadow ' + def.accentClass + ' chart-card-animate" id="' + cardId + '">';

    /* Header */
    html += '<div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">';
    html += '<div class="flex items-center gap-2">';
    html += '<div style="height:0.5rem;width:0.5rem;border-radius:50%;background:' + def.accentDot + '"></div>';
    html += '<h3 class="card-title uppercase tracking-wide text-sm font-semibold">' + def.title + '</h3>';
    if (def.stacked) {
      html += '<span class="badge badge-purple" style="font-size:9px">STACKED</span>';
    }
    html += '</div>';

    /* Time range pills + fullscreen */
    html += '<div class="flex items-center gap-1">';
    var rangeKeys = Object.keys(TIME_RANGES);
    for (var ri = 0; ri < rangeKeys.length; ri++) {
      var rk = rangeKeys[ri];
      var activeClass = rk === range ? ' btn-primary' : ' btn-ghost';
      html += '<button class="btn btn-sm' + activeClass + ' trend-range-btn" data-chart="' + def.id + '" data-range="' + rk + '" style="font-size:10px;padding:2px 8px">' + TIME_RANGES[rk].label + '</button>';
    }
    html += '<button class="btn btn-sm btn-ghost trend-fullscreen-btn" data-chart="' + def.id + '" style="font-size:10px;padding:2px 8px;margin-left:4px" title="Fullscreen">';
    html += '<i data-lucide="maximize-2" style="width:12px;height:12px"></i>';
    html += '</button>';
    html += '</div>';
    html += '</div>'; /* .card-header */

    /* Chart area */
    html += '<div class="card-content chart-container" style="padding-top:0;position:relative;min-height:280px">';
    if (trendData && trendData.length > 0) {
      html += '<div style="position:relative;height:260px"><canvas id="' + canvasId + '"></canvas></div>';
    } else {
      html += '<div class="body-map-placeholder" style="min-height:200px">';
      html += '<div class="text-center">';
      html += '<i data-lucide="line-chart" style="width:48px;height:48px;color:hsl(var(--muted-foreground) / 0.3);margin-bottom:0.75rem"></i>';
      html += '<p>No trend data available</p>';
      html += '<p class="text-xs text-muted mt-1">Record measurements to see trends</p>';
      html += '</div></div>';
    }
    html += '</div>';
    html += '</div>'; /* .card */

    container.insertAdjacentHTML('beforeend', html);

    /* Initialize Chart.js if we have data */
    if (trendData && trendData.length > 0) {
      setTimeout(function () {
        initChart(def, trendData, range);
      }, 50);
    }

    /* Wire up handlers for this card */
    setTimeout(function () {
      wireCardHandlers(def.id);
    }, 50);
  }

  /**
   * Initialize a single Chart.js instance.
   */
  function initChart(def, trendData, range) {
    var canvasId = 'chart-canvas-' + def.id;
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    /* Destroy existing instance if any */
    if (activeCharts[def.id] && activeCharts[def.id].instance) {
      activeCharts[def.id].instance.destroy();
    }

    var config = buildChartConfig(def, trendData);
    if (!config) {
      HealthAgent.ui.showError('#chart-card-' + def.id + ' .chart-container',
        'Could not build chart configuration.');
      return;
    }

    /* Register easing before first chart creation */
    if (!Chart.defaults.animation) Chart.defaults.animation = {};
    /* Override the easing function reference */
    var origEasing = config.options.animation.easing;
    config.options.animation.easing = 'easeOutQuart';

    var ctx = canvas.getContext('2d');
    var chartInstance = new Chart(ctx, config);

    activeCharts[def.id] = {
      instance: chartInstance,
      range: range,
      def: def,
      container: document.getElementById('chart-card-' + def.id)
    };

    /* Apply gradient fills post-initialization */
    applyGradientFills(chartInstance, def);
  }

  /**
   * Post-init: swap solid fill colors with canvas gradients.
   */
  function applyGradientFills(chart, def) {
    var ctx = chart.ctx;
    chart.data.datasets.forEach(function (ds, idx) {
      var color = def.datasets[idx] ? def.datasets[idx].color : '#3b82f6';
      ds.backgroundColor = createGradient(ctx, color);
    });
    chart.update('none');
  }

  /* ================================================================
   * EVENT HANDLERS
   * ================================================================ */

  /** Wire range pill clicks and fullscreen button for a chart card */
  function wireCardHandlers(chartId) {
    /* Time range pills */
    var rangeBtns = document.querySelectorAll('.trend-range-btn[data-chart="' + chartId + '"]');
    for (var i = 0; i < rangeBtns.length; i++) {
      rangeBtns[i].addEventListener('click', function () {
        var defId = this.getAttribute('data-chart');
        var range = this.getAttribute('data-range');
        switchTimeRange(defId, range);
      });
    }

    /* Fullscreen button */
    var fsBtn = document.querySelector('.trend-fullscreen-btn[data-chart="' + chartId + '"]');
    if (fsBtn) {
      fsBtn.addEventListener('click', function () {
        var defId = this.getAttribute('data-chart');
        toggleFullscreen(defId);
      });
    }
  }

  /** Switch a chart's time range — refetch and re-render */
  function switchTimeRange(chartId, rangeKey) {
    var chartState = activeCharts[chartId];
    if (!chartState) return;

    var def = chartState.def;
    var timeRange = TIME_RANGES[rangeKey];
    if (!timeRange) return;

    /* Update active pill buttons in DOM */
    var cardEl = chartState.container;
    var pills = cardEl.querySelectorAll('.trend-range-btn');
    for (var i = 0; i < pills.length; i++) {
      var btn = pills[i];
      if (btn.getAttribute('data-range') === rangeKey) {
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-ghost');
      }
    }

    /* Show loading spinner in chart area during range switch */
    var chartContainer = cardEl.querySelector('.chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = '<div class="loading-container" style="padding:2rem 0;min-height:260px">' +
        '<i data-lucide="loader-2" class="loading-spinner" style="width:24px;height:24px"></i>' +
        '<p class="text-xs text-muted mt-2">Loading ' + TIME_RANGES[rangeKey].label + ' data…</p>' +
        '</div>';
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }

    /* Fetch new data for this range */
    var metricsParam = def.metrics.join(',');
    HealthAgent.api.get('/api/health/measurements/trends?metrics=' + metricsParam + '&limit=' + timeRange.limit)
      .then(function (trendData) {
        initChart(def, trendData, rangeKey);
        wireCardHandlers(chartId);
      })
      .catch(function (err) {
        console.error('[body-trends] Range switch failed for ' + chartId + ' (range: ' + rangeKey + '):', err);
        /* Show error with retry button in chart container */
        if (chartContainer) {
          chartContainer.innerHTML = '<div style="text-align:center;padding:2rem;min-height:260px">' +
            '<i data-lucide="alert-triangle" style="width:24px;height:24px;color:#ef4444;margin-bottom:0.5rem"></i>' +
            '<p style="font-weight:600;margin-bottom:0.25rem">Failed to load ' + TIME_RANGES[rangeKey].label + ' data</p>' +
            '<p class="text-xs text-muted mb-2">' + (err.message || 'Unknown error') + '</p>' +
            '<button class="btn btn-sm btn-primary" onclick="HealthAgent.bodyTrends._retryRange(\'' + chartId + '\',\'' + rangeKey + '\')">Retry</button>' +
            '</div>';
          if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
          }
        }
      });
  }

  /** Toggle fullscreen mode for a chart card */
  function toggleFullscreen(chartId) {
    var cardEl = document.getElementById('chart-card-' + chartId);
    if (!cardEl) return;

    if (cardEl.classList.contains('chart-fullscreen')) {
      /* Exit fullscreen */
      cardEl.classList.remove('chart-fullscreen');
      document.body.style.overflow = '';

      /* Resize chart */
      if (activeCharts[chartId] && activeCharts[chartId].instance) {
        activeCharts[chartId].instance.resize();
      }
    } else {
      /* Enter fullscreen */
      cardEl.classList.add('chart-fullscreen');
      document.body.style.overflow = 'hidden';

      /* Resize chart */
      if (activeCharts[chartId] && activeCharts[chartId].instance) {
        activeCharts[chartId].instance.resize();
      }
    }
  }

  /* Escape key exits fullscreen */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var fs = document.querySelector('.chart-fullscreen');
      if (fs) {
        fs.classList.remove('chart-fullscreen');
        document.body.style.overflow = '';
        /* Resize all visible charts */
        for (var cid in activeCharts) {
          if (activeCharts.hasOwnProperty(cid) && activeCharts[cid].instance) {
            activeCharts[cid].instance.resize();
          }
        }
      }
    }
  });

  /* ================================================================
   * CUSTOM METRIC CHART
   * ================================================================ */

  /**
   * Render the custom metric card with dropdown selector.
   */
  function renderCustomMetricCard(container) {
    var def = CUSTOM_CHART_DEF;

    var cardId = 'chart-card-' + def.id;
    var canvasId = 'chart-canvas-' + def.id;

    /* Build dropdown options */
    var optionsHtml = '';
    for (var i = 0; i < ALL_METRIC_FIELDS.length; i++) {
      var f = ALL_METRIC_FIELDS[i];
      var selected = f === customMetricSelection ? ' selected' : '';
      optionsHtml += '<option value="' + f + '"' + selected + '>' + (METRIC_LABELS[f] || f) + '</option>';
    }

    var html = '<div class="card card-shadow ' + def.accentClass + ' chart-card-animate" id="' + cardId + '">';

    /* Header */
    html += '<div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">';
    html += '<div class="flex items-center gap-2">';
    html += '<div style="height:0.5rem;width:0.5rem;border-radius:50%;background:' + def.accentDot + '"></div>';
    html += '<h3 class="card-title uppercase tracking-wide text-sm font-semibold">Custom Metric</h3>';
    html += '</div>';

    /* Dropdown + time range pills */
    html += '<div class="flex items-center gap-2">';
    html += '<select class="custom-metric-select" id="custom-metric-dropdown" style="font-size:10px;padding:2px 6px;background:hsl(var(--card));color:hsl(var(--foreground));border:1px solid hsl(var(--border));border-radius:4px">' + optionsHtml + '</select>';
    var rangeKeys = Object.keys(TIME_RANGES);
    for (var ri = 0; ri < rangeKeys.length; ri++) {
      var rk = rangeKeys[ri];
      var activeClass = rk === DEFAULT_RANGE ? ' btn-primary' : ' btn-ghost';
      html += '<button class="btn btn-sm' + activeClass + ' trend-range-btn" data-chart="' + def.id + '" data-range="' + rk + '" style="font-size:10px;padding:2px 8px">' + TIME_RANGES[rk].label + '</button>';
    }
    html += '<button class="btn btn-sm btn-ghost trend-fullscreen-btn" data-chart="' + def.id + '" style="font-size:10px;padding:2px 8px;margin-left:4px" title="Fullscreen">';
    html += '<i data-lucide="maximize-2" style="width:12px;height:12px"></i>';
    html += '</button>';
    html += '</div>';
    html += '</div>';

    /* Chart area */
    html += '<div class="card-content chart-container" style="padding-top:0;position:relative;min-height:280px">';
    html += '<div style="position:relative;height:260px"><canvas id="' + canvasId + '"></canvas></div>';
    html += '</div>';
    html += '</div>';

    container.insertAdjacentHTML('beforeend', html);

    /* Wire dropdown */
    setTimeout(function () {
      var dropdown = document.getElementById('custom-metric-dropdown');
      if (dropdown) {
        dropdown.addEventListener('change', function () {
          customMetricSelection = this.value;
          updateCustomChart(def);
        });
      }
      wireCardHandlers(def.id);
    }, 50);

    /* Fetch initial data */
    updateCustomChart(def);
  }

  /**
   * Fetch data for the custom metric and re-render its chart.
   */
  function updateCustomChart(def) {
    var range = DEFAULT_RANGE;
    if (activeCharts[def.id]) {
      range = activeCharts[def.id].range || DEFAULT_RANGE;
    }

    var timeRange = TIME_RANGES[range];
    def.metrics = [customMetricSelection];
    def.datasets = [{
      key: customMetricSelection,
      label: METRIC_LABELS[customMetricSelection] || customMetricSelection,
      color: '#14b8a6',
      yAxisID: 'y',
      fill: true
    }];

    /* Show loading spinner in custom chart container during fetch */
    var cardEl = document.getElementById('chart-card-' + def.id);
    var chartContainer = cardEl ? cardEl.querySelector('.chart-container') : null;
    if (chartContainer) {
      chartContainer.innerHTML = '<div class="loading-container" style="padding:2rem 0;min-height:260px">' +
        '<i data-lucide="loader-2" class="loading-spinner" style="width:24px;height:24px"></i>' +
        '<p class="text-xs text-muted mt-2">Loading ' + (METRIC_LABELS[customMetricSelection] || customMetricSelection) + '…</p>' +
        '</div>';
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }

    HealthAgent.api.get('/api/health/measurements/trends?metrics=' + customMetricSelection + '&limit=' + timeRange.limit)
      .then(function (trendData) {
        initChart(def, trendData, range);
        wireCardHandlers(def.id);
      })
      .catch(function (err) {
        console.error('[body-trends] Custom metric fetch failed for ' + customMetricSelection + ':', err);
        if (chartContainer) {
          chartContainer.innerHTML = '<div style="text-align:center;padding:2rem;min-height:260px">' +
            '<i data-lucide="alert-triangle" style="width:24px;height:24px;color:#ef4444;margin-bottom:0.5rem"></i>' +
            '<p style="font-weight:600;margin-bottom:0.25rem">Failed to load ' + (METRIC_LABELS[customMetricSelection] || customMetricSelection) + '</p>' +
            '<p class="text-xs text-muted mb-2">' + (err.message || 'Unknown error') + '</p>' +
            '<button class="btn btn-sm btn-primary" onclick="HealthAgent.bodyTrends._retryCustom(\'' + customMetricSelection + '\')">Retry</button>' +
            '</div>';
          if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
          }
        }
      });
  }

  /* ================================================================
   * PUBLIC API
   * ================================================================ */

  /**
   * Initialize all trend charts. Called when the Trends sub-tab activates.
   */
  function init() {
    var container = document.getElementById('subtab-body-trends');
    if (!container) return;

    /* Check for Chart.js */
    if (typeof Chart === 'undefined') {
      container.innerHTML = '<div class="card card-shadow card-accent-red" style="margin:1rem">' +
        '<div class="card-content" style="text-align:center;padding:2rem">' +
        '<i data-lucide="alert-triangle" style="width:32px;height:32px;color:#ef4444;margin-bottom:0.5rem"></i>' +
        '<p style="font-weight:600">Chart.js not loaded</p>' +
        '<p class="text-xs text-muted mt-1">Check your internet connection and reload the page.</p>' +
        '<button class="btn btn-sm btn-primary mt-3" onclick="location.reload()">Reload Page</button>' +
        '</div></div>';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    /* Show loading state */
    container.innerHTML = '<div class="loading-container" style="padding:3rem 0">' +
      '<i data-lucide="loader-2" class="loading-spinner" style="width:32px;height:32px"></i>' +
      '<p class="text-xs text-muted mt-3">Loading trend data…</p>' +
      '</div>';
    if (window.lucide) window.lucide.createIcons();

    /* Fetch trend data for all main charts simultaneously */
    var allMetrics = [];
    for (var i = 0; i < CHART_DEFS.length; i++) {
      allMetrics = allMetrics.concat(CHART_DEFS[i].metrics);
    }
    /* Deduplicate */
    var uniqueMetrics = [];
    var seen = {};
    for (var j = 0; j < allMetrics.length; j++) {
      if (!seen[allMetrics[j]]) {
        seen[allMetrics[j]] = true;
        uniqueMetrics.push(allMetrics[j]);
      }
    }

    var metricsParam = uniqueMetrics.join(',');
    var timeRange = TIME_RANGES[DEFAULT_RANGE];

    HealthAgent.api.get('/api/health/measurements/trends?metrics=' + metricsParam + '&limit=' + timeRange.limit)
      .then(function (allData) {
        /* Clear loading state */
        container.innerHTML = '';

        /* Render each chart card */
        for (var k = 0; k < CHART_DEFS.length; k++) {
          var def = CHART_DEFS[k];
          /* Filter data to only this chart's metrics */
          var chartData = allData.map(function (d) {
            var filtered = { measured_at: d.measured_at, metrics: {} };
            for (var m = 0; m < def.metrics.length; m++) {
              var mk = def.metrics[m];
              filtered.metrics[mk] = d.metrics[mk];
            }
            return filtered;
          });
          renderChartCard(def, container, chartData, DEFAULT_RANGE);
        }

        /* Render custom metric chart */
        renderCustomMetricCard(container);

        /* Refresh Lucide icons for the new buttons */
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      })
      .catch(function (err) {
        console.error('[body-trends] Failed to fetch trends — status:', err.status, 'message:', err.message, 'error:', err);
        if (err.status === 404) {
          container.innerHTML = '';
          /* Show a single empty state for all charts */
          var emptyHtml = '<div class="card card-shadow card-accent-blue">';
          emptyHtml += '<div class="card-header">';
          emptyHtml += '<div class="flex items-center gap-2">';
          emptyHtml += '<div style="height:0.5rem;width:0.5rem;border-radius:50%;background:#3b82f6"></div>';
          emptyHtml += '<h3 class="card-title uppercase tracking-wide text-sm font-semibold">Trend Charts</h3>';
          emptyHtml += '</div></div>';
          emptyHtml += '<div class="card-content">';
          emptyHtml += '<div class="body-map-placeholder" style="min-height:200px">';
          emptyHtml += '<div class="text-center">';
          emptyHtml += '<i data-lucide="line-chart" style="width:48px;height:48px;color:hsl(var(--muted-foreground) / 0.3);margin-bottom:0.75rem"></i>';
          emptyHtml += '<p>No trend data available</p>';
          emptyHtml += '<p class="text-xs text-muted mt-1">Record multiple measurements to see trends over time</p>';
          emptyHtml += '</div></div></div></div>';
          container.innerHTML = emptyHtml;
          if (window.lucide) window.lucide.createIcons();
        } else {
          HealthAgent.ui.showError('#subtab-body-trends',
            'Failed to load trend data: ' + (err.message || 'Unknown error'));
          /* Add detailed debug info and retry button */
          container.innerHTML += '<div style="text-align:center;margin-top:0.5rem">' +
            '<p class="text-xs text-muted" style="margin-bottom:0.5rem">Check that the API server is running at ' + HealthAgent.api.baseUrl + '</p>' +
            '<button class="btn btn-sm btn-primary" onclick="HealthAgent.bodyTrends.init()" style="margin-top:0.75rem">Retry</button>' +
            '</div>';
        }
      });
  }

  /**
   * Refresh all charts. Called externally (e.g. theme change).
   */
  function refresh() {
    /* Destroy all existing charts */
    for (var cid in activeCharts) {
      if (activeCharts.hasOwnProperty(cid) && activeCharts[cid].instance) {
        activeCharts[cid].instance.destroy();
      }
    }
    activeCharts = {};
    init();
  }

  /**
   * Theme-aware refresh — update chart colors without re-fetching.
   */
  function refreshTheme() {
    for (var cid in activeCharts) {
      if (!activeCharts.hasOwnProperty(cid)) continue;
      var chart = activeCharts[cid].instance;
      if (!chart) continue;

      var tc = getTextColor();
      var gc = getGridColor();

      /* Update scales */
      var scales = chart.options.scales;
      if (scales.y) {
        scales.y.grid.color = gc;
        scales.y.ticks.color = tc;
      }
      if (scales.y1) {
        scales.y1.ticks.color = tc;
      }

      /* Update legend */
      if (chart.options.plugins.legend) {
        chart.options.plugins.legend.labels.color = tc;
      }

      /* Update tooltip */
      if (chart.options.plugins.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = isDarkMode() ? '#1e293b' : '#ffffff';
        chart.options.plugins.tooltip.titleColor = isDarkMode() ? '#e2e8f0' : '#1e293b';
        chart.options.plugins.tooltip.bodyColor = isDarkMode() ? '#cbd5e1' : '#475569';
        chart.options.plugins.tooltip.borderColor = isDarkMode() ? '#334155' : '#e2e8f0';
      }

      /* Re-apply gradients */
      var def = activeCharts[cid].def;
      if (def) {
        applyGradientFills(chart, def);
      }

      chart.update('none');
    }
  }

  /* ================================================================
   * INITIALIZATION — wire into active chart registry
   * ================================================================ */

  /**
   * On theme toggle, refresh chart colors.
   * Listens for the theme toggle buttons (same ones app.js wires).
   */
  document.addEventListener('DOMContentLoaded', function () {
    /* Override theme toggle to also refresh charts */
    var origToggle = window.HealthAgent && window.HealthAgent.toggleTheme;
    if (origToggle) {
      var wrappedToggle = function () {
        origToggle.call(window.HealthAgent);
        setTimeout(refreshTheme, 50);
      };
      window.HealthAgent.toggleTheme = wrappedToggle;

      /* Re-wire theme buttons */
      var topbarBtn = document.getElementById('theme-toggle-topbar');
      var sidebarBtn = document.getElementById('theme-toggle-sidebar');
      if (topbarBtn) {
        topbarBtn.replaceWith(topbarBtn.cloneNode(true));
        document.getElementById('theme-toggle-topbar').addEventListener('click', wrappedToggle);
      }
      if (sidebarBtn) {
        sidebarBtn.replaceWith(sidebarBtn.cloneNode(true));
        document.getElementById('theme-toggle-sidebar').addEventListener('click', wrappedToggle);
      }
    }
  });

  /* ================================================================
   * RETRY HELPERS — exposed for onclick handlers
   * ================================================================ */

  /** Retry loading a specific chart's time range */
  function retryRange(chartId, rangeKey) {
    switchTimeRange(chartId, rangeKey);
  }

  /** Retry loading the custom metric chart */
  function retryCustom(metricKey) {
    var def = CUSTOM_CHART_DEF;
    customMetricSelection = metricKey;
    /* Update dropdown if visible */
    var dropdown = document.getElementById('custom-metric-dropdown');
    if (dropdown) dropdown.value = metricKey;
    updateCustomChart(def);
  }

  /* ================================================================
   * EXPORT
   * ================================================================ */

  window.HealthAgent = window.HealthAgent || {};
  window.HealthAgent.bodyTrends = {
    init: init,
    refresh: refresh,
    refreshTheme: refreshTheme,
    _retryRange: retryRange,
    _retryCustom: retryCustom
  };

})();