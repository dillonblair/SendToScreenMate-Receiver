/* Halo's car, built in code with three.js. The body is one smooth surface lofted
   between side, plan and belt-line profiles taken from published Model 3 / Model Y
   dimensions; glass, lamps and trim are regions of that surface, as on the real car.
   Wheels, mirrors and handles are separate parts. No model files, no textures. */
window.HaloCar = (function () {
  "use strict";
  var T;

  // Tesla paint names with my own colour approximations.
  var PAINTS = [
    { id: "pearl", name: "Pearl White", hex: "#EEEDE9", metal: 0.15, rough: 0.28 },
    { id: "solidblack", name: "Solid Black", hex: "#0C0C0E", metal: 0.05, rough: 0.22 },
    { id: "diamondblack", name: "Diamond Black", hex: "#141518", metal: 0.6, rough: 0.25 },
    { id: "midnight", name: "Midnight Silver", hex: "#41454B", metal: 0.65, rough: 0.28 },
    { id: "stealth", name: "Stealth Grey", hex: "#4D5055", metal: 0.25, rough: 0.3 },
    { id: "silver", name: "Silver Metallic", hex: "#AEB2B6", metal: 0.75, rough: 0.25 },
    { id: "quicksilver", name: "Quicksilver", hex: "#BABCBF", metal: 0.85, rough: 0.2 },
    { id: "deepblue", name: "Deep Blue", hex: "#1E3A6C", metal: 0.6, rough: 0.28 },
    { id: "marine", name: "Marine Blue", hex: "#224576", metal: 0.55, rough: 0.28 },
    { id: "glacier", name: "Glacier Blue", hex: "#8FA8BD", metal: 0.4, rough: 0.3 },
    { id: "redmc", name: "Red Multi-Coat", hex: "#9F1C24", metal: 0.35, rough: 0.22 },
    { id: "ultrared", name: "Ultra Red", hex: "#B5131F", metal: 0.4, rough: 0.2 }
  ];
  var GTW_PAINT = { 0: "redmc", 1: "solidblack", 2: "silver", 3: "midnight", 5: "deepblue", 6: "pearl" };
  var VIN_YEAR = { H: 2017, J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026, V: 2027 };

  // Profiles in metres. s runs from the nose (0) to the tail (L); y is height.
  // top: roof / hood / deck centre line; bot: underside; belt: shoulder (window sill) line;
  // plan: half-width of the body at its widest. Nose and tail close to a point.
  var SPECS = {
    "3": {
      L: 4.694, track: 1.58, axleF: 0.87, wb: 2.875, tR: 0.334, tW: 0.235, spokes: 5,
      ghFrom: 1.42, ghTo: 4.12, sail: 3.6,
      top: [[0, 0.52], [0.04, 0.61], [0.12, 0.68], [0.45, 0.76], [0.95, 0.87], [1.3, 0.95], [1.42, 0.985], [1.75, 1.2], [2.05, 1.38], [2.45, 1.443],
        [2.85, 1.43], [3.3, 1.34], [3.75, 1.17], [4.12, 1.02], [4.4, 0.997], [4.52, 0.995], [4.6, 0.975], [4.66, 0.95], [4.694, 0.93]],
      bot: [[0, 0.4], [0.04, 0.31], [0.14, 0.24], [0.35, 0.21], [0.9, 0.18], [3.7, 0.18], [4.2, 0.23], [4.5, 0.31], [4.64, 0.35], [4.694, 0.37]],
      belt: [[0, 0.5], [0.08, 0.6], [0.45, 0.74], [0.95, 0.855], [1.42, 0.965], [2.5, 0.99], [3.6, 1.0], [4.12, 1.0], [4.45, 0.975], [4.6, 0.93], [4.694, 0.9]],
      plan: [[0, 0], [0.008, 0.3], [0.03, 0.5], [0.1, 0.7], [0.3, 0.84], [0.7, 0.905], [0.9, 0.915], [1.6, 0.9], [2.6, 0.9], [3.4, 0.918],
        [3.75, 0.925], [4.2, 0.9], [4.4, 0.86], [4.55, 0.78], [4.63, 0.66], [4.67, 0.52], [4.69, 0.28], [4.694, 0]],
      lampY: 0.88
    },
    "Y": {
      L: 4.751, track: 1.64, axleF: 0.9, wb: 2.89, tR: 0.356, tW: 0.255, spokes: 10,
      ghFrom: 1.45, ghTo: 4.28, sail: 3.75,
      top: [[0, 0.6], [0.04, 0.7], [0.12, 0.77], [0.45, 0.86], [0.95, 0.97], [1.3, 1.05], [1.45, 1.085], [1.8, 1.33], [2.1, 1.53], [2.5, 1.62],
        [2.95, 1.615], [3.45, 1.55], [3.95, 1.36], [4.28, 1.17], [4.48, 1.14], [4.58, 1.13], [4.67, 1.1], [4.72, 1.06], [4.751, 1.02]],
      bot: [[0, 0.46], [0.04, 0.36], [0.14, 0.27], [0.35, 0.24], [0.9, 0.21], [3.75, 0.21], [4.25, 0.27], [4.55, 0.36], [4.7, 0.42], [4.751, 0.44]],
      belt: [[0, 0.56], [0.08, 0.68], [0.45, 0.83], [0.95, 0.96], [1.45, 1.075], [2.5, 1.1], [3.75, 1.12], [4.28, 1.12], [4.5, 1.1], [4.66, 1.05], [4.751, 1.0]],
      plan: [[0, 0], [0.008, 0.32], [0.03, 0.52], [0.1, 0.73], [0.3, 0.87], [0.7, 0.94], [0.9, 0.952], [1.6, 0.935], [2.6, 0.935], [3.4, 0.955],
        [3.8, 0.962], [4.25, 0.935], [4.45, 0.9], [4.6, 0.82], [4.68, 0.7], [4.725, 0.54], [4.747, 0.28], [4.751, 0]],
      lampY: 1.0
    }
  };

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // monotone cubic interpolation (Fritsch–Carlson): smooth, never overshoots the points
  function spline(pts) {
    var n = pts.length, xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { var t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      var k = 0; while (x > xs[k + 1]) k++;
      var hh = xs[k + 1] - xs[k], t = (x - xs[k]) / hh, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * hh * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * hh * m[k + 1];
    };
  }

  function profiles(S) {
    var top = spline(S.top), bot = spline(S.bot), belt = spline(S.belt), plan = spline(S.plan);
    var axles = [S.axleF, S.axleF + S.wb];
    return {
      top: top, bot: bot, plan: plan,
      belt: function (s) { return Math.min(Math.max(belt(s), bot(s)), top(s)); },
      inGH: function (s) { return s > S.ghFrom && s < S.ghTo; },
      arch: function (s) {
        var best = -1, R = S.tR + 0.075;
        axles.forEach(function (a) { var ds = s - a; if (Math.abs(ds) < R) best = Math.max(best, S.tR + Math.sqrt(R * R - ds * ds)); });
        return best;
      }
    };
  }

  // superellipse quadrant from A to B. flip=false bulges down-and-out (underbody corner);
  // flip=true bulges up-and-out (side into shoulder, greenhouse into roof).
  function quad(out, ax, ay, bx, by, n, steps, flip) {
    for (var i = 1; i <= steps; i++) {
      var t = i / steps * Math.PI / 2, c = Math.pow(Math.cos(t), 2 / n), s = Math.pow(Math.sin(t), 2 / n);
      out.push(flip ? [bx + (ax - bx) * c, ay + (by - ay) * s] : [ax + (bx - ax) * s, by - (by - ay) * c]);
    }
  }

  // right half of one cross-section, from underbody centre to roof centre, plus the
  // index where the greenhouse (above the shoulder) starts
  function section(P, S, s) {
    var w = P.plan(s), yb = P.bot(s), yt = P.top(s), yl = P.belt(s);
    var gh = P.inGH(s), ym = yb + 0.55 * (yl - yb);
    var pts = [[0, yb], [w * 0.45, yb]];
    quad(pts, w * 0.8, yb, w, ym, 2.6, 7, false);
    quad(pts, w, ym, w * 0.95, yl, 2.0, 5, true);
    var g0 = pts.length, wg = w * (gh ? 0.915 : 0.94);
    pts.push([wg, yl + 0.008]);
    quad(pts, wg, yl + 0.008, 0, Math.max(yt, yl + 0.01), gh ? 2.25 : 4.5, 14, true);
    // wheel arches: lift the outer underside clear of the tyres
    var a = P.arch(s), wellX = S.track / 2 - S.tW / 2 - 0.05;
    if (a > 0) for (var i = 0; i < g0; i++) if (pts[i][0] > wellX && pts[i][1] < a) pts[i] = [pts[i][0], Math.min(a, yl - 0.06)];
    return { pts: pts, g0: g0 };
  }

  // which part of the car a point on the surface belongs to
  var PAINT = 0, GLASS = 1, TRIM = 2;
  function region(S, cfg, P, s, x, y, j, g0) {
    var ax = Math.abs(x), L = S.L, w = P.plan(s) || 1e-6, r = ax / w;
    var Y = cfg.model === "Y", tail = L - s;
    if (j > g0 && P.inGH(s)) return GLASS;                                    // glass roof, windows and pillars read as one
    var a = P.arch(s);
    if (a > 0 && ax > S.track / 2 - S.tW / 2 - 0.06 && y <= a + 0.005 && j < g0) return TRIM;   // black wheel-well liners
    return PAINT;
  }

  function buildBody(S, P, cfg, mats) {
    var NS = 170, rings = [], k, m;
    for (k = 0; k <= NS; k++) {
      var s = S.L * (0.5 - 0.5 * Math.cos(Math.PI * k / NS));   // denser at nose and tail
      var sec = section(P, S, s); rings.push({ s: s, z: s - S.L / 2, pts: sec.pts, g0: sec.g0 });
    }
    var J = rings[0].pts.length, M = 2 * J - 2;
    function jOf(mm) { return mm < J ? mm : 2 * J - 2 - mm; }
    var pos = new Float32Array((NS + 1) * M * 3), p = 0;
    for (k = 0; k <= NS; k++) for (m = 0; m < M; m++) {
      var pt = rings[k].pts[jOf(m)];
      pos[p++] = m < J ? pt[0] : -pt[0]; pos[p++] = pt[1]; pos[p++] = rings[k].z;
    }
    var groups = [[], [], []];
    for (k = 0; k < NS; k++) for (m = 0; m < M; m++) {
      var m2 = (m + 1) % M, a = k * M + m, b = k * M + m2, c = (k + 1) * M + m, d = (k + 1) * M + m2;
      var cx = (pos[a * 3] + pos[d * 3]) / 2, cy = (pos[a * 3 + 1] + pos[d * 3 + 1]) / 2, cs = (rings[k].s + rings[k + 1].s) / 2;
      groups[region(S, cfg, P, cs, cx, cy, Math.min(jOf(m), jOf(m2)), rings[k].g0)].push(a, b, c, b, d, c);   // stations run nose to tail, so this winding faces outward
    }
    var idx = [], geo = new T.BufferGeometry(), start = 0;
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    groups.forEach(function (g, i) { idx = idx.concat(g); geo.addGroup(start, g.length, i); start += g.length; });
    geo.setIndex(idx); geo.computeVertexNormals();
    return new T.Mesh(geo, [mats.paint, mats.glass, mats.trim]);
  }

  // ---- parts laid on the body surface (lamps): sample the surface at a height, offset along its normal
  function surfX(P, S, s, y) {
    var pts = section(P, S, s).pts;
    for (var i = 1; i < pts.length - 1; i++) {
      var y0 = pts[i][1], y1 = pts[i + 1][1];
      if (y1 !== y0 && (y0 - y) * (y1 - y) <= 0) return pts[i][0] + (pts[i + 1][0] - pts[i][0]) * (y - y0) / (y1 - y0);
    }
    return 0;
  }
  function surfP(P, S, s, y, off) {
    var e = 0.004, p = [surfX(P, S, s, y), y, s - S.L / 2];
    var ts = [surfX(P, S, s + e, y) - surfX(P, S, s - e, y), 0, 2 * e];
    var ty = [surfX(P, S, s, y + e) - surfX(P, S, s, y - e), 2 * e, 0];
    var n = [ts[1] * ty[2] - ts[2] * ty[1], ts[2] * ty[0] - ts[0] * ty[2], ts[0] * ty[1] - ts[1] * ty[0]];
    if (n[0] * p[0] + n[2] * p[2] < 0) n = [-n[0], -n[1], -n[2]];
    var l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [p[0] + n[0] / l * off, p[1] + n[1] / l * off, p[2] + n[2] / l * off];
  }
  // s where the surface at height y comes within x of the centre line, searching toward an end
  function sAtX(P, S, y, x, rear) {
    var lo = rear ? S.L - 0.8 : 0, hi = rear ? S.L : 0.8;
    for (var i = 0; i < 30; i++) {
      var mid = (lo + hi) / 2, xm = surfX(P, S, mid, y);
      if (rear ? xm > x : xm < x) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  // a band on the surface from s0 to s1, centred on yc(k) with half-height h(k), k = 0..1; both sides
  function ribbon(P, S, s0, s1, yc, h, mat, off, n) {
    n = n || 40;
    var pos = [], idx = [], side, i;
    for (side = -1; side <= 1; side += 2) {
      var base = pos.length / 3;
      for (i = 0; i <= n; i++) {
        var k = i / n, s = s0 + (s1 - s0) * k, c = yc(k), hh = Math.max(0.0005, h(k));
        var a = surfP(P, S, s, c + hh, off), b = surfP(P, S, s, c - hh, off);
        pos.push(side * a[0], a[1], a[2], side * b[0], b[1], b[2]);
        if (i) { var q = base + 2 * i; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); }
      }
    }
    var g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return new T.Mesh(g, mat);
  }
  function ease(k, a) { return Math.min(1, k / a); }

  function lamps(car, S, P, cfg, mats) {
    var L = S.L, ly = S.lampY, refresh = cfg.gen === "refresh", Y = cfg.model === "Y";
    var sIn = sAtX(P, S, ly, 0.4, true), sSide = L - 0.36;
    if (refresh && Y) {                                    // Juniper: full-width light bar + corner units
      car.add(ribbon(P, S, L - 0.3, L - 0.001, function () { return ly + 0.06; }, function () { return 0.008; }, mats.tail, 0.004, 60));
      car.add(ribbon(P, S, sSide, sAtX(P, S, ly - 0.02, 0.55, true), function () { return ly - 0.02; },
        function (k) { return 0.03 * ease(k, 0.15); }, mats.lens, 0.003));
    } else if (refresh) {                                  // Highland: slim C-shaped lamps
      car.add(ribbon(P, S, sSide + 0.02, sIn, function () { return ly + 0.025; }, function () { return 0.006; }, mats.tail, 0.004));
      car.add(ribbon(P, S, sSide + 0.02, sAtX(P, S, ly - 0.04, 0.62, true), function () { return ly - 0.04; }, function () { return 0.006; }, mats.tail, 0.004));
      car.add(ribbon(P, S, sSide + 0.02, sSide + 0.045, function () { return ly - 0.0075; }, function () { return 0.0385; }, mats.tail, 0.004, 4));
    } else {                                               // legacy: wrap-around lamp units
      var yc = function (k) { return ly - 0.012 + 0.024 * k; };
      var hl = function (k) { return (0.028 + 0.04 * Math.pow(1 - k, 0.8)) * ease(k, 0.1) * (0.6 + 0.4 * ease(1 - k, 0.08)); };
      car.add(ribbon(P, S, sSide, sIn, yc, hl, mats.lens, 0.003));
      car.add(ribbon(P, S, sSide + 0.02, sIn, function (k) { return yc(k) + hl(k) - 0.012; }, function () { return 0.0055; }, mats.tail, 0.0045));
      car.add(ribbon(P, S, sSide + 0.02, sSide + (sIn - sSide) * 0.55, function (k) { return yc(k) - hl(k * 0.55) + 0.014; }, function () { return 0.0045; }, mats.tail, 0.0045));
    }
    // trunk / liftgate shut line across the rear face
    var gy = Y ? ly - 0.14 : ly - 0.105, gs = sAtX(P, S, gy, Y ? 0.66 : 0.6, true);
    car.add(ribbon(P, S, gs, L - 0.001, function () { return gy; }, function () { return 0.0025; }, mats.gap, 0.0015, 40));
    // black rear diffuser and lower front intake
    var by = (Y ? 0.47 : 0.405);
    car.add(ribbon(P, S, L - 0.42, L - 0.001, function () { return by; }, function (k) { return 0.045 * ease(k, 0.2); }, mats.trimD, 0.002, 50));
    car.add(ribbon(P, S, 0.001, 0.13, function () { return P.bot(0) + 0.06; }, function (k) { return 0.028 * ease(1 - k, 0.4); }, mats.trimD, 0.002, 30));
    // headlights: swept lamps on the front corners, a lens with a light strip along its top
    var hy = function (s) { return P.belt(s) - 0.05; }, f0 = sAtX(P, S, hy(0.1), 0.42, false), f1 = 0.46;
    if (!refresh) {
      car.add(ribbon(P, S, f0, f1, function (k) { return hy(f0 + (f1 - f0) * k); }, function (k) { return 0.032 * ease(k, 0.15) * ease(1 - k, 0.1); }, mats.headLens, 0.003));
      car.add(ribbon(P, S, f0 + 0.02, f1 - 0.03, function (k) { return hy(f0 + (f1 - f0) * k) + 0.018; }, function () { return 0.0045; }, mats.head, 0.0045));
    } else {
      car.add(ribbon(P, S, f0, f1, function (k) { return hy(f0 + (f1 - f0) * k) + 0.01; }, function (k) { return 0.011 * ease(k, 0.1) * ease(1 - k, 0.1); }, mats.head, 0.004));
    }
    if (refresh && Y) car.add(ribbon(P, S, 0.001, f0 + 0.04, function (k) { return P.top(0.05) - 0.02; }, function () { return 0.004; }, mats.head, 0.004, 30));
  }

  function buildWheel(S, mats) {
    var g = new T.Group(), R = S.tR, Wd = S.tW, rr = R * 0.68, spokes = S.spokes;
    var prof = [], c = 0.045, i, a;
    prof.push(new T.Vector2(rr + 0.01, -Wd / 2 + 0.01), new T.Vector2(R - c, -Wd / 2));
    for (i = 1; i < 6; i++) { a = -Math.PI / 2 + i / 6 * Math.PI / 2; prof.push(new T.Vector2(R - c + Math.cos(a) * c, -Wd / 2 + c + Math.sin(a) * c)); }
    for (i = 0; i <= 6; i++) { a = i / 6 * Math.PI / 2; prof.push(new T.Vector2(R - c + Math.cos(a) * c, Wd / 2 - c + Math.sin(a) * c)); }
    prof.push(new T.Vector2(rr + 0.01, Wd / 2 - 0.01));
    var tyre = new T.LatheGeometry(prof, 48); tyre.rotateZ(Math.PI / 2);
    g.add(new T.Mesh(tyre, mats.tyre));
    var face = new T.Shape(); face.absarc(0, 0, rr, 0, Math.PI * 2, false);
    var spokeW = (spokes > 5 ? 0.38 : 0.3) * (2 * Math.PI / spokes);
    for (i = 0; i < spokes; i++) {
      var a0 = i * 2 * Math.PI / spokes + spokeW / 2, a1 = (i + 1) * 2 * Math.PI / spokes - spokeW / 2, hole = new T.Path();
      hole.absarc(0, 0, rr * 0.86, a0, a1, false); hole.absarc(0, 0, rr * 0.32, a1, a0, true); hole.closePath();
      face.holes.push(hole);
    }
    var rim = new T.ExtrudeGeometry(face, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 40 });
    rim.rotateY(Math.PI / 2); rim.translate(Wd / 2 - 0.06, 0, 0);
    g.add(new T.Mesh(rim, mats.rim));
    var barrel = new T.CylinderGeometry(rr, rr, Wd * 0.85, 40, 1, true); barrel.rotateZ(Math.PI / 2);
    g.add(new T.Mesh(barrel, mats.barrel));
    var hub = new T.CylinderGeometry(rr * 0.17, rr * 0.17, 0.03, 24); hub.rotateZ(Math.PI / 2); hub.translate(Wd / 2 - 0.035, 0, 0);
    g.add(new T.Mesh(hub, mats.rim));
    var disc = new T.CylinderGeometry(rr * 0.82, rr * 0.82, 0.028, 40); disc.rotateZ(Math.PI / 2); disc.translate(-0.02, 0, 0);
    g.add(new T.Mesh(disc, mats.disc));
    var cal = new T.Mesh(new T.BoxGeometry(0.06, rr * 0.5, rr * 0.36), mats.caliper);
    cal.position.set(0.025, rr * 0.55, rr * 0.35); cal.rotation.x = -0.6; g.add(cal);
    return g;
  }

  function materials(paint) {
    return {
      paint: new T.MeshPhysicalMaterial({ color: paint.hex, metalness: paint.metal, roughness: paint.rough, clearcoat: 1, clearcoatRoughness: 0.04 }),
      glass: new T.MeshPhysicalMaterial({ color: 0x07090c, metalness: 0.35, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.1 }),
      trim: new T.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.55, metalness: 0.1 }),
      trimD: new T.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.55, metalness: 0.1, side: T.DoubleSide }),
      gap: new T.MeshBasicMaterial({ color: 0x050506, side: T.DoubleSide, transparent: true, opacity: 0.75 }),
      tyre: new T.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.85 }),
      rim: new T.MeshPhysicalMaterial({ color: 0x2f3237, metalness: 0.9, roughness: 0.3, clearcoat: 0.6 }),
      barrel: new T.MeshStandardMaterial({ color: 0x1a1b1e, metalness: 0.6, roughness: 0.5, side: T.DoubleSide }),
      disc: new T.MeshStandardMaterial({ color: 0x6b6e73, metalness: 0.9, roughness: 0.35 }),
      caliper: new T.MeshStandardMaterial({ color: 0x24262a, metalness: 0.3, roughness: 0.5 }),
      tail: new T.MeshStandardMaterial({ color: 0x400000, emissive: 0xff0808, emissiveIntensity: 0.9, roughness: 0.3, side: T.DoubleSide }),
      lens: new T.MeshPhysicalMaterial({ color: 0x3a0508, metalness: 0.1, roughness: 0.08, clearcoat: 1, emissive: 0x500000, emissiveIntensity: 0.4, side: T.DoubleSide }),
      head: new T.MeshStandardMaterial({ color: 0x8a8d92, emissive: 0xffffff, emissiveIntensity: 1.1, metalness: 0.4, roughness: 0.2, side: T.DoubleSide }),
      headLens: new T.MeshPhysicalMaterial({ color: 0x1b1d21, metalness: 0.6, roughness: 0.08, clearcoat: 1, side: T.DoubleSide }),
      plate: new T.MeshStandardMaterial({ color: 0xdedfe0, roughness: 0.6 })
    };
  }

  function build(three, cfg) {
    T = three;
    var S = SPECS[cfg.model] || SPECS["3"], P = profiles(S);
    var paint = PAINTS.filter(function (p) { return p.id === cfg.paint; })[0] || PAINTS[0];
    var mats = materials(paint), car = new T.Group();
    car.add(buildBody(S, P, cfg, mats));
    lamps(car, S, P, cfg, mats);

    [S.axleF, S.axleF + S.wb].forEach(function (sa) {          // wheels at the real axle positions
      [1, -1].forEach(function (side) {
        var wh = buildWheel(S, mats); wh.position.set(side * S.track / 2, S.tR, sa - S.L / 2);
        if (side < 0) wh.rotation.y = Math.PI; car.add(wh);
      });
    });

    // mirrors on the doors at the front of the side glass: wide shallow housing on a black arm
    var sm = S.ghFrom + 0.14, zm = sm - S.L / 2, xm = P.plan(sm) * 0.93, ym = P.belt(sm) + 0.075;
    [-1, 1].forEach(function (s) {
      var shell = new T.Mesh(new T.SphereGeometry(1, 28, 16), mats.paint);
      shell.scale.set(0.125, 0.06, 0.07); shell.position.set(s * (xm + 0.15), ym + 0.03, zm); car.add(shell);
      var face = new T.Mesh(new T.CircleGeometry(1, 28), mats.glass); face.scale.set(0.11, 0.05, 1);
      face.position.set(s * (xm + 0.15), ym + 0.03, zm + 0.066); car.add(face);
      var arm = new T.Mesh(new T.BoxGeometry(0.12, 0.03, 0.05), mats.trim); arm.position.set(s * (xm + 0.05), ym + 0.01, zm + 0.01); car.add(arm);
    });
    [S.ghFrom + 0.55, S.ghFrom + 1.55].forEach(function (s) {  // flush door handles
      [-1, 1].forEach(function (side) {
        var h = new T.Mesh(new T.BoxGeometry(0.012, 0.022, 0.13), mats.trim);
        h.position.set(side * (P.plan(s) * 0.965 + 0.004), P.belt(s) - 0.07, s - S.L / 2); car.add(h);
      });
    });
    var py = cfg.model === "Y" ? 0.64 : 0.58, ps = sAtX(P, S, py, 0.155, true), pz = surfP(P, S, ps, py, 0.006)[2];
    var plate = new T.Mesh(new T.BoxGeometry(0.31, 0.155, 0.008), mats.plate);   // rear plate on the bumper
    plate.position.set(0, py, pz); car.add(plate);

    car.userData = { mats: mats, spec: S };
    return car;
  }

  function dispose(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) { m.dispose(); });
    });
  }

  function resolve(settings, state) {
    var vin = typeof state.vin === "string" && state.vin.length === 17 ? state.vin.toUpperCase() : "";
    var vModel = vin ? vin[3] : "", year = vin ? VIN_YEAR[vin[9]] : 0;
    var det = { model: vModel === "3" || vModel === "Y" ? vModel : "", year: year || 0, paint: GTW_PAINT[state.exteriorColor] || "" };
    if (det.model && year) det.gen = (det.model === "3" && year >= 2024) || (det.model === "Y" && year >= 2025) ? "refresh" : "legacy";
    var model = settings.car && settings.car !== "auto" ? settings.car : det.model || "3";
    var gen = settings.gen && settings.gen !== "auto" ? settings.gen : det.gen || "legacy";
    var paint = settings.paint && settings.paint !== "auto" ? settings.paint : det.paint || "pearl";
    return { model: model, gen: gen, paint: paint, detected: det };
  }

  return { PAINTS: PAINTS, build: build, dispose: dispose, resolve: resolve,
    paintById: function (id) { return PAINTS.filter(function (p) { return p.id === id; })[0] || PAINTS[0]; } };
})();
