// Side-view drawings of the class machines.
// Gray = the machine, dark = the person, red = the muscle it works,
// faded limb = where the move starts, red arrow = which way it moves.
(function () {
  'use strict';

  function line(x1, y1, x2, y2, cls) {
    return '<line class="' + cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
  }
  function limb(points, cls) {
    return '<polyline class="' + cls + '" points="' + points + '"/>';
  }
  function head(cx, cy) {
    return '<circle class="mx-head" cx="' + cx + '" cy="' + cy + '" r="9"/>';
  }
  function pad(cx, cy) {
    return '<circle class="mx-pad" cx="' + cx + '" cy="' + cy + '" r="6"/>';
  }
  // A path with an arrowhead drawn at its end, pointing along (dx, dy).
  function arrow(d, tipX, tipY, dx, dy) {
    var len = Math.sqrt(dx * dx + dy * dy);
    var ux = dx / len, uy = dy / len;
    var bx = tipX - ux * 9, by = tipY - uy * 9;
    var px = -uy * 5, py = ux * 5;
    return '<path class="mx-move" d="' + d + '"/>' +
      '<polygon class="mx-tip" points="' + tipX + ',' + tipY + ' ' + (bx + px) + ',' + (by + py) + ' ' + (bx - px) + ',' + (by - py) + '"/>';
  }
  // The caption under each drawing names the muscle, so the drawing itself stays text-free.
  function label() {
    return '';
  }
  function svg(name, body) {
    return '<svg class="mx" viewBox="0 0 200 124" role="img" aria-label="' + name + '">' + body + '</svg>';
  }

  var FLOOR = '';

  PE.machineArt = {
    // Lying face down, curling the heel up toward the glutes.
    'leg-curl': svg('Leg curl: lying face down, curl your heels up toward your glutes. Works the hamstrings.',
      FLOOR +
      line(20, 74, 150, 74, 'mx-bench') + line(30, 78, 30, 118, 'mx-frame') + line(140, 78, 140, 118, 'mx-frame') +
      limb('140,64 182,66', 'mx-ghost') + '<circle class="mx-pad mx-ghostpad" cx="186" cy="70" r="6"/>' +
      head(24, 58) + limb('34,64 96,64', 'mx-body') + limb('42,66 46,88', 'mx-body') +
      line(96, 64, 140, 64, 'mx-hit') +
      limb('140,64 154,28', 'mx-body') + pad(158, 30) +
      arrow('M184 56 Q186 24 166 22', 166, 22, -10, -1) +
      label('Hamstrings')),

    // Sitting with your back on the pad, pushing the handles straight forward.
    'chest-press': svg('Chest press: sit with your back on the pad and push the handles straight forward. Works the pectorals.',
      FLOOR +
      line(36, 28, 36, 92, 'mx-bench') + line(36, 94, 92, 94, 'mx-bench') + line(64, 98, 64, 118, 'mx-frame') +
      line(124, 42, 124, 64, 'mx-handle') + limb('124,53 158,53 158,118', 'mx-frame') +
      limb('52,50 72,66 92,54', 'mx-ghost') +
      head(52, 28) + limb('50,40 56,88', 'mx-body') + limb('56,88 96,88 98,116', 'mx-body') +
      limb('52,50 88,54 122,53', 'mx-body') +
      '<ellipse class="mx-hitfill" cx="60" cy="58" rx="6" ry="10"/>' +
      arrow('M88 36 L122 36', 122, 36, 1, 0) +
      label('Pectorals')),

    // Sitting tall, pushing the handles straight up over your head.
    'shoulder-press': svg('Shoulder press: sit tall and push the handles straight up over your head. Works the deltoids.',
      FLOOR +
      line(36, 40, 36, 98, 'mx-bench') + line(36, 100, 92, 100, 'mx-bench') + line(64, 104, 64, 118, 'mx-frame') +
      line(62, 10, 88, 10, 'mx-handle') + limb('88,10 150,10 150,118', 'mx-frame') +
      limb('56,60 80,54 82,32', 'mx-ghost') +
      head(52, 46) + limb('52,56 56,94', 'mx-body') + limb('56,94 96,94 98,116', 'mx-body') +
      limb('56,60 68,36 75,12', 'mx-body') +
      '<circle class="mx-hitfill" cx="56" cy="60" r="7"/>' +
      arrow('M104 54 L104 18', 104, 18, 0, -1) +
      label('Deltoids')),

    // Upper arm resting on the pad, curling the handle up toward your shoulder.
    'arm-curl': svg('Arm curl: rest your upper arm on the pad and curl the handle up toward your shoulder. Works the biceps.',
      FLOOR +
      line(36, 100, 76, 100, 'mx-bench') + line(54, 104, 54, 118, 'mx-frame') +
      line(66, 70, 108, 92, 'mx-padbar') + limb('108,96 112,118', 'mx-frame') +
      limb('100,84 128,104', 'mx-ghost') + '<circle class="mx-pad mx-ghostpad" cx="131" cy="106" r="5"/>' +
      head(50, 46) + limb('50,56 56,96', 'mx-body') + limb('56,96 86,98 88,116', 'mx-body') +
      line(54, 64, 100, 84, 'mx-hit') +
      limb('100,84 86,50', 'mx-body') + '<circle class="mx-pad" cx="84" cy="46" r="5"/>' +
      arrow('M134 96 Q140 52 98 42', 98, 42, -10, -3) +
      label('Biceps')),

    // Sitting, straightening the knee to lift the pad in front of your shins.
    'leg-extension': svg('Leg extension: sit and straighten your knees to lift the pad. Works the quadriceps.',
      FLOOR +
      line(36, 24, 36, 82, 'mx-bench') + line(36, 84, 98, 84, 'mx-bench') + line(60, 88, 60, 118, 'mx-frame') +
      limb('96,78 98,112', 'mx-ghost') + '<circle class="mx-pad mx-ghostpad" cx="104" cy="110" r="6"/>' +
      head(50, 26) + limb('48,36 54,78', 'mx-body') + limb('52,46 66,64', 'mx-body') +
      line(54, 78, 96, 78, 'mx-hit') +
      limb('96,78 140,74', 'mx-body') + pad(142, 82) +
      arrow('M114 112 Q146 110 148 94', 148, 94, 1, -6) +
      label('Quadriceps')),

    // Leaning back, pushing the foot plate away with your legs.
    'leg-press': svg('Leg press: lean back and push the foot plate away with your legs. Works the gluteus maximus and quadriceps.',
      FLOOR +
      line(28, 44, 58, 98, 'mx-bench') + line(58, 100, 92, 100, 'mx-bench') + line(74, 104, 74, 118, 'mx-frame') +
      line(158, 36, 170, 70, 'mx-handle') + limb('170,70 178,118', 'mx-frame') +
      limb('72,92 100,56 126,72', 'mx-ghost') +
      head(36, 44) + limb('42,54 70,92', 'mx-body') + limb('50,64 76,76', 'mx-body') +
      '<circle class="mx-hitfill" cx="70" cy="96" r="8"/>' +
      line(72, 92, 116, 70, 'mx-hit') +
      limb('116,70 160,54', 'mx-body') +
      arrow('M118 40 L152 28', 152, 28, 3, -1) +
      label('Glutes + quadriceps'))
  };

  // The one-line how-to for each machine is the drawing's label.
  PE.machineHow = {};
  Object.keys(PE.machineArt).forEach(function (id) {
    var m = PE.machineArt[id].match(/aria-label="[^:]+: ([^"]+)"/);
    var how = m ? m[1].replace(/\s*Works the [^.]*\.$/, '') : '';
    PE.machineHow[id] = how.charAt(0).toUpperCase() + how.slice(1);
  });
})();
