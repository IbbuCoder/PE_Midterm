// Builds the front and back body figures as one inline SVG.
// Shapes are lists of [x, y] points for the right half of a figure centered on x = 0.
(function () {
  'use strict';

  // Turns points into a smooth closed curve.
  function smooth(pts) {
    var n = pts.length;
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n];
      var p1 = pts[i];
      var p2 = pts[(i + 1) % n];
      var p3 = pts[(i + 2) % n];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0] + ' ' + p2[1];
    }
    return d + 'Z';
  }

  // One shape that crosses the midline: right half plus its mirror.
  function sym(half) {
    var left = [];
    for (var i = half.length - 1; i >= 0; i--) {
      if (half[i][0] !== 0) left.push([-half[i][0], half[i][1]]);
    }
    return half.concat(left);
  }

  function mirror(pts) {
    return pts.map(function (p) { return [-p[0], p[1]]; });
  }

  function pair(pts) {
    return [smooth(pts), smooth(mirror(pts))];
  }

  function rect(x, y, w, h) {
    return [[x + 2, y], [x + w / 2, y - 0.5], [x + w - 2, y], [x + w, y + 2], [x + w, y + h - 2], [x + w - 2, y + h], [x + w / 2, y + h + 0.5], [x + 2, y + h], [x, y + h - 2], [x, y + 2]];
  }

  var TORSO = sym([[8, 44], [10, 54], [24, 60], [40, 66], [40, 84], [39, 104], [34, 132], [29, 165], [33, 190], [38, 210], [30, 228], [0, 234]]);
  var ARM = [[40, 63], [50, 65], [58, 76], [60, 100], [61, 130], [62, 150], [65, 175], [66, 205], [68, 222], [66, 238], [59, 240], [55, 225], [53, 205], [48, 175], [45, 150], [42, 125], [38, 100], [36, 78]];
  var LEG = [[20, 200], [36, 205], [38, 230], [35, 265], [28, 298], [29, 318], [31, 335], [26, 360], [18, 382], [20, 390], [26, 397], [10, 398], [9, 382], [7, 350], [7, 320], [9, 300], [5, 265], [2, 228], [4, 205]];

  var SILHOUETTE = [smooth(TORSO)].concat(pair(ARM), pair(LEG));

  var ABS = [];
  [111, 129, 147].forEach(function (y) { ABS = ABS.concat(pair(rect(2, y, 17, 15))); });
  ABS = ABS.concat(pair([[2, 165], [18, 165], [17, 185], [8, 205], [2, 210]]));

  var MUSCLES = {
    front: [
      { id: 'pectorals', paths: pair([[2, 74], [18, 69], [36, 74], [41, 86], [36, 100], [22, 107], [8, 106], [2, 100]]), badge: [20, 89] },
      { id: 'abdominals', paths: ABS, badge: [0, 146] },
      { id: 'deltoids', paths: pair([[38, 63], [49, 64], [58, 76], [60, 96], [55, 108], [47, 100], [42, 84], [37, 72]]), badge: [49, 84] },
      { id: 'biceps', paths: pair([[45, 110], [55, 110], [60, 125], [59, 143], [52, 150], [47, 143], [43, 125]]), badge: [52, 130] },
      { id: 'quadriceps', paths: pair([[20, 208], [34, 212], [37, 232], [33, 265], [27, 294], [18, 300], [10, 292], [8, 265], [6, 240], [10, 218]]), badge: [21, 256] }
    ],
    back: [
      { id: 'trapezius', paths: [smooth(sym([[8, 46], [11, 56], [24, 62], [40, 68], [30, 80], [16, 98], [6, 118], [0, 132]]))], badge: [0, 84] },
      { id: 'lats', paths: pair([[16, 102], [26, 98], [38, 100], [37, 122], [31, 148], [26, 165], [10, 180], [3, 176], [4, 150], [8, 125]]), badge: [21, 138] },
      { id: 'triceps', paths: pair([[45, 100], [56, 98], [60, 120], [59, 143], [52, 150], [47, 143], [42, 120]]), badge: [52, 124] },
      { id: 'glutes', paths: pair([[3, 192], [20, 184], [34, 192], [38, 212], [30, 230], [12, 233], [3, 226]]), badge: [20, 209] },
      { id: 'hamstrings', paths: pair([[10, 238], [20, 236], [32, 238], [36, 255], [31, 285], [26, 302], [19, 305], [12, 300], [8, 270], [6, 250]]), badge: [21, 270] },
      { id: 'gastrocnemius', paths: pair([[11, 314], [19, 309], [27, 314], [30, 333], [26, 354], [20, 368], [14, 362], [9, 345], [8, 328]]), badge: [19, 337] }
    ]
  };

  // Faint non-clickable lines that make the figure read as a body.
  var DETAILS = {
    front: ['M0 74V106', 'M-14 306Q-18 316 -14 324', 'M14 306Q18 316 14 324', 'M50 160Q54 180 57 205', 'M-50 160Q-54 180 -57 205'],
    back: ['M0 132V188', 'M0 190V230', 'M50 160Q54 180 57 205', 'M-50 160Q-54 180 -57 205', 'M38 70Q50 76 54 92', 'M-38 70Q-50 76 -54 92']
  };

  function paths(list, cls) {
    return list.map(function (d) { return '<path class="' + cls + '" d="' + d + '"/>'; }).join('');
  }

  function figure(view, cx, numbers) {
    var html = '<g transform="translate(' + cx + ' 24)">';
    // Stroked layer first, filled layer on top, so only the outer edge shows.
    var shapes = '<ellipse cx="0" cy="24" rx="17" ry="23"/>' + SILHOUETTE.map(function (d) { return '<path d="' + d + '"/>'; }).join('');
    html += '<g class="body-line">' + shapes + '</g><g class="body-fill">' + shapes + '</g>';
    html += paths(DETAILS[view], 'body-detail');

    var shapesHtml = '';
    var badges = '';
    MUSCLES[view].forEach(function (m) {
      shapesHtml += '<g class="m" data-muscle="' + m.id + '">' + paths(m.paths, 'm-shape') + paths(m.paths, 'm-hit') + '</g>';
      badges += '<g class="m-badge" data-muscle="' + m.id + '" tabindex="0" role="button" transform="translate(' + m.badge[0] + ' ' + m.badge[1] + ')">' +
        '<circle class="b-hit" r="15"/><circle class="b-dot" r="9.5"/><text class="b-num" dy="0.35em">' + numbers[m.id] + '</text></g>';
    });
    return html + shapesHtml + badges + '</g>';
  }

  // A small copy of the figure for one or both views, with the given muscles in red.
  window.PE_bodyMini = function (views, lit, label) {
    var out = '<svg viewBox="0 0 ' + (160 * views.length) + ' 430" class="mini-body" role="img" aria-label="' + label + '">';
    views.forEach(function (view, i) {
      var cx = 80 + 160 * i;
      var shapes = '<ellipse cx="0" cy="24" rx="17" ry="23"/>' + SILHOUETTE.map(function (d) { return '<path d="' + d + '"/>'; }).join('');
      out += '<g transform="translate(' + cx + ' 4)"><g class="body-line">' + shapes + '</g><g class="body-fill">' + shapes + '</g>' +
        paths(DETAILS[view], 'body-detail');
      MUSCLES[view].forEach(function (m) {
        out += '<g class="m' + (lit.indexOf(m.id) > -1 ? ' is-on' : '') + '">' + paths(m.paths, 'm-shape') + '</g>';
      });
      out += '</g>';
    });
    return out + '</svg>';
  };

  window.PE_buildBody = function (target) {
    var numbers = {};
    PE.muscles.forEach(function (m) { numbers[m.id] = m.n; });
    target.innerHTML =
      '<svg viewBox="0 0 320 426" class="body-svg" role="group" aria-label="Human figure, front and back views, with numbered muscles">' +
      '<text class="view-label" x="80" y="13">Front</text><text class="view-label" x="240" y="13">Back</text>' +
      figure('front', 80, numbers) + figure('back', 240, numbers) + '</svg>';
  };
})();
