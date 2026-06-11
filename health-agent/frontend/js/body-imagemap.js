/**
 * Health Agent — Body Image-Map Renderer
 *
 * Renders a static anatomical image with HTML <area> regions and a
 * flyout tooltip showing the region's color-coded value. This
 * replaces the SVG-path approach used in PR #4-#6, which had
 * alignment issues because the source paths have empty space inside
 * their bounding boxes.
 *
 * Architecture:
 *  - body-anatomical.js handles the page-level UI (stats bar, view
 *    mode toggles, 5-region toggle, color legend).
 *  - This module handles the body itself: image, image map, tooltip.
 *  - The view mode is passed in via setViewMode() so this module
 *    stays in sync with body-anatomical's view mode state.
 *
 * The image is 270x360 pixels. Region coords are in image-pixel
 * space (POLY shape; coords scale with the image's CSS size).
 *
 * Convention: anatomical (figure's perspective). The figure FACES
 * the viewer, so:
 *   - The figure's RIGHT arm is on the VIEWER'S LEFT
 *   - The figure's LEFT arm is on the VIEWER'S RIGHT
 *   - Same for legs, hands, feet, shoulders
 *
 * This is the standard medical/anatomical convention and matches the
 * Hume segmental data field names (seg_left_arm_*, seg_right_arm_*, etc.).
 */

