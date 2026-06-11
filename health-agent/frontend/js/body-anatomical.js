/**
 * Health Agent — Anatomical Body Map (8-region image map)
 *
 * Renders the 8-region anatomical view. The actual body figure is
 * drawn by body-imagemap.js (a static image with <area> hotspots);
 * this module handles the page-level UI: stats bar, view mode
 * toggles (Fat %, Fat lbs, Muscle lbs), color legend, and the
 * "8-Region Anatomical" view label.
 *
 * History:
 *   - PR #1-#6: built progressively more accurate SVG-path renderers
 *     based on volcanioo/Human-Body-Rendering-HTML. Each iteration
 *     had alignment issues because the source SVG paths have empty
 *     space inside their bounding boxes that no amount of positioning
 *     could bridge. Visible in the dashboard as gaps between hands
 *     and arms, feet and legs, etc.
 *   - PR #7: replaced SVG rendering with a static anatomical image
 *     (the user-provided JPG) and hand-drawn <area> polygons. The
 *     body figure is now a single image; region coloring is in the
 *     tooltip, not the image itself.
 *   - PR #8: removed head/hands/feet regions (no data for them) and
 *     shifted polygons to fix a left-skew. The image-map approach
 *     with manual coords is the most reliable region detection.
 *   - PR #9 (this): removed the 5-region simple view (body-map.js).
 *     The 8-region anatomical image map is now the only view.
 *
 * Region-to-segment mapping (Hume scale provides 5 segments, mapped
 * directly to 8 anatomical regions: trunk mass is split across
 * shoulders/chest/stomach):
 *
 *   Hume 5-region   →   Anatomical 8-region
 *   ──────────────       ──────────────────
 *   trunk             →   left-shoulder, right-shoulder, chest, stomach
 *   rightArm          →   right-arm
 *   leftArm           →   left-arm
 *   rightLeg          →   right-leg
 *   leftLeg           →   left-leg
 *
 * Trunk distribution ratios (anatomically-motivated):
 *   - left-shoulder: 0.10  (4.5 lbs muscle, 1.5 lbs fat per side at avg)
 *   - right-shoulder: 0.10
 *   - chest: 0.30  (largest trunk mass, mostly muscle)
 *   - stomach: 0.50  (most of trunk fat + organs)
 *
 * Hands/feet estimated as small fixed percentages of arm/leg muscle.
 * Head is rendered with no measurement (visual only, neutral color).
 *
 * Features:
 *   - Single SVG = perfect alignment by construction
 *   - Hover: orange highlight (matches original)
 *   - Click: shows detail tooltip with region name + value
 *   - View mode toggle: Fat %, Fat lbs, Muscle lbs
 *   - Color-coded by health threshold (green/blue/amber/red)
 *   - Tooltip uses viewport-relative fixed positioning
 */

