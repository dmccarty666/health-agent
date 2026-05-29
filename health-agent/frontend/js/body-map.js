/**
 * Health Agent — Body Map Visualization
 *
 * Renders an SVG body silhouette with color-coded segment overlays,
 * gradient fills for anatomical depth, muscle definition lines,
 * and a proportional body outline behind the colored segments.
 *
 * When segmental data is unavailable (Hume scale), estimates distribution
 * from overall body composition metrics using region-specific ratios.
 *
 * Features: view mode toggles, value pills, stats bar, color legend,
 * segment detail cards, and hover highlights.
 */

(function () {
  'use strict';

  /* ================================================================
   * CONSTANTS
   * ================================================================ */

  /**
   * SVG path data for male body silhouette. ViewBox: 0 0 200 500.
   *
   * bodyOutline — the complete body silhouette rendered as a
   * semi-transparent stroke behind the colored segments, giving
   * the figure a recognizable human contour regardless of which
   * segments have data.
   *
   * Segment paths — each represents one of the five BIA regions.
   * Redrawn with more anatomically natural proportions: wider
   * shoulders, defined waist curve, realistic leg taper.
   */
  var MALE_PATH = {
    bodyOutline: 'M100 22 C108 22,118 26,122 32 L126 48 L130 62 L135 78 L140 92 L144 108 L148 125 L152 142 L156 160 L160 178 L162 195 L163 215 L164 235 L164 255 L163 275 L161 295 L158 315 L155 335 L152 355 L149 375 L147 395 L145 415 L143 435 L141 455 L139 470 L136 485 L132 498 C130 500,128 500,126 498 L128 485 L130 470 L132 455 L134 435 L136 415 L138 395 L140 375 L142 355 L145 335 L148 315 L151 295 L153 275 L155 255 L156 235 L155 215 L154 195 L152 178 L148 160 L144 142 L140 125 L136 108 L132 92 L128 78 L124 62 L120 48 L116 32 C112 26,108 22,100 22 Z',
    trunk: 'M85 55 C85 38,115 38,115 55 L118 70 L120 80 L124 95 L128 110 L132 128 L136 148 L139 168 L141 188 L142 210 L141 232 L139 250 L136 265 L132 280 L128 292 L125 302 L124 308 C124 312,126 315,130 318 C133 320,135 322,135 326 L132 330 C130 332,126 334,122 336 L118 340 L116 345 L114 350 L111 354 C108 356,105 356,100 356 C95 356,92 356,89 354 L86 350 L84 345 L82 340 L78 336 C74 334,70 332,68 330 L65 326 C65 322,67 320,70 318 C74 315,76 312,76 308 L75 302 L72 292 L68 280 L64 265 L61 250 L59 232 L58 210 L59 188 L61 168 L64 148 L68 128 L72 110 L76 95 L80 80 L82 70 L85 55 Z',
    rightArm: 'M118 70 C118 70,128 68,140 68 C150 68,158 72,162 78 C166 86,166 98,164 112 C162 126,158 142,156 155 L154 168 L153 182 L152 195 L153 208 L156 218 L160 226 C164 234,167 242,168 248 C169 254,166 258,161 260 C156 262,150 260,148 255 C146 250,146 244,144 235 L142 222 L140 208 L138 192 L136 175 L134 160 C132 145,130 132,128 120 L126 108 L124 98 L121 88 C120 82,119 75,118 70 Z',
    leftArm: 'M82 70 C82 70,72 68,60 68 C50 68,42 72,38 78 C34 86,34 98,36 112 C38 126,42 142,44 155 L46 168 L47 182 L48 195 L47 208 L44 218 L40 226 C36 234,33 242,32 248 C31 254,34 258,39 260 C44 262,50 260,52 255 C54 250,54 244,56 235 L58 222 L60 208 L62 192 L64 175 L66 160 C68 145,70 132,72 120 L74 108 L76 98 L79 88 C80 82,81 75,82 70 Z',
    rightLeg: 'M100 316 C100 316,115 322,130 328 C145 334,154 348,157 365 C160 382,162 405,163 430 C164 455,164 478,163 492 C162 498,158 502,153 503 C148 504,143 500,141 494 C139 484,137 462,135 440 C133 418,131 398,129 382 C127 366,124 354,120 346 C116 338,112 332,108 326 L104 320 L100 316 Z',
    leftLeg: 'M100 316 C100 316,85 322,70 328 C55 334,46 348,43 365 C40 382,38 405,37 430 C36 455,36 478,37 492 C38 498,42 502,47 503 C52 504,57 500,59 494 C61 484,63 462,65 440 C67 418,69 398,71 382 C73 366,76 354,80 346 C84 338,88 332,92 326 L96 320 L100 316 Z',
    /* Subtle muscle-definition lines overlaying the segments */
    trunkDetail:     'M100 90 C100 110,100 130,100 155 C100 180,100 200,100 220 C100 240,100 260,100 280 C100 295,100 305,98 310',
    rightArmDetail:  'M152 100 C155 120,153 160,152 200 C151 225,154 245,160 255',
    leftArmDetail:   'M48 100 C45 120,47 160,48 200 C49 225,46 245,40 255',
    rightLegDetail:  'M148 350 C150 385,150 420,149 460 C149 480,147 495,145 498',
    leftLegDetail:   'M52 350 C50 385,50 420,51 460 C51 480,53 495,55 498'
  };

  /**
   * Standard anthropometric distribution ratios for segmental estimation.
   * Used as fallback when the Hume scale doesn't provide segmental data.
   *
   * fat_pct ratios added in addition to muscle/fat_kg — trunk carries
   * higher body fat percentage than limbs, arms lower than legs, etc.
   * These are clinical norms from DXA reference data.
   */
  var DISTRIBUTION = {
    rightArm: { muscle: 0.08, fat: 0.07, fatPct: 0.70  },
    leftArm:  { muscle: 0.08, fat: 0.07, fatPct: 0.70  },
    trunk:    { muscle: 0.40, fat: 0.50, fatPct: 1.15  },
    rightLeg: { muscle: 0.22, fat: 0.18, fatPct: 1.05  },
    leftLeg:  { muscle: 0.22, fat: 0.18, fatPct: 1.05  }
  };

  /** Segment color keywords for SVG gradient IDs */
  var SEGMENT_GRADIENT_IDS = {
    rightArm: 'grad-right-arm',
    leftArm:  'grad-left-arm',
    trunk:    'grad-trunk',
    rightLeg: 'grad-right-leg',
    leftLeg:  'grad-left-leg'
  };

  var SEGMENT_REGIONS = {
    rightArm: { label: 'Right Arm', cx: 148, cy: 160, path: MALE_PATH.rightArm, detailPath: MALE_PATH.rightArmDetail },
    leftArm:  { label: 'Left Arm',  cx: 52,  cy: 160, path: MALE_PATH.leftArm,  detailPath: MALE_PATH.leftArmDetail  },
    trunk:    { label: 'Trunk',     cx: 100, cy: 185, path: MALE_PATH.trunk,    detailPath: MALE_PATH.trunkDetail     },
    rightLeg: { label: 'Right Leg', cx: 148, cy: 400, path: MALE_PATH.rightLeg, detailPath: MALE_PATH.rightLegDetail  },
    leftLeg:  { label: 'Left Leg',  cx: 52,  cy: 400, path: MALE_PATH.leftLeg,  detailPath: MALE_PATH.leftLegDetail   }
  };

  /* Color scale: red (high concern) → amber → green (good) */
  var HEALTH_COLORS = {
    good:    '#22c55e',
    normal:  '#38bdf8',
    warning: '#f59e0b',
    concern: '#ef4444'
  };

  var VIEW_MODES = {
    'fat_pct':   { label: 'Fat %',    unit: '%',  higherIsBetter: false, metric: 'body_fat_pct',   field: 'fatPct'   },
    'fat_lbs':   { label: 'Fat lbs',  unit: 'lbs', higherIsBetter: false, metric: 'fat_mass_kg',    field: 'fatKg'    },
    'muscle_lbs':{ label: 'Muscle lbs',unit: 'lbs', higherIsBetter: true,  metric: 'lean_mass_kg',   field: 'muscleKg' }
  };

  /* ================================================================
   * STATE
   * ================================================================ */

  var currentViewMode = 'fat_pct';
  var measurementData = null;

  /* ================================================================
   * ESTIMATION — fill in missing segmental data
   * ================================================================ */

  /**
   * Return the display value for one segment in the current view mode.
   *
   * Priority:
   *   1. Real segmental field from backend (e.g. seg_right_arm_fat_pct)
   *   2. Fallback: estimate from overall metric × region distribution ratio
   *
   * ISSUE 3 FIX: Previously, fat_pct mode returned the same overall
   * body_fat_pct for every segment. Now it uses segment-specific
   * fatPct multipliers so trunk shows higher fat% than arms/legs.
   */
  function getSegmentalValue(data, segmentKey, mode) {
    /* Check if real segmental data exists */
    var segFields = {
      'fat_pct':   { rightArm: 'seg_right_arm_fat_pct',   leftArm: 'seg_left_arm_fat_pct',   trunk: 'seg_trunk_fat_pct',   rightLeg: 'seg_right_leg_fat_pct',   leftLeg: 'seg_left_leg_fat_pct'   },
      'fat_kg':    { rightArm: 'seg_right_arm_fat_kg',    leftArm: 'seg_left_arm_fat_kg',    trunk: 'seg_trunk_fat_kg',    rightLeg: 'seg_right_leg_fat_kg',    leftLeg: 'seg_left_leg_fat_kg'    },
      'muscle_kg': { rightArm: 'seg_right_arm_muscle_kg', leftArm: 'seg_left_arm_muscle_kg', trunk: 'seg_trunk_muscle_kg', rightLeg: 'seg_right_leg_muscle_kg', leftLeg: 'seg_left_leg_muscle_kg' }
    };

    var realField = segFields[mode] && segFields[mode][segmentKey];
    var realVal = realField ? toNum(data[realField]) : null;
    if (realVal !== null && realVal > 0) return realVal;

    /* Fallback: estimate from overall body composition using distribution ratios */
    var dist = DISTRIBUTION[segmentKey];
    if (!dist) return 0;

    if (mode === 'fat_pct') {
      /* ISSUE 3 FIX: Use segment-specific fatPct multiplier instead
       * of the same body_fat_pct for every region. Trunk naturally
       * carries ~15% more fat% than the average, arms ~30% less. */
      var totalFatPct = toNum(data.body_fat_pct);
      return totalFatPct !== null ? totalFatPct * dist.fatPct : 0;
    }
    if (mode === 'fat_kg') {
      var totalFat = toNum(data.fat_mass_kg);
      return totalFat !== null ? totalFat * dist.fat : 0;
    }
    if (mode === 'muscle_kg') {
      var leanMass = toNum(data.lean_mass_kg);
      return leanMass !== null ? leanMass * dist.muscle : 0;
    }
    return 0;
  }

  /* ================================================================
   * RATING LOGIC
   * ================================================================ */

  /** Rate a segment by body fat % against clinical thresholds */
  function rateSegment(value, higherIsBetter) {
    if (value == null || isNaN(value) || value <= 0) return 'normal';

    if (higherIsBetter) {
      /* Muscle — rate against reference; use typical segment values */
      if (value >= 15) return 'good';       /* e.g. trunk muscle */
      if (value >= 8)  return 'normal';
      if (value >= 4)  return 'warning';
      return 'concern';
    } else {
      /* Fat % — clinical thresholds for males */
      if (value <= 14) return 'good';
      if (value <= 20) return 'normal';
      if (value <= 28) return 'warning';
      return 'concern';
    }
  }

  /* ================================================================
   * RENDERING
   * ================================================================ */

  function render() {
    var container = document.getElementById('subtab-body-map');
    if (!container) return;

    var data = measurementData;
    var mode = VIEW_MODES[currentViewMode];
    if (!mode) return;

    /* Build segment data */
    var segments = [];
    var segKeys = Object.keys(SEGMENT_REGIONS);
    for (var i = 0; i < segKeys.length; i++) {
      var key = segKeys[i];
      var seg = SEGMENT_REGIONS[key];
      var val = data ? getSegmentalValue(data, key, currentViewMode) : 0;
      // Convert kg values to lbs for weight modes
      if (currentViewMode === 'fat_lbs' || currentViewMode === 'muscle_lbs') {
        val = val * 2.20462;
      }
      segments.push({ key: key, seg: seg, val: val || 0 });
    }

    /* ── Build HTML ── */
    var html = '';

    /* Header row with overall stats */
    html += '<div class="body-map-stats">';
    html += buildStatItem('Weight', data ? fmtWeight(data.weight_kg) : '--', 'lbs', 'weight');
    html += buildStatItem('Body Fat', data ? fmtNum(data.body_fat_pct) : '--', '%', 'scan');
    html += buildStatItem('Lean Mass', data ? fmtWeight(data.lean_mass_kg) : '--', 'lbs', 'dumbbell');
    html += buildStatItem('BMI', data ? fmtNum(data.bmi) : '--', '', 'ruler');
    html += '</div>';

    /* View mode toggles */
    html += '<div class="body-map-toggles">';
    for (var modeKey in VIEW_MODES) {
      if (!VIEW_MODES.hasOwnProperty(modeKey)) continue;
      var m = VIEW_MODES[modeKey];
      html += '<button class="body-map-toggle' + (modeKey === currentViewMode ? ' active' : '') + '" data-mode="' + modeKey + '">' + m.label + '</button>';
    }
    html += '</div>';

    /* SVG body map */
    html += '<div class="body-map-svg-container">';

    /* Color legend */
    html += '<div class="body-map-legend">';
    html += '<div class="legend-item"><span class="legend-swatch" style="background:' + HEALTH_COLORS.good + '"></span> Good</div>';
    html += '<div class="legend-item"><span class="legend-swatch" style="background:' + HEALTH_COLORS.normal + '"></span> Normal</div>';
    html += '<div class="legend-item"><span class="legend-swatch" style="background:' + HEALTH_COLORS.warning + '"></span> Warning</div>';
    html += '<div class="legend-item"><span class="legend-swatch" style="background:' + HEALTH_COLORS.concern + '"></span> Concern</div>';
    html += '</div>';

    html += '<svg viewBox="0 0 200 520" class="body-map-svg" xmlns="http://www.w3.org/2000/svg">';

    /* ── SVG Defs: segment gradients for depth/shading ── */
    html += '  <defs>';
    html += '    <filter id="segment-glow"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    html += '    <filter id="segment-shadow"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.3"/></filter>';

    var zOrder = ['trunk', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
    for (var g = 0; g < zOrder.length; g++) {
      var gkey = zOrder[g];
      var gid = SEGMENT_GRADIENT_IDS[gkey];
      html += '    <linearGradient id="' + gid + '-grad" x1="0%" y1="0%" x2="100%" y2="100%">';
      html += '      <stop offset="0%"   stop-color="var(--seg-color)" stop-opacity="0.55"/>';
      html += '      <stop offset="50%"  stop-color="var(--seg-color)" stop-opacity="0.35"/>';
      html += '      <stop offset="100%" stop-color="var(--seg-color)" stop-opacity="0.15"/>';
      html += '    </linearGradient>';
    }
    html += '  </defs>';

    html += '  <rect x="0" y="0" width="200" height="520" fill="transparent"/>';

    /* ── Body outline: white stroke behind segments for human contour ── */
    html += '  <path d="' + MALE_PATH.bodyOutline + '" fill="none" stroke="rgba(148,163,184,0.25)" stroke-width="1.2" stroke-dasharray="none" opacity="0.6"/>';

    /* ── Draw segments in z-order ── */
    for (var j = 0; j < zOrder.length; j++) {
      var zkey = zOrder[j];
      var found = null;
      for (var k = 0; k < segments.length; k++) {
        if (segments[k].key === zkey) { found = segments[k]; break; }
      }
      if (!found) continue;

      var rating = rateSegment(found.val, mode.higherIsBetter);
      var color = HEALTH_COLORS[rating];
      var displayVal = found.val > 0 ? fmtNum(found.val) : '--';
      var seg = found.seg;
      var gradId = SEGMENT_GRADIENT_IDS[zkey];

      /* Segment fill with gradient — use CSS variable substitution pattern */
      html += '  <path d="' + seg.path + '" fill="' + color + '" fill-opacity="0.45" stroke="' + color + '" stroke-width="1.2" stroke-opacity="0.7" filter="url(#segment-glow)"/>';

      /* Gradient overlay on top for shading depth */
      html += '  <path d="' + seg.path + '" fill="url(#' + gradId + '-grad)" style="--seg-color:' + color + '" opacity="0.8"/>';

      /* Inner highlight line for muscle definition */
      html += '  <path d="' + seg.path + '" fill="none" stroke="white" stroke-width="0.3" stroke-opacity="0.15"/>';

      /* Value pill */
      html += '  <g class="body-map-pill-group">';
      html += '    <rect x="' + (seg.cx - 26) + '" y="' + (seg.cy - 11) + '" width="52" height="22" rx="11" ry="11" fill="#0f172a" fill-opacity="0.9" stroke="' + color + '" stroke-width="1.5"/>';
      html += '    <text x="' + seg.cx + '" y="' + (seg.cy + 5) + '" text-anchor="middle" fill="white" font-size="10" font-family="JetBrains Mono, monospace" font-weight="600">' + displayVal + mode.unit + '</text>';
      html += '  </g>';

      /* Region label above pill */
      html += '  <text x="' + seg.cx + '" y="' + (seg.cy - 16) + '" text-anchor="middle" fill="white" fill-opacity="0.5" font-size="7" font-family="DM Sans, sans-serif" font-weight="500" letter-spacing="0.5">' + seg.label + '</text>';
    }

    /* ── Muscle definition overlay lines ── */
    html += '  <g opacity="0.12">';
    for (var d = 0; d < zOrder.length; d++) {
      var dkey = zOrder[d];
      var dseg = SEGMENT_REGIONS[dkey];
      if (dseg && dseg.detailPath) {
        html += '  <path d="' + dseg.detailPath + '" fill="none" stroke="white" stroke-width="0.8" stroke-dasharray="2 4"/>';
      }
    }
    html += '  </g>';

    html += '</svg>';
    html += '</div>'; /* .body-map-svg-container */

    /* Segment detail cards */
    html += '<div class="body-map-segments">';
    for (var s = 0; s < segments.length; s++) {
      var si = segments[s];
      var r = rateSegment(si.val, mode.higherIsBetter);
      html += '<div class="body-map-segment-card" style="border-left:3px solid ' + HEALTH_COLORS[r] + '">';
      html += '<span class="segment-label">' + si.seg.label + '</span>';
      html += '<span class="segment-value">' + (si.val > 0 ? fmtNum(si.val) : '--') + mode.unit + '</span>';
      html += '<span class="segment-rating" style="color:' + HEALTH_COLORS[r] + '">' + r.charAt(0).toUpperCase() + r.slice(1) + '</span>';
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;

    setTimeout(wireHandlers, 0);
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */

  function buildStatItem(label, value, unit, icon) {
    return '<div class="body-map-stat">' +
      '<i data-lucide="' + icon + '" style="width:14px;height:14px;opacity:0.6;flex-shrink:0"></i>' +
      '<span class="body-map-stat-label">' + label + '</span>' +
      '<span class="body-map-stat-value">' + value + '<span class="body-map-stat-unit">' + unit + '</span></span>' +
      '</div>';
  }

  function fmtNum(val) {
    if (val == null || isNaN(val)) return '--';
    var n = Number(val);
    if (n === 0) return '--';
    return n.toFixed(1);
  }

  /**
   * Convert kg to lbs for display.  null/undefined → '--'.
   * Conversion: lbs = kg × 2.20462
   */
  function fmtWeight(kg) {
    if (kg === null || kg === undefined) return '--';
    var lbs = Number(kg) * 2.20462;
    return lbs % 1 === 0 ? String(Math.round(lbs)) : lbs.toFixed(1);
  }

  function toNum(val) {
    if (val == null || val === '') return null;
    var n = Number(val);
    return isNaN(n) ? null : n;
  }

  function wireHandlers() {
    var toggles = document.querySelectorAll('.body-map-toggle');
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener('click', function () {
        var mode = this.getAttribute('data-mode');
        if (mode && mode !== currentViewMode) {
          currentViewMode = mode;
          render();
        }
      });
    }
  }

  /* ================================================================
   * PUBLIC API
   * ================================================================ */

  function init() {
    var container = document.getElementById('subtab-body-map');
    if (!container) return;

    HealthAgent.ui.showLoading('#subtab-body-map');

    HealthAgent.api.get('/api/health/measurements/latest')
      .then(function (data) {
        measurementData = data;
        render();
      })
      .catch(function (err) {
        console.error('[body-map] Failed to fetch measurement:', err);
        if (err.status === 404) {
          HealthAgent.ui.showEmptyState('#subtab-body-map', {
            icon: 'person-standing',
            title: 'No Measurements Found',
            description: 'Record a body composition scan to see your body map.'
          });
        } else {
          HealthAgent.ui.showError('#subtab-body-map',
            'Failed to load body map data. Is the API server running?');
        }
      });
  }

  function refresh() {
    measurementData = null;
    init();
  }

  /* ── Export ──────────────────────────────────────────────────────── */

  window.HealthAgent = window.HealthAgent || {};
  window.HealthAgent.bodyMap = {
    init: init,
    refresh: refresh,
    render: render
  };

})();