(function () {
  'use strict';

  /* ================================================================
   * REGION POLYGONS (image-pixel coordinates on a 270x360 image)
   *
   * Derived from a numpy pixel analysis of the actual image. The
   * figure centerline is x=131, vertical extent y=10-343.
   *
   * Each polygon is sized to cover the actual body part + a small
   * margin for clickability, and DOES NOT overlap with adjacent
   * regions (e.g. right-arm stops at x=99, chest starts at x=100).
   *
   * Naming follows the figure's anatomical perspective (not the
   * viewer's). The figure is FACING the viewer.
   * ================================================================ */

  var REGION_POLYGONS = {
    /* Right shoulder (figure's right, VIEWER'S LEFT): the LEFT half
     * of the upper-body block. The figure widens from head width at
     * y=55 to full shoulder width by y=65. */
    'right-shoulder': [
      [113, 65], [160, 65], [160, 115], [113, 115]
    ],

    /* Left shoulder (figure's left, VIEWER'S RIGHT): the RIGHT half
     * of the upper-body block. */
    'left-shoulder': [
      [160, 65], [206, 65], [206, 115], [160, 115]
    ],

    /* Chest: central torso. At y=120-200 the figure has three
     * segments (arms + torso). The torso (chest) is the middle
     * segment. Width x=100-167, with the figure being slightly
     * narrower in the middle. Polygon stops at x=167 to leave a
     * gap before the left-arm region starts at x=170. */
    chest: [
      [130, 115], [197, 115], [197, 200], [130, 200]
    ],

    /* Stomach: lower torso (y=200-220). Solid block x=97-164. */
    stomach: [
      [127, 200], [194, 200], [194, 220], [127, 220]
    ],

    /* Right arm (figure's right, VIEWER'S LEFT): the LEFT strip in
     * the three-segment region. Extends to the bottom of the arm
     * (y=200) since hand region was removed. */
    'right-arm': [
      [112, 115], [129, 115], [129, 120], [127, 140], [123, 155],
      [118, 165], [115, 180], [115, 200], [90, 200], [90, 180],
      [94, 160], [98, 140], [102, 120], [108, 116]
    ],

    /* Left arm (figure's left, VIEWER'S RIGHT): the RIGHT strip in
     * the three-segment region. Extends to the bottom (y=200). */
    'left-arm': [
      [200, 115], [232, 115], [232, 120], [228, 140], [223, 160],
      [218, 180], [218, 200], [200, 200], [200, 180], [195, 160],
      [192, 140], [190, 120], [200, 116]
    ],

    /* Right leg (figure's right, VIEWER'S LEFT): the LEFT strip in
     * the two-segment leg region. Extends to y=345 since foot region
     * was removed. */
    'right-leg': [
      [130, 220], [159, 220], [158, 240], [156, 280], [153, 320],
      [152, 335], [150, 345], [140, 345], [132, 335], [131, 320],
      [130, 280], [130, 240]
    ],

    /* Left leg (figure's left, VIEWER'S RIGHT): the RIGHT strip in
     * the two-segment leg region. Extends to y=345. */
    'left-leg': [
      [161, 220], [190, 220], [190, 240], [190, 280], [188, 320],
      [187, 335], [188, 345], [180, 345], [167, 335], [167, 320],
      [164, 280], [161, 240]
    ]
  };

  /* Color thresholds — matches body-map.js / body-anatomical.js */
  var HEALTH_COLORS = {
    good:    '#22c55e',
    normal:  '#38bdf8',
    warning: '#f59e0b',
    concern: '#ef4444'
  };

  /* View modes — same as body-map.js */
  var VIEW_MODES = {
    'fat_pct':    { label: 'Fat %',      unit: '%',   higherIsBetter: false },
    'fat_lbs':    { label: 'Fat lbs',    unit: 'lbs', higherIsBetter: false },
    'muscle_lbs': { label: 'Muscle lbs', unit: 'lbs', higherIsBetter: true  }
  };

  /* Display labels for tooltips */
  var REGION_LABELS = {
    'right-shoulder': 'Right Shoulder',
    'left-shoulder':  'Left Shoulder',
    'right-arm':      'Right Arm',
    'left-arm':       'Left Arm',
    chest:            'Chest',
    stomach:          'Stomach',
    'right-leg':      'Right Leg',
    'left-leg':       'Left Leg'
  };

  /* ================================================================
   * STATE
   * ================================================================ */

  var currentViewMode = 'fat_pct';
  var measurementData = null;

  /* ================================================================
   * VALUE LOOKUP (mirrors body-anatomical.js / body-map.js)
   *
   * Maps region key (anatomical) → Hume data field name. The Hume
   * fields are also anatomical: seg_left_arm_* = figure's left arm.
   * ================================================================ */

  function toNum(v) {
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function getRegionValue(data, regionKey, viewMode) {
    var mode = VIEW_MODES[viewMode];
    if (!mode) return 0;

    /* Real segmental field names (matches backend's Hume schema).
     * Hume fields are anatomical: seg_left_arm_* = figure's left. */
    var segFields = {
      'fat_pct': {
        'right-arm': 'seg_right_arm_fat_pct',
        'left-arm':  'seg_left_arm_fat_pct',
        'right-leg': 'seg_right_leg_fat_pct',
        'left-leg':  'seg_left_leg_fat_pct',
        chest: 'seg_trunk_fat_pct', stomach: 'seg_trunk_fat_pct',
        'right-shoulder': 'seg_trunk_fat_pct', 'left-shoulder': 'seg_trunk_fat_pct'
      },
      'fat_lbs': {
        'right-arm': 'seg_right_arm_fat_kg',
        'left-arm':  'seg_left_arm_fat_kg',
        'right-leg': 'seg_right_leg_fat_kg',
        'left-leg':  'seg_left_leg_fat_kg',
        chest: 'seg_trunk_fat_kg', stomach: 'seg_trunk_fat_kg',
        'right-shoulder': 'seg_trunk_fat_kg', 'left-shoulder': 'seg_trunk_fat_kg'
      },
      'muscle_lbs': {
        'right-arm': 'seg_right_arm_muscle_kg',
        'left-arm':  'seg_left_arm_muscle_kg',
        'right-leg': 'seg_right_leg_muscle_kg',
        'left-leg':  'seg_left_leg_muscle_kg',
        chest: 'seg_trunk_muscle_kg', stomach: 'seg_trunk_muscle_kg',
        'right-shoulder': 'seg_trunk_muscle_kg', 'left-shoulder': 'seg_trunk_muscle_kg'
      }
    };

    var realField = segFields[viewMode] && segFields[viewMode][regionKey];
    if (realField) {
      var realVal = toNum(data[realField]);
      if (realVal !== null && realVal > 0) {
        if (viewMode === 'fat_lbs' || viewMode === 'muscle_lbs') {
          return realVal * 2.20462;
        }
        return realVal;
      }
    }

    /* Fallback: estimate from overall body composition using
     * distribution ratios (matches body-map.js logic) */
    var DISTRIBUTION = {
      'right-arm':    { muscle: 0.08, fat: 0.07, fatPct: 0.70  },
      'left-arm':     { muscle: 0.08, fat: 0.07, fatPct: 0.70  },
      'right-leg':    { muscle: 0.22, fat: 0.18, fatPct: 1.05  },
      'left-leg':     { muscle: 0.22, fat: 0.18, fatPct: 1.05  }
    };
    var TRUNK_SPLIT = {
      'right-shoulder': 0.10,
      'left-shoulder':  0.10,
      chest:           0.30,
      stomach:         0.50
    };

    var dist = DISTRIBUTION[regionKey];
    if (dist) {
      if (viewMode === 'muscle_lbs') {
        var muscleMass = toNum(data.muscle_mass_kg) || toNum(data.skeletal_muscle_mass_kg) || 30;
        return (muscleMass * 2.20462) * dist.muscle;
      }
      if (viewMode === 'fat_lbs') {
        var fatMass = toNum(data.fat_mass_kg) || toNum(data.body_fat_mass_kg) || 15;
        return (fatMass * 2.20462) * dist.fat;
      }
      var fatPctVal = toNum(data.fat_pct) || toNum(data.body_fat_pct) || 20;
      return fatPctVal * dist.fatPct;
    }

    var trunkSplit = TRUNK_SPLIT[regionKey];
    if (trunkSplit) {
      if (viewMode === 'muscle_lbs') {
        var mm = toNum(data.muscle_mass_kg) || toNum(data.skeletal_muscle_mass_kg) || 30;
        return (mm * 2.20462) * trunkSplit;
      }
      if (viewMode === 'fat_lbs') {
        var fm = toNum(data.fat_mass_kg) || toNum(data.body_fat_mass_kg) || 15;
        return (fm * 2.20462) * trunkSplit;
      }
      var fp = toNum(data.fat_pct) || toNum(data.body_fat_pct) || 20;
      return fp;
    }

    return 0;
  }

  function getRegionRating(value, viewMode, regionKey) {
    var mode = VIEW_MODES[viewMode];
    if (!mode) return { label: 'NORMAL', color: 'normal' };
    if (regionKey === 'right-shoulder' || regionKey === 'left-shoulder') {
      return { label: 'N/A', color: 'normal' };
    }
    if (viewMode === 'fat_pct') {
      if (value < 15) return { label: 'GOOD', color: 'good' };
      if (value < 25) return { label: 'NORMAL', color: 'normal' };
      if (value < 32) return { label: 'WARNING', color: 'warning' };
      return { label: 'CONCERN', color: 'concern' };
    }
    if (viewMode === 'fat_lbs') {
      if (value < 12) return { label: 'GOOD', color: 'good' };
      if (value < 20) return { label: 'NORMAL', color: 'normal' };
      if (value < 28) return { label: 'WARNING', color: 'warning' };
      return { label: 'CONCERN', color: 'concern' };
    }
    if (viewMode === 'muscle_lbs') {
      if (value > 8) return { label: 'GOOD', color: 'good' };
      if (value > 5) return { label: 'NORMAL', color: 'normal' };
      if (value > 3) return { label: 'WARNING', color: 'warning' };
      return { label: 'CONCERN', color: 'concern' };
    }
    return { label: 'NORMAL', color: 'normal' };
  }

  /* ================================================================
   * RENDERING
   * ================================================================ */

  function renderImageMap(container, data) {
    measurementData = data || null;

    var areas = Object.keys(REGION_POLYGONS).map(function (key) {
      var pts = REGION_POLYGONS[key].map(function (p) { return p.join(','); }).join(' ');
      return '<area shape="poly" data-region="' + key + '" coords="' + pts + '" href="#" alt="' + REGION_LABELS[key] + '">';
    }).join('\n      ');

    container.innerHTML =
      '<div class="body-imagemap-wrap">' +
        '<img src="img/body/anatomical.jpg" usemap="#body-imagemap" class="body-imagemap-img" alt="Anatomical figure">' +
        '<map name="body-imagemap">' +
          areas +
        '</map>' +
        '<div class="body-imagemap-tooltip" id="body-imagemap-tooltip" style="display:none;">' +
          '<div class="body-imagemap-tooltip-label" id="bim-label"></div>' +
          '<div class="body-imagemap-tooltip-row">' +
            '<span class="body-imagemap-tooltip-dot" id="bim-dot"></span>' +
            '<span class="body-imagemap-tooltip-value" id="bim-value"></span>' +
          '</div>' +
          '<div class="body-imagemap-tooltip-rating" id="bim-rating"></div>' +
        '</div>' +
      '</div>';

    attachRegionHandlers(container);
  }

  function attachRegionHandlers(container) {
    var tooltip = container.querySelector('#body-imagemap-tooltip');
    var labelEl = container.querySelector('#bim-label');
    var dotEl = container.querySelector('#bim-dot');
    var valueEl = container.querySelector('#bim-value');
    var ratingEl = container.querySelector('#bim-rating');

    container.querySelectorAll('area[data-region]').forEach(function (area) {
      area.addEventListener('mouseenter', function (e) {
        showTooltip(e, area, tooltip, labelEl, dotEl, valueEl, ratingEl);
      });
      area.addEventListener('mousemove', function (e) {
        positionTooltip(e, tooltip);
      });
      area.addEventListener('mouseleave', function () {
        tooltip.style.display = 'none';
      });
      area.addEventListener('click', function (e) {
        e.preventDefault();
        showTooltip(e, area, tooltip, labelEl, dotEl, valueEl, ratingEl);
        tooltip.style.display = 'block';
      });
    });
  }

  function showTooltip(e, area, tooltip, labelEl, dotEl, valueEl, ratingEl) {
    var regionKey = area.getAttribute('data-region');
    var label = REGION_LABELS[regionKey] || regionKey;
    var value = measurementData ? getRegionValue(measurementData, regionKey, currentViewMode) : 0;
    var rating = getRegionRating(value, currentViewMode, regionKey);
    var mode = VIEW_MODES[currentViewMode];

    labelEl.textContent = label;
    dotEl.style.background = HEALTH_COLORS[rating.color];
    valueEl.textContent = value ? value.toFixed(1) + ' ' + mode.unit : '—';
    ratingEl.textContent = rating.label;
    ratingEl.style.color = HEALTH_COLORS[rating.color];

    tooltip.style.display = 'block';
    positionTooltip(e, tooltip);
  }

  function positionTooltip(e, tooltip) {
    var x = e.clientX + 14;
    var y = e.clientY + 18;
    var tw = tooltip.offsetWidth;
    var th = tooltip.offsetHeight;
    if (x + tw > window.innerWidth) x = e.clientX - tw - 14;
    if (y + th > window.innerHeight) y = e.clientY - th - 18;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  /* ================================================================
   * PUBLIC API
   *
   * body-anatomical.js expects window.HealthAgent.bodyImagemap.init()
   * and window.HealthAgent.bodyImagemap.setViewMode(). We expose
   * both.
   * ================================================================ */

  function setViewMode(mode) {
    if (VIEW_MODES[mode]) currentViewMode = mode;
  }

  function init(container, data) {
    renderImageMap(container, data);
  }

  function refresh(data) {
    var host = document.getElementById('body-imagemap-host');
    if (host) renderImageMap(host, data || measurementData);
  }

  window.HealthAgent = window.HealthAgent || {};
  window.HealthAgent.bodyImagemap = {
    init: init,
    refresh: refresh,
    setViewMode: setViewMode
  };
  window.BodyImageMap = window.HealthAgent.bodyImagemap;
})();
