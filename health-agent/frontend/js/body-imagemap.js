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
 * Convention: "left" = figure's anatomical right (viewer's left).
 *  - left-arm  = figure's right arm (viewer's left side)
 *  - right-arm = figure's left arm (viewer's right side)
 *  - left-leg  = figure's right leg
 *  - right-leg = figure's left leg
 */

(function () {
  'use strict';

  /* ================================================================
   * REGION POLYGONS (image-pixel coordinates on a 270x360 image)
   *
   * Derived from a numpy pixel analysis of the actual image. The
   * figure centerline is x=131, vertical extent y=10-343.
   *
   * Each polygon traces the actual silhouette of the body part, not
   * a rectangle. This means clicking on the visible body part (where
   * the blue silhouette is) hits the correct region, and the empty
   * space between arms and torso is NOT part of any region.
   * ================================================================ */

  var REGION_POLYGONS = {
    /* Head: oval, y=10-55, centered around x=131. */
    head: [
      [131, 10], [143, 14], [145, 28], [145, 40], [143, 50],
      [135, 55], [127, 55], [119, 50], [117, 40], [117, 28], [119, 14]
    ],

    /* Left shoulder (figure's right, viewer's left): cap on left
     * side of upper body. The shoulder line widens sharply at y=60-65
     * from head width (~30) to body width (~80). The left cap is
     * x=83-115. */
    'left-shoulder': [
      [83, 65], [115, 65], [118, 80], [115, 95], [105, 110],
      [95, 115], [85, 110], [83, 90]
    ],

    /* Right shoulder (figure's left, viewer's right): mirror. */
    'right-shoulder': [
      [187, 65], [155, 65], [152, 80], [155, 95], [165, 110],
      [175, 115], [185, 110], [187, 90]
    ],

    /* Chest: the central torso in the upper half of the three-stripe
     * region (y=120-180, x=97-165). This is bounded by the arms on
     * either side. */
    chest: [
      [104, 120], [160, 120], [165, 145], [163, 175], [160, 180],
      [100, 180], [97, 175], [95, 145]
    ],

    /* Stomach: the lower torso where the figure becomes a solid
     * block again (y=180-220, x=97-165). */
    stomach: [
      [97, 180], [165, 180], [165, 200], [161, 220], [100, 220],
      [97, 200]
    ],

    /* Left arm (figure's right, viewer's left): the left strip in
     * the three-segment region (y=120-195, x=65-100). */
    'left-arm': [
      [80, 120], [98, 120], [94, 145], [86, 165], [75, 185],
      [67, 195], [65, 180], [70, 155], [75, 135]
    ],

    /* Right arm (figure's left, viewer's right): the right strip
     * in the three-segment region (y=120-195, x=160-200). */
    'right-arm': [
      [160, 120], [179, 120], [184, 135], [189, 155], [194, 180],
      [196, 195], [186, 185], [175, 165], [165, 145]
    ],

    /* Hands: there are no distinct hand features in the image (no
     * finger details, no separate blobs). The hand regions are
     * the bottom 1/3 of each arm, narrowed slightly. They cover
     * the arm tip area. */
    'left-hand': [
      [75, 165], [94, 165], [86, 185], [75, 195], [67, 195],
      [70, 180]
    ],
    'right-hand': [
      [165, 165], [184, 165], [194, 195], [186, 185], [175, 180],
      [170, 175]
    ],

    /* Left leg (figure's right): the left strip in the two-stripe
     * leg region (y=225-340, x=100-129). */
    'left-leg': [
      [100, 225], [129, 225], [127, 260], [125, 295], [123, 330],
      [110, 340], [104, 320], [102, 280], [100, 250]
    ],

    /* Right leg (figure's left): the right strip in the two-stripe
     * leg region (y=225-340, x=131-160). */
    'right-leg': [
      [131, 225], [160, 225], [160, 250], [158, 280], [156, 320],
      [150, 340], [137, 330], [135, 295], [133, 260]
    ],

    /* Feet: bottom of the figure widens slightly at y=335-345.
     * Since there are no distinct foot features (no toes, no
     * separate foot shape), the foot regions are the very bottom
     * of the leg strips. */
    'left-foot': [
      [102, 335], [125, 335], [123, 345], [110, 345], [102, 340]
    ],
    'right-foot': [
      [135, 335], [158, 335], [160, 340], [150, 345], [137, 345]
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
    head:             'Head',
    'left-shoulder':  'Left Shoulder',
    'right-shoulder': 'Right Shoulder',
    'left-arm':       'Left Arm',
    'right-arm':      'Right Arm',
    chest:            'Chest',
    stomach:          'Stomach',
    'left-hand':      'Left Hand',
    'right-hand':     'Right Hand',
    'left-leg':       'Left Leg',
    'right-leg':      'Right Leg',
    'left-foot':      'Left Foot',
    'right-foot':     'Right Foot'
  };

  /* ================================================================
   * STATE
   * ================================================================ */

  var currentViewMode = 'fat_pct';
  var measurementData = null;

  /* ================================================================
   * VALUE LOOKUP (mirrors body-anatomical.js / body-map.js)
   * ================================================================ */

  function toNum(v) {
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function getRegionValue(data, regionKey, viewMode) {
    var mode = VIEW_MODES[viewMode];
    if (!mode) return 0;

    /* Real segmental field names (matches backend's Hume schema) */
    var segFields = {
      'fat_pct': {
        'left-arm': 'seg_left_arm_fat_pct', 'right-arm': 'seg_right_arm_fat_pct',
        'left-leg': 'seg_left_leg_fat_pct', 'right-leg': 'seg_right_leg_fat_pct',
        chest: 'seg_trunk_fat_pct', stomach: 'seg_trunk_fat_pct',
        'left-shoulder': 'seg_trunk_fat_pct', 'right-shoulder': 'seg_trunk_fat_pct'
      },
      'fat_lbs': {
        'left-arm': 'seg_left_arm_fat_kg', 'right-arm': 'seg_right_arm_fat_kg',
        'left-leg': 'seg_left_leg_fat_kg', 'right-leg': 'seg_right_leg_fat_kg',
        chest: 'seg_trunk_fat_kg', stomach: 'seg_trunk_fat_kg',
        'left-shoulder': 'seg_trunk_fat_kg', 'right-shoulder': 'seg_trunk_fat_kg'
      },
      'muscle_lbs': {
        'left-arm': 'seg_left_arm_muscle_kg', 'right-arm': 'seg_right_arm_muscle_kg',
        'left-leg': 'seg_left_leg_muscle_kg', 'right-leg': 'seg_right_leg_muscle_kg',
        chest: 'seg_trunk_muscle_kg', stomach: 'seg_trunk_muscle_kg',
        'left-shoulder': 'seg_trunk_muscle_kg', 'right-shoulder': 'seg_trunk_muscle_kg'
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
      'left-arm':      { muscle: 0.08, fat: 0.07, fatPct: 0.70  },
      'right-arm':     { muscle: 0.08, fat: 0.07, fatPct: 0.70  },
      'left-leg':      { muscle: 0.22, fat: 0.18, fatPct: 1.05  },
      'right-leg':     { muscle: 0.22, fat: 0.18, fatPct: 1.05  }
    };
    var TRUNK_SPLIT = {
      'left-shoulder':  0.10,
      'right-shoulder': 0.10,
      chest:           0.30,
      stomach:         0.50
    };
    var EXTREMITY_RATIOS = {
      'left-hand':  0.08,
      'right-hand': 0.08,
      'left-foot':  0.04,
      'right-foot': 0.04
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

    var extRatio = EXTREMITY_RATIOS[regionKey];
    if (extRatio) {
      if (viewMode === 'muscle_lbs') {
        var lmm = toNum(data.muscle_mass_kg) || toNum(data.skeletal_muscle_mass_kg) || 30;
        return (lmm * 2.20462) * extRatio;
      }
      if (viewMode === 'fat_lbs') {
        var lfm = toNum(data.fat_mass_kg) || toNum(data.body_fat_mass_kg) || 15;
        return (lfm * 2.20462) * extRatio;
      }
      var lfp = toNum(data.fat_pct) || toNum(data.body_fat_pct) || 20;
      return lfp;
    }

    return 0;
  }

  function getRegionRating(value, viewMode, regionKey) {
    var mode = VIEW_MODES[viewMode];
    if (!mode) return { label: 'NORMAL', color: 'normal' };
    if (regionKey === 'head' || regionKey === 'left-shoulder' || regionKey === 'right-shoulder') {
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
    setViewMode: setViewMode,
    /* Also expose as window.BodyImageMap for debugging */
  };
  window.BodyImageMap = window.HealthAgent.bodyImagemap;
})();
