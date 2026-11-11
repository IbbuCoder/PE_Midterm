// Diagrams of the class machines: a Start frame and a Finish frame, side view.
// Drawn in the same style as the muscle map: outlined body, gray machine, worked muscle in red.
(function () {
  'use strict';

  // ---- drawing helpers ----
  function seg(a, b, cls, w) {
    return '<line class="' + cls + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"' + (w ? ' stroke-width="' + w + '"' : '') + '/>';
  }
  function poly(pts, cls, w) {
    return '<polyline class="' + cls + '" points="' + pts.map(function (p) { return p.join(','); }).join(' ') + '"' + (w ? ' stroke-width="' + w + '"' : '') + '/>';
  }
  function dot(p, r, cls) {
    return '<circle class="' + cls + '" cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '"/>';
  }
  function mid(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  // Limb widths, from the trunk out.
  var W = { torso: 19, thigh: 12, shin: 10, upper: 8.5, fore: 7.5 };

  // A person from joint points. The outline is a wider dark stroke under a light one,
  // so every limb reads as an outlined shape and the joints blend together.
  function person(p, hit) {
    var parts = [
      [p.S, p.H, W.torso], [p.H, p.K, W.thigh], [p.K, p.F, W.shin],
      [p.F, [p.F[0] + (p.toe || 7), p.F[1] + (p.toeY || 0)], 6],
      [p.S, p.E, W.upper], [p.E, p.W, W.fore]
    ];
    var out = '<g class="mxp-line">' + parts.map(function (s) { return seg(s[0], s[1], '', s[2] + 3.4); }).join('') + dot(p.head, 9.7, '') + '</g>';
    out += '<g class="mxp-fill">' + parts.map(function (s) { return seg(s[0], s[1], '', s[2]); }).join('') + dot(p.head, 8, '') + '</g>';
    // The worked muscle, drawn as a red section inside the outline.
    (hit || []).forEach(function (h) {
      if (h === 'thigh') out += seg(mid(p.H, p.K, 0.16), mid(p.H, p.K, 0.84), 'mxp-hit', W.thigh - 2.5);
      if (h === 'upper') out += seg(mid(p.S, p.E, 0.2), mid(p.S, p.E, 0.85), 'mxp-hit', W.upper - 2.5);
      if (h === 'glute') out += dot(p.glute || p.H, 6.5, 'mxp-hitfill');
      if (h === 'chest') out += '<ellipse class="mxp-hitfill" cx="' + p.chest[0] + '" cy="' + p.chest[1] + '" rx="4" ry="7.5"/>';
      if (h === 'delt') out += dot(p.S, 6, 'mxp-hitfill');
    });
    return out;
  }

  function arrow(x) {
    return '<g class="mx-arrow"><line x1="' + (x - 8) + '" y1="62" x2="' + (x + 6) + '" y2="62"/><polyline points="' + (x + 1) + ',56 ' + (x + 7) + ',62 ' + (x + 1) + ',68"/></g>';
  }

  // Two frames side by side.
  function frames(name, draw) {
    return '<svg class="mx" viewBox="0 0 262 124" role="img" aria-label="' + name + '">' +
      '<text class="mx-cap" x="60" y="10">Start</text><text class="mx-cap" x="202" y="10">Finish</text>' +
      '<g transform="translate(0 14)">' + draw(0) + '</g>' + arrow(131) +
      '<g transform="translate(142 14)">' + draw(1) + '</g></svg>';
  }

  var M = 'mxm';        // machine frame
  var PAD = 'mxm-pad';  // seats and pads
  var FLOOR = seg([4, 104], [116, 104], 'mxm-floor');

  // ---- the machines ----
  var ART = {};

  ART['leg-extension'] = frames('Leg extension: sit with the pad on your lower shins, then straighten your knees to lift it. Works the quadriceps.', function (f) {
    var p = { head: [36, 17], S: [37, 31], H: [42, 64], K: [74, 64], E: [44, 50], W: [52, 63], chest: [0, 0] };
    p.F = f ? [108, 58] : [77, 96];
    var roller = f ? [106, 50] : [86, 92];
    return FLOOR +
      seg([26, 22], [29, 70], PAD, 7) + seg([30, 71], [76, 71], PAD, 7) + seg([52, 74], [52, 104], M) + seg([30, 104], [90, 104], M) +
      seg([76, 68], roller, M, 4) +
      person(p, ['thigh']) + dot(roller, 5.5, PAD);
  });

  ART['leg-curl'] = frames('Leg curl: lie face down with the pad above your heels, then bend your knees to pull your heels toward your glutes. Works the hamstrings.', function (f) {
    var p = { head: [15, 50], S: [27, 55], H: [62, 55], K: [88, 56], E: [16, 66], W: [7, 74], toe: 3, toeY: 6, chest: [0, 0] };
    p.F = f ? [99, 25] : [114, 57];
    var roller = f ? [106, 25] : [112, 49];
    return FLOOR +
      seg([12, 64], [88, 64], PAD, 7) + seg([18, 68], [18, 104], M) + seg([7, 70], [7, 104], M, 3) + seg([78, 68], [78, 104], M) + seg([88, 66], [92, 104], M) +
      seg([90, 62], roller, M, 4) +
      person(p, ['thigh']) + dot(roller, 5.5, PAD);
  });

  ART['chest-press'] = frames('Chest press: sit with your back on the pad and the handles at chest height, then push them straight out. Works the pectorals.', function (f) {
    var p = { head: [38, 18], S: [37, 33], H: [41, 66], K: [72, 66], F: [74, 99], chest: [46, 42] };
    if (f) { p.E = [62, 40]; p.W = [88, 39]; } else { p.E = [36, 52]; p.W = [60, 40]; }
    return FLOOR +
      seg([25, 24], [28, 70], PAD, 7) + seg([29, 72], [72, 72], PAD, 7) + seg([50, 75], [50, 104], M) +
      seg([106, 18], [106, 104], M) + seg([30, 104], [116, 104], M) +
      seg([p.W[0], 39], [106, 39], M, 3) + seg([p.W[0], 32], [p.W[0], 47], 'mxm-handle') +
      person(p, ['chest']);
  });

  ART['shoulder-press'] = frames('Shoulder press: sit tall with the handles at shoulder height, then push them straight up over your head. Works the deltoids.', function (f) {
    var p = { head: [37, 26], S: [37, 41], H: [41, 74], K: [72, 74], F: [74, 102], chest: [0, 0] };
    if (f) { p.E = [44, 25]; p.W = [50, 9]; } else { p.E = [55, 50]; p.W = [54, 32]; }
    return seg([4, 104], [116, 104], 'mxm-floor') +
      seg([25, 32], [28, 78], PAD, 7) + seg([29, 80], [72, 80], PAD, 7) + seg([50, 83], [50, 104], M) +
      seg([74, 4], [74, 104], M) + seg([p.W[0], p.W[1]], [74, p.W[1]], M, 3) +
      seg([p.W[0] - 7, p.W[1]], [p.W[0] + 5, p.W[1]], 'mxm-handle') +
      person(p, ['delt']);
  });

  ART['arm-curl'] = frames('Arm curl: rest the backs of your upper arms on the pad, then curl the handle up toward your shoulders. Works the biceps.', function (f) {
    var p = { head: [32, 24], S: [34, 39], H: [34, 74], K: [64, 74], F: [66, 102], E: [70, 60], chest: [0, 0] };
    p.W = f ? [56, 30] : [96, 80];
    return FLOOR +
      seg([20, 78], [52, 78], PAD, 7) + seg([36, 81], [36, 104], M) +
      seg([44, 54], [76, 74], PAD, 8) + seg([72, 76], [78, 104], M) +
      person(p, ['upper']) + seg([p.W[0], p.W[1] - 7], [p.W[0], p.W[1] + 7], 'mxm-handle');
  });

  ART['leg-press'] = frames('Leg press: sit back with your feet flat on the plate, then push it away until your legs are almost straight. Works the gluteus maximus and quadriceps.', function (f) {
    var p = { head: [17, 31], S: [24, 45], H: [42, 76], E: [30, 64], W: [44, 70], toe: 0, toeY: -8, glute: [38, 80], chest: [0, 0] };
    if (f) { p.K = [74, 62]; p.F = [104, 58]; } else { p.K = [60, 42]; p.F = [82, 60]; }
    var plate = p.F[0] + 5;
    return FLOOR +
      seg([12, 38], [32, 82], PAD, 7) + seg([32, 84], [58, 84], PAD, 7) + seg([46, 87], [46, 104], M) +
      seg([56, 90], [116, 90], M) + seg([plate + 2, 76], [plate + 2, 90], M, 3) +
      person(p, ['glute', 'thigh']) + seg([plate, 46], [plate + 3, 76], 'mxm-plate');
  });

  PE.machineArt = ART;

  // How to use each machine, in two steps.
  PE.machineSteps = {
    'leg-curl': ['Lie face down with the pad just above your heels.', 'Bend your knees to pull your heels toward your glutes, then lower slowly.'],
    'chest-press': ['Sit with your back flat on the pad and the handles at chest height.', 'Push the handles straight out until your arms are straight, then bring them back slowly.'],
    'shoulder-press': ['Sit tall with the handles at shoulder height.', 'Push the handles straight up over your head, then lower them back to your shoulders.'],
    'arm-curl': ['Sit with the backs of your upper arms on the pad and your arms straight.', 'Curl the handle up toward your shoulders, then lower it slowly.'],
    'leg-extension': ['Sit with the pad in front of your lower shins and your knees bent.', 'Straighten your knees to lift the pad, then lower it slowly.'],
    'leg-press': ['Sit back with your feet flat on the plate and your knees bent.', 'Push the plate away until your legs are almost straight (don\'t lock your knees), then bend back slowly.']
  };
})();