(function () {
  'use strict';

  /* ================================================================
   * CONSTANTS
   * ================================================================ */

  var API_BASE = (window.HealthAgent && window.HealthAgent.api && window.HealthAgent.api.baseUrl)
    ? window.HealthAgent.api.baseUrl
    : 'http://localhost:8765';

  var CONTAINER_ID = 'subtab-body-map';

  /* SVG paths for the 13 anatomical regions. Adapted from
   * volcanioo/Human-Body-Rendering-HTML.
   *
   * Each path is stored with its source viewBox dimensions. The render
   * function wraps each in a <g transform="translate(x, y)"> that
   * positions it inside the unified viewBox. */
  var ANATOMICAL_PATHS = {
    head:           { d: 'M15.92 68.5l8.8 12.546 3.97 13.984-9.254-7.38-4.622-15.848zm27.1 0l-8.8 12.546-3.976 13.988 9.254-7.38 4.622-15.848zm6.11-27.775l.108-11.775-21.16-14.742L8.123 26.133 8.09 40.19l-3.24.215 1.462 9.732 5.208 1.81 2.36 11.63 9.72 11.018 10.856-.324 9.56-10.37 1.918-11.952 5.207-1.81 1.342-9.517zm-43.085-1.84l-.257-13.82L28.226 11.9l23.618 15.755-.216 10.37 4.976-17.085L42.556 2.376 25.49 0 10.803 3.673.002 24.415z', w: 56.594, h: 95.031 },
    'left-shoulder': { d: 'm 38.244,-0.004 1.98,9.232 -11.653,2.857 -7.474,-2.637 z M 17.005,10.536 12.962,8.35 0.306,22.35 0.244,27.675 c 0,0 16.52,-17.015 16.764,-17.14 z m 1.285,0.58 C 18.3,11.396 0.528,30.038 0.528,30.038 L -0.01,46.595 6.147,36.045 18.017,30.989 26.374,15.6 Z', w: 109.532, h: 46.594 },
    'right-shoulder': { d: 'm 3.2759972,-0.004 -1.98,9.232 11.6529998,2.857 7.473999,-2.637 z m 21.2379988,10.54 4.044,-2.187 12.656,14 0.07,5.33 c 0,0 -16.524,-17.019 -16.769,-17.144 z m -1.285,0.58 c -0.008,0.28 17.762,18.922 17.762,18.922 l 0.537,16.557 -6.157,-10.55 -11.871,-5.057 L 15.147997,15.6 Z', w: 109.532, h: 46.594 },
    'left-arm':     { d: 'm21.12,56.5a1.678,1.678 0 0 1 -0.427,0.33l0.935,8.224l12.977,-13.89l1.2,-8.958a168.2,168.2 0 0 0 -14.685,14.294zm1.387,12.522l-18.07,48.91l5.757,1.333l19.125,-39.44l3.518,-22.047l-10.33,11.244zm-5.278,-18.96l2.638,18.74l-17.2,46.023l-2.657,-1.775l6.644,-35.518l10.575-27.47zm18.805,-12.323a1.78,1.78 0 0 1 0.407,-0.24l3.666,-27.345l-7.037,-10.139l-7.258,10.58l-6.16,37.04l0.566,4.973a151.447,151.447 0 0 1 15.808,-14.87l0.008,0.001zm-13.742,-28.906l-3.3,35.276l-2.2,-26.238l5.5,-9.038z', w: 156.344, h: 119.25 },
    'right-arm':    { d: 'm 18.997,56.5 a 1.678,1.678 0 0 0 0.427,0.33 L 18.489,65.054 5.512,51.164 4.312,42.206 A 168.2,168.2 0 0 1 18.997,56.5 Z m -1.387,12.522 18.07,48.91 -5.757,1.333 L 10.798,79.825 7.28,57.778 17.61,69.022 Z m 5.278,-18.96 -2.638,18.74 17.2,46.023 2.657,-1.775 L 33.463,77.532 22.888,50.062 Z M 4.083,37.739 A 1.78,1.78 0 0 0 3.676,37.499 L 0.01,10.154 7.047,0.015 l 7.258,10.58 6.16,37.04 -0.566,4.973 A 151.447,151.447 0 0 0 4.091,37.738 l -0.008,10e-4 z m 13.742,-28.906 3.3,35.276 2.2,-26.238 -5.5,-9.038 z', w: 156.344, h: 119.25 },
    chest:          { d: 'M19.32 0l-9.225 16.488-10.1 5.056 6.15 4.836 4.832 14.07 11.2 4.616 17.85-8.828-4.452-34.7zm47.934 0l9.225 16.488 10.1 5.056-6.15 4.836-4.833 14.07-11.2 4.616-17.844-8.828 4.45-34.7z', w: 86.594, h: 45.063 },
    stomach:        { d: 'M19.25 7.49l16.6-7.5-.5 12.16-14.943 7.662zm-10.322 8.9l6.9 3.848-.8-9.116zm5.617-8.732L1.32 2.15 6.3 15.6zm-8.17 9.267l9.015 5.514 1.54 11.028-8.795-5.735zm15.53 5.89l.332 8.662 12.286-2.665.664-11.826zm14.61 84.783L33.28 76.062l-.08-20.53-11.654-5.736-1.32 37.5zM22.735 35.64L22.57 46.3l11.787 3.166.166-16.657zm-14.16-5.255L16.49 35.9l1.1 11.25-8.8-7.06zm8.79 22.74l-9.673-7.28-.84 9.78L-.006 68.29l10.564 14.594 5.5.883 1.98-20.735zM56 7.488l-16.6-7.5.5 12.16 14.942 7.66zm10.32 8.9l-6.9 3.847.8-9.116zm-5.617-8.733L73.93 2.148l-4.98 13.447zm8.17 9.267l-9.015 5.514-1.54 11.03 8.8-5.736zm-15.53 5.89l-.332 8.662-12.285-2.665-.664-11.827zm-14.61 84.783l3.234-31.536.082-20.532 11.65-5.735 1.32 37.5zm13.78-71.957l.166 10.66-11.786 3.168-.166-16.657zm14.16-5.256l-7.915 5.514-1.1 11.25 8.794-7.06zm-8.79 22.743l9.673-7.28.84 9.78 6.862 12.66-10.564 14.597-5.5.883-1.975-20.74z', w: 75.25, h: 107.594 },
    'left-leg':     { d: 'm 18.00179,139.99461 -0.664,5.99 4.647,5.77 1.55,9.1 3.1,1.33 2.655,-13.755 1.77,-4.88 -1.55,-3.107 z m 20.582,0.444 -3.32,9.318 -7.082,13.755 1.77,12.647 5.09,-14.2 4.205,-7.982 z m -26.557,-12.645 5.09,27.29 -3.32,-1.777 -2.656,8.875 z m 22.795,42.374 -1.55,4.88 -3.32,20.634 -0.442,27.51 4.65,26.847 -0.223,-34.39 4.87,-13.754 0.663,-15.087 z m -10.623,12.424 1.106,41.267 c 14.157565,64.57987 -5.846437,10.46082 -16.8199998,-29.07 l 5.5329998,-36.384 z m -9.71,-178.164003 0,22.476 15.71,31.073 9.923,30.850003 -1.033,-21.375 z m 25.49,30.248 0.118,-0.148 -0.793,-2.024 -16.545,-18.16 -1.242,-0.44 10.984,28.378 z m -6.255,10.766 6.812,17.6 2.274,-21.596 -1.344,-3.43 z m -26.4699998,17.82 0.827,25.340003 12.8159998,35.257 -3.928,10.136 -12.6099998,-44.51 z M 31.81879,76.04161 l 0.345,0.826 6.47,15.48 -4.177,38.342 -6.594,-3.526 5.715,-35.7 z m -21.465,-74.697003 0.827,21.373 L 4.1527902,65.02561 0.84679017,30.870607 Z m 2.068,27.323 14.677,32.391 3.307,26.000003 -6.2,36.58 -13.437,-37.241 -0.8269998,-38.342003 z', w: 93.626, h: 250.625 },
    'right-leg':    { d: 'm 26.664979,139.7913 0.663,5.99 -4.647,5.77 -1.55,9.1 -3.1,1.33 -2.655,-13.755 -1.77,-4.88 1.55,-3.107 z m -20.5820002,0.444 3.3200005,9.318 7.0799997,13.755 -1.77,12.647 -5.0899997,-14.2 -4.2000005,-7.987 z m 3.7620005,29.73 1.5499997,4.88 3.32,20.633 0.442,27.51 -4.648,26.847 0.22,-34.39 -4.8670002,-13.754 -0.67,-15.087 z m 10.6229997,12.424 -1.107,41.267 -8.852,33.28 9.627,-4.55 16.046,-57.8 -5.533,-36.384 z m -13.9460002,74.991 c -5.157661,19.45233 -2.5788305,9.72616 0,0 z M 30.177979,4.225305 l 0,22.476 -15.713,31.072 -9.9230002,30.850005 1.033,-21.375005 z m -25.4930002,30.249 -0.118,-0.15 0.793,-2.023 16.5450002,-18.16 1.24,-0.44 -10.98,28.377 z m 6.2550002,10.764 -6.8120002,17.6 -2.274,-21.595 1.344,-3.43 z m 26.47,17.82 -0.827,25.342005 -12.816,35.25599 3.927,10.136 12.61,-44.50999 z m -24.565,12.783005 -0.346,0.825 -6.4700002,15.48 4.1780002,38.34199 6.594,-3.527 -5.715,-35.69999 z m 19.792,51.74999 -5.09,27.29 3.32,-1.776 2.655,8.875 z m 1.671,-126.452995 -0.826,21.375 7.03,42.308 3.306,-34.155 z m -2.066,27.325 -14.677,32.392 -3.308,26.000005 6.2,36.57999 13.436,-37.23999 0.827,-38.340005 z', w: 80, h: 250.625 },
    'left-hand':    { d: 'm 21.255,-0.00198191 2.88,6.90000201 8.412,1.335 0.664,12.4579799 -4.427,17.8 -2.878,-0.22 2.8,-11.847 -2.99,-0.084 -4.676,12.6 -3.544,-0.446 4.4,-12.736 -3.072,-0.584 -5.978,13.543 -4.428,-0.445 6.088,-14.1 -2.1,-1.25 L 4.878,34.934 1.114,34.489 12.4,12.9 11.293,11.12 0.665,15.57 0,13.124 8.635,5.3380201 Z', w: 90, h: 38.938 },
    'right-hand':   { d: 'm 13.793386,-0.00198533 -2.88,6.90000163 -8.4120002,1.335 -0.664,12.4579837 4.427,17.8 2.878,-0.22 -2.8,-11.847 2.99,-0.084 4.6760002,12.6 3.544,-0.446 -4.4,-12.736 3.072,-0.584 5.978,13.543 4.428,-0.445 -6.088,-14.1 2.1,-1.25 7.528,12.012 3.764,-0.445 -11.286,-21.589 1.107,-1.78 10.628,4.45 0.665,-2.447 -8.635,-7.7859837 z', w: 90, h: 38.938 },
    'left-foot':    { d: 'm 19.558357,1.92821 c -22.1993328,20.55867 -11.0996668,10.27933 0,0 z m 5.975,5.989 -0.664,18.415 -1.55,6.435 -4.647,0 -1.327,-4.437 -1.55,-0.222 0.332,4.437 -5.864,-1.778 -1.5499998,-0.887 -6.64,-1.442 -0.22,-5.214 6.418,-10.87 4.4259998,-5.548 c 9.991542,-3.26362 9.41586,-8.41457 12.836,1.111 z', w: 30, h: 30 },
    'right-foot':   { d: 'm 11.723492,2.35897 c -40.202667,20.558 -20.1013335,10.279 0,0 z m -5.9740005,5.989 0.663,18.415 1.546,6.435 4.6480005,0 1.328,-4.437 1.55,-0.222 -0.333,4.437 5.863,-1.778 1.55,-0.887 6.638,-1.442 0.222,-5.214 -6.418,-10.868 -4.426,-5.547 -10.8440005,-4.437 z', w: 30, h: 30 }
  };

  /* Target center coordinates for each region in the unified viewBox.
   *
   * The unified viewBox is "-5 -6 320 510", so the body is centered
   * at x=103 (the 50% line of the original 207px container) and
   * roughly y=0..470 vertically.
   *
   * The previous implementation translated source-CSS positions
   * (pos.x, pos.y) using source-container-width math, but the source
   * CSS positioned paths at the LEFT edge of wide containers
   * (e.g. left-arm path is 40 wide inside a 156-wide container). The
   * math centered everything on the body centerline instead of
   * mirroring left/right parts around it.
   *
   * This table defines the intended visible center for each region.
   * At render time, the path's actual bbox is measured and the
   * nested SVG is positioned so the path's bbox center lands on
   * TARGET_CENTERS[key]. */
  var TARGET_CENTERS = {
    /* Centered regions */
    head:           { x: 103, y: 40  },
    chest:          { x: 103, y: 100 },
    stomach:        { x: 103, y: 200 },
    /* Shoulders — just inside the arms */
    'left-shoulder': { x: 78,  y: 100 },
    'right-shoulder':{ x: 128, y: 100 },
    /* Arms — outside the shoulders, mid-height of arm */
    'left-arm':     { x: 48,  y: 170 },
    'right-arm':    { x: 158, y: 170 },
    /* Hands — overlap deeply into the arm bbox */
    'left-hand':    { x: 30,  y: 215 },
    'right-hand':   { x: 176, y: 215 },
    /* Legs — bbox includes both "leg main body" sub-paths (upper
     * half) and "foot shape" sub-paths (lower half). Position so
     * the leg main body's visible bottom meets the actual foot's
     * visible top. */
    'left-leg':     { x: 82,  y: 270 },
    'right-leg':    { x: 124, y: 270 },
    /* Feet — overlap with the bottom of the leg's "leg main body"
     * sub-paths so the leg's "foot shape" sub-paths are hidden
     * behind the actual foot path. */
    'left-foot':    { x: 82,  y: 410 },
    'right-foot':   { x: 124, y: 410 }
  };

  /* Source viewBox dimensions for each path. Used to create a
   * temporary path to compute getBBox() at render time. */

  /* Original CSS viewBox dimensions for each path. Used to create a
   * temporary path to compute getBBox() at render time. */

  /* Trunk distribution ratios — splits the 5-region 'trunk' segment
   * across 4 anatomical regions. These sum to 1.0. */
  var TRUNK_SPLIT = {
    'left-shoulder':  0.10,
    'right-shoulder': 0.10,
    chest:           0.30,
    stomach:         0.50
  };

  /* Hands/feet estimated as small fixed percentages of arm/leg muscle. */
  var EXTREMITY_RATIOS = {
    'left-hand':  0.08,
    'right-hand': 0.08,
    'left-foot':  0.04,
    'right-foot': 0.04
  };

  /* Color thresholds — same as body-map.js for consistency */
  var HEALTH_COLORS = {
    good:    '#22c55e',
    normal:  '#38bdf8',
    warning: '#f59e0b',
    concern: '#ef4444'
  };

  var VIEW_MODES = {
    'fat_pct':    { label: 'Fat %',     unit: '%',  higherIsBetter: false, mode: 'fat_pct'    },
    'fat_lbs':    { label: 'Fat lbs',   unit: 'lbs', higherIsBetter: false, mode: 'fat_kg'     },
    'muscle_lbs': { label: 'Muscle lbs',unit: 'lbs', higherIsBetter: true,  mode: 'muscle_kg'  }
  };

  /* Display labels for tooltip */
  var REGION_LABELS = {
    head:            'Head',
    'left-shoulder': 'Left Shoulder',
    'right-shoulder':'Right Shoulder',
    'left-arm':      'Left Arm',
    'right-arm':     'Right Arm',
    chest:           'Chest',
    stomach:         'Stomach',
    'left-leg':      'Left Leg',
    'right-leg':     'Right Leg',
    'left-hand':     'Left Hand',
    'right-hand':    'Right Hand',
    'left-foot':     'Left Foot',
    'right-foot':    'Right Foot'
  };

  /* Z-order: which regions draw on top of which. Hands and feet on
   * top of arms/legs. Arms in front of shoulders. Right-arm in front
   * of stomach/legs. */
  var Z_ORDER = [
    'left-shoulder', 'right-shoulder', 'chest', 'stomach',
    'left-leg', 'right-leg', 'left-arm', 'right-arm',
    'left-hand', 'right-hand', 'left-foot', 'right-foot',
    'head'
  ];

  /* ================================================================
   * STATE
   * ================================================================ */

  var initialized = false;
  var currentViewMode = 'fat_pct';
  var measurementData = null;
  var activeTooltip = null;

  /* ================================================================
   * HELPERS
   * ================================================================ */

  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function fmtNum(v) {
    if (v === null || v === undefined || isNaN(v)) return '--';
    return Number(v).toFixed(1);
  }

  function fmtWeight(kg) {
    var n = toNum(kg);
    if (n === null) return '--';
    return (n * 2.20462).toFixed(1);
  }

  /* ================================================================
   * SEGMENTAL ESTIMATION
   *
   * Hume scale only provides 5 segments (trunk, left/right arm, left/
   * right leg). For the 13-region view, we:
   *   1. Map Hume's 5 segments to the 8 anatomical regions they
   *      directly correspond to (arms, legs, shoulders, chest, stomach)
   *   2. Distribute trunk mass across its 4 sub-regions using
   *      TRUNK_SPLIT ratios
   *   3. Estimate hands/feet as fixed percentages of arm/leg muscle
   *   4. Render head as visual-only (no measurement)
   * ================================================================ */

  function getRegionValue(data, regionKey, viewMode) {
    if (!data) return 0;

    var mode = VIEW_MODES[viewMode].mode;
    var value = 0;

    /* Direct Hume segment mapping */
    if (regionKey === 'left-arm' || regionKey === 'right-arm' ||
        regionKey === 'left-leg' || regionKey === 'right-leg') {
      var segKeyMap = {
        'fat_pct':    { 'left-arm': 'seg_left_arm_fat_pct',    'right-arm': 'seg_right_arm_fat_pct',    'left-leg': 'seg_left_leg_fat_pct',    'right-leg': 'seg_right_leg_fat_pct' },
        'fat_kg':     { 'left-arm': 'seg_left_arm_fat_kg',     'right-arm': 'seg_right_arm_fat_kg',     'left-leg': 'seg_left_leg_fat_kg',     'right-leg': 'seg_right_leg_fat_kg' },
        'muscle_kg':  { 'left-arm': 'seg_left_arm_muscle_kg',  'right-arm': 'seg_right_arm_muscle_kg',  'left-leg': 'seg_left_leg_muscle_kg',  'right-leg': 'seg_right_leg_muscle_kg' }
      };
      var field = segKeyMap[mode][regionKey];
      var real = field ? toNum(data[field]) : null;
      if (real !== null && real > 0) return real;
      /* Fallback: estimate from overall metric */
      return estimateFromOverall(data, regionKey, mode);
    }

    /* Trunk sub-regions: distribute Hume trunk across 4 anatomical areas */
    if (regionKey === 'left-shoulder' || regionKey === 'right-shoulder' ||
        regionKey === 'chest' || regionKey === 'stomach') {
      var trunkSplit = TRUNK_SPLIT[regionKey];
      var trunkValue = estimateFromOverall(data, 'trunk', mode);
      return trunkValue * trunkSplit;
    }

    /* Hands: estimated as % of arm muscle */
    if (regionKey === 'left-hand' || regionKey === 'right-hand') {
      var armKey = regionKey === 'left-hand' ? 'left-arm' : 'right-arm';
      var armValue = getRegionValue(data, armKey, viewMode);
      return armValue * EXTREMITY_RATIOS[regionKey];
    }

    /* Feet: estimated as % of leg muscle */
    if (regionKey === 'left-foot' || regionKey === 'right-foot') {
      var legKey = regionKey === 'left-foot' ? 'left-leg' : 'right-leg';
      var legValue = getRegionValue(data, legKey, viewMode);
      return legValue * EXTREMITY_RATIOS[regionKey];
    }

    /* Head: no measurement available */
    return 0;
  }

  /* Estimate a region's value from overall body composition when
   * Hume's segmental data isn't available. Mirrors the logic in
   * body-map.js DISTRIBUTION table. */
  function estimateFromOverall(data, regionKey, mode) {
    var DISTRIBUTION = {
      'left-arm':  { muscle: 0.08, fat: 0.07, fatPct: 0.70 },
      'right-arm': { muscle: 0.08, fat: 0.07, fatPct: 0.70 },
      'trunk':     { muscle: 0.40, fat: 0.50, fatPct: 1.15 },
      'left-leg':  { muscle: 0.22, fat: 0.18, fatPct: 1.05 },
      'right-leg': { muscle: 0.22, fat: 0.18, fatPct: 1.05 }
    };

    var dist = DISTRIBUTION[regionKey];
    if (!dist) return 0;

    if (mode === 'fat_pct') {
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

  /* Rate a region by health threshold */
  function rateRegion(value, higherIsBetter) {
    if (value == null || isNaN(value) || value <= 0) return 'normal';
    if (higherIsBetter) {
      if (value >= 15) return 'good';
      if (value >= 8)  return 'normal';
      if (value >= 4)  return 'warning';
      return 'concern';
    } else {
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
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    var mode = VIEW_MODES[currentViewMode];
    if (!mode) return;

    var html = '';

    /* Stats bar (same as body-map.js) */
    html += '<div class="body-map-stats">';
    html += buildStatItem('Weight', measurementData ? fmtWeight(measurementData.weight_kg) : '--', 'lbs', 'weight');
    html += buildStatItem('Body Fat', measurementData ? fmtNum(measurementData.body_fat_pct) : '--', '%', 'scan');
    html += buildStatItem('Lean Mass', measurementData ? fmtWeight(measurementData.lean_mass_kg) : '--', 'lbs', 'dumbbell');
    html += buildStatItem('BMI', measurementData ? fmtNum(measurementData.bmi) : '--', '', 'ruler');
    html += '</div>';

    /* View mode toggles */
    html += '<div class="body-map-toggles">';
    for (var modeKey in VIEW_MODES) {
      if (!VIEW_MODES.hasOwnProperty(modeKey)) continue;
      var m = VIEW_MODES[modeKey];
      html += '<button class="body-map-toggle' + (modeKey === currentViewMode ? ' active' : '') + '" data-mode="' + modeKey + '">' + m.label + '</button>';
    }
    html += '</div>';

    /* View label — only the 8-region anatomical view remains
     * (5-region simple view removed in PR #9, see commit) */
    html += '<div class="body-map-view-modes">';
    html += '<span class="body-map-view-current">8-Region Anatomical</span>';
    html += '</div>';

    /* Color legend */
    html += '<div class="body-map-legend">';
    html += '<div class="legend-item"><span class="legend-swatch" style="background:' + HEALTH_COLORS.good + '"></span> Good</div>';
    html += '<div class="legend-item"><span class="legend-swatch" style="background:' + HEALTH_COLORS.normal + '"></span> Normal</div>';
    html += '<div class="legend-item"><span class="legend-swatch" style="background:' + HEALTH_COLORS.warning + '"></span> Warning</div>';
    html += '<div class="legend-item"><span class="legend-swatch" style="background:' + HEALTH_COLORS.concern + '"></span> Concern</div>';
    html += '</div>';

    /* Image-map body — delegates to body-imagemap.js.
     * Replaces the old SVG-path approach (PR #4-#6) which had
     * alignment issues because the source paths have empty space
     * inside their bounding boxes. The image-map approach uses
     * hand-drawn polygon coords over a static anatomical image
     * and shows color coding in the tooltip (not the image). */
    html += '<div class="body-anatomical-container" id="body-anatomical-container">';
    html += '<div id="body-imagemap-host"></div>';
    html += '</div>';

    /* Tooltip element */
    html += '<div class="body-anatomical-tooltip" id="body-anatomical-tooltip" style="display:none"></div>';

    container.innerHTML = html;

    /* Attach event handlers */
    attachEventHandlers();

    /* Hand off the body rendering to body-imagemap.js. It reads
     * measurementData and currentViewMode from the same module-level
     * state used by the rest of body-anatomical.js (via the global
     * window.HealthAgent.bodyAnatomical namespace) and renders the
     * image map into the host div. */
    if (window.HealthAgent && window.HealthAgent.bodyImagemap) {
      /* Sync the current view mode and data into body-imagemap.js */
      var imagemapModule = window.HealthAgent.bodyImagemap;
      /* Find body-imagemap's render() function via the closure we
       * attached during init. body-imagemap.js is an IIFE so we
       * need to call its exposed init() which re-renders. */
      var host = document.getElementById('body-imagemap-host');
      if (host) {
        imagemapModule.init(host, measurementData);
        /* Re-use body-anatomical's view mode rather than the
         * imagemap module's own. Sync the mode. */
        if (typeof imagemapModule.setViewMode === 'function') {
          imagemapModule.setViewMode(currentViewMode);
        }
      }
    }
  }

  function buildStatItem(label, value, unit, icon) {
    return '<div class="body-map-stat-item">' +
      '<div class="body-map-stat-icon"><i data-lucide="' + icon + '" style="width:14px;height:14px"></i></div>' +
      '<div class="body-map-stat-value">' + value + '<span class="body-map-stat-unit">' + unit + '</span></div>' +
      '<div class="body-map-stat-label">' + label + '</div>' +
      '</div>';
  }

  /* Build the single SVG with all 13 regions as <svg> nested elements.
   *
   * Each region is positioned by its TARGET_CENTERS target: the
   * path's actual bbox is measured at render time, and the nested
   * SVG is placed so the path's bbox center lands exactly on
   * TARGET_CENTERS[key]. This decouples us from the source CSS
   * positions entirely.
   *
   * Concretely, for each region:
   *   - Compute path bbox = (bbox.x, bbox.y, bbox.w, bbox.h)
   *   - target = TARGET_CENTERS[key] = (tx, ty)
   *   - nestedX = tx - bbox.w / 2   (path's left edge in unified viewBox)
   *   - nestedY = ty - bbox.h / 2   (path's top edge in unified viewBox)
   *   - nestedWidth  = bbox.w
   *   - nestedHeight = bbox.h
   *   - viewBox = "bbox.x bbox.y bbox.w bbox.h"
   *     (the path is drawn using its source d, but the nested SVG
   *     crops to the path's actual extent, so the bbox is the
   *     entire nested SVG content). */
  function buildAnatomicalSVG() {
    var mode = VIEW_MODES[currentViewMode];
    var data = measurementData;

    /* viewBox chosen to fit all 13 regions with a small margin.
     * Centered around x=103 (the body centerline) and y=0..470
     * vertically. */
    var svg = '<svg id="body-anatomical-svg" viewBox="-5 -6 320 510" xmlns="http://www.w3.org/2000/svg" ' +
              'preserveAspectRatio="xMidYMin meet" ' +
              'style="width:100%;height:100%;display:block">';

    /* Drop-shadow filter for depth */
    svg += '<defs>' +
      '<filter id="body-anatomical-shadow" x="-10%" y="-10%" width="120%" height="120%">' +
      '<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.4"/>' +
      '</filter>' +
      '</defs>';

    svg += '<g filter="url(#body-anatomical-shadow)">';

    /* Pre-compute each path's actual bounding box using a hidden
     * temporary SVG. getBBox() requires the path to be in the DOM. */
    var bboxes = computeBBoxes();

    /* Draw regions in z-order so hands/feet render on top of arms/legs */
    for (var i = 0; i < Z_ORDER.length; i++) {
      var key = Z_ORDER[i];
      var pathInfo = ANATOMICAL_PATHS[key];
      var target = TARGET_CENTERS[key];
      var bbox = bboxes[key];

      /* Get value for this region */
      var val = data ? getRegionValue(data, key, currentViewMode) : 0;
      if (currentViewMode === 'fat_lbs' || currentViewMode === 'muscle_lbs') {
        val = val * 2.20462;
      }

      var rating = rateRegion(val, mode.higherIsBetter);
      var color = HEALTH_COLORS[rating];

      if (key === 'head') {
        color = '#64748b';
        val = 0;
      }

      /* Position the nested SVG so the path's bbox center lands on
       * (target.x, target.y). nestedX/nestedY are the nested SVG's
       * top-left in the unified viewBox. */
      var nestedX = target.x - bbox.w / 2;
      var nestedY = target.y - bbox.h / 2;

      svg += '<svg class="anatomical-region" data-region="' + key + '" ' +
             'x="' + nestedX.toFixed(3) + '" y="' + nestedY.toFixed(3) + '" ' +
             'width="' + bbox.w.toFixed(3) + '" height="' + bbox.h.toFixed(3) + '" ' +
             'viewBox="' + bbox.x.toFixed(3) + ' ' + bbox.y.toFixed(3) + ' ' +
                        bbox.w.toFixed(3) + ' ' + bbox.h.toFixed(3) + '" ' +
             'data-original-fill="' + color + '" ' +
             'style="cursor:pointer;overflow:visible">';
      svg += '<path d="' + pathInfo.d + '" ' +
             'fill="' + color + '" fill-opacity="0.7" ' +
             'stroke="' + color + '" stroke-width="0.5" stroke-opacity="0.9" ' +
             'class="anatomical-path"/>';
      svg += '</svg>';
    }

    svg += '</g>';
    svg += '</svg>';

    return svg;
  }

  /* Compute each path's actual bounding box by rendering each path
   * inside a hidden temporary <svg> and calling getBBox(). Returns
   * a {x, y, w, h} object for each region key. */
  function computeBBoxes() {
    var bboxes = {};
    var tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '1px';
    tempContainer.style.height = '1px';
    tempContainer.style.overflow = 'hidden';

    var tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tempSvg.setAttribute('width', '1');
    tempSvg.setAttribute('height', '1');
    tempContainer.appendChild(tempSvg);
    document.body.appendChild(tempContainer);

    var keys = Object.keys(ANATOMICAL_PATHS);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var pathInfo = ANATOMICAL_PATHS[key];

      var tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempPath.setAttribute('d', pathInfo.d);
      tempSvg.appendChild(tempPath);

      var bbox = tempPath.getBBox();
      bboxes[key] = { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };

      tempSvg.removeChild(tempPath);
    }

    document.body.removeChild(tempContainer);
    return bboxes;
  }

  /* ================================================================
   * EVENT HANDLERS
   * ================================================================ */

  function attachEventHandlers() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    /* View mode toggle buttons (Fat %, Fat lbs, Muscle lbs) */
    var modeButtons = container.querySelectorAll('.body-map-toggle');
    for (var i = 0; i < modeButtons.length; i++) {
      modeButtons[i].addEventListener('click', onModeToggleClick);
    }

    /* Region hover/click — attach to <g> elements in the unified SVG */
    var regions = container.querySelectorAll('.anatomical-region');
    for (var j = 0; j < regions.length; j++) {
      regions[j].addEventListener('mouseenter', onRegionHover);
      regions[j].addEventListener('mouseleave', onRegionLeave);
      regions[j].addEventListener('click', onRegionClick);
    }

    /* Re-render Lucide icons */
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  }

  function onModeToggleClick(e) {
    var btn = e.currentTarget;
    var newMode = btn.getAttribute('data-mode');
    if (newMode && newMode !== currentViewMode) {
      currentViewMode = newMode;
      render();
      /* Sync the view mode to body-imagemap so its tooltip uses
       * the same metric (fat% / fat lbs / muscle lbs). */
      if (window.HealthAgent && window.HealthAgent.bodyImagemap &&
          typeof window.HealthAgent.bodyImagemap.setViewMode === 'function') {
        window.HealthAgent.bodyImagemap.setViewMode(newMode);
      }
    }
  }

  function onRegionHover(e) {
    var group = e.currentTarget;
    var path = group.querySelector('.anatomical-path');
    if (path) {
      path.setAttribute('fill', '#ff7d16');  /* orange highlight */
      path.setAttribute('fill-opacity', '0.85');
    }
    showTooltip(group);
  }

  function onRegionLeave(e) {
    var group = e.currentTarget;
    if (activeTooltip === group) return;  /* keep persistent tooltip */
    var path = group.querySelector('.anatomical-path');
    if (path) {
      var orig = group.getAttribute('data-original-fill');
      if (orig) {
        path.setAttribute('fill', orig);
        path.setAttribute('fill-opacity', '0.7');
      }
    }
    hideTooltip();
  }

  function onRegionClick(e) {
    var group = e.currentTarget;
    showTooltip(group, true);  /* persistent */
  }

  function showTooltip(group, persistent) {
    var tooltip = document.getElementById('body-anatomical-tooltip');
    if (!tooltip) return;

    var regionKey = group.getAttribute('data-region');
    var label = REGION_LABELS[regionKey] || regionKey;
    var mode = VIEW_MODES[currentViewMode];
    var data = measurementData;
    var val = data ? getRegionValue(data, regionKey, currentViewMode) : 0;
    if (currentViewMode === 'fat_lbs' || currentViewMode === 'muscle_lbs') {
      val = val * 2.20462;
    }

    var displayVal = val > 0 ? fmtNum(val) + mode.unit : 'no data';
    var rating = rateRegion(val, mode.higherIsBetter);
    var ratingLabel = rating.charAt(0).toUpperCase() + rating.slice(1);

    tooltip.innerHTML = '<div class="tooltip-label">' + label + '</div>' +
      '<div class="tooltip-value">' + displayVal + '</div>' +
      '<div class="tooltip-rating tooltip-rating-' + rating + '">' + ratingLabel + '</div>';
    tooltip.style.display = 'block';

    /* Get bounding rect of the <path> inside the region — uses the
     * actual rendered shape, not the nested SVG's viewBox area. */
    var path = group.querySelector('.anatomical-path');
    if (!path) return;
    var rect = path.getBoundingClientRect();

    var tooltipX = rect.left + rect.width / 2;
    var tooltipY = rect.top - 8;
    tooltip.style.left = tooltipX + 'px';
    tooltip.style.top = tooltipY + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';

    if (persistent) {
      if (activeTooltip && activeTooltip !== group) {
        activeTooltip.classList.remove('persistent-tooltip');
      }
      activeTooltip = group;
      group.classList.add('persistent-tooltip');
    }
  }

  function hideTooltip() {
    if (activeTooltip) return;  /* keep persistent tooltip visible */
    var tooltip = document.getElementById('body-anatomical-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }

  /* ================================================================
   * DATA FETCH
   * ================================================================ */

  function fetchLatestMeasurement() {
    return fetch(API_BASE + '/api/health/measurements/latest')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        measurementData = data;
        return data;
      });
  }

  /* ================================================================
   * PUBLIC API
   * ================================================================ */

  function init() {
    initialized = true;

    fetchLatestMeasurement()
      .then(render)
      .catch(function (err) {
        console.warn('[body-anatomical] Failed to fetch latest measurement:', err);
        render();  /* render with no data */
      });
  }

  function refresh() {
    return fetchLatestMeasurement()
      .then(render)
      .catch(function (err) {
        console.warn('[body-anatomical] Refresh failed:', err);
        render();
      });
  }

  /* Expose to window for debugging and cross-module coordination */
  window.HealthAgent = window.HealthAgent || {};
  window.HealthAgent.bodyAnatomical = {
    init: init,
    refresh: refresh,
    render: render,
    setViewMode: function (mode) { currentViewMode = mode; render(); }
  };

  /* Auto-initialize when the body-map subtab is activated.
   * The body's app.js activates subtabs by adding .active class, so
   * we use a MutationObserver to detect that.
   *
   * Previously the anatomical view was opt-in (body-map.js's render()
   * showed the toggle button that called our init()). The 5-region
   * simple view was removed in PR #9; the anatomical view is now the
   * only view, so it auto-initializes when the subtab is activated. */
  if (document.getElementById('subtab-body-map')) {
    var bodyMapSubtab = document.getElementById('subtab-body-map');
    var bodyMapObserver = new MutationObserver(function (mutations) {
      for (var k = 0; k < mutations.length; k++) {
        if (mutations[k].attributeName === 'class' &&
            bodyMapSubtab.classList.contains('active') &&
            !initialized) {
          init();
          break;
        }
      }
    });
    bodyMapObserver.observe(bodyMapSubtab, {
      attributes: true,
      attributeFilter: ['class']
    });
    /* Try immediate init in case the subtab is already active
     * (e.g. user reloads page while on the body-map tab). */
    if (bodyMapSubtab.classList.contains('active') && !initialized) {
      init();
    }
    /* Belt-and-suspenders: also poll the active state every 250ms
     * for the first 5 seconds after page load. This catches the
     * case where the MutationObserver misses the class change due
     * to a cache, race condition, or browser quirk. */
    var pollStart = Date.now();
    var pollInterval = setInterval(function () {
      if (initialized || Date.now() - pollStart > 5000) {
        clearInterval(pollInterval);
        return;
      }
      if (bodyMapSubtab.classList.contains('active')) {
        init();
      }
    }, 250);
  }

  console.log('[body-anatomical] Module loaded (auto-init on subtab activation)');
})();
