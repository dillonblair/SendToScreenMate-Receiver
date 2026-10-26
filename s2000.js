/* Halo S2000 theme: a digital cluster after the first Honda S2000's (AP1). A lopsided
   dome of long white LED bars sweeps with the speed (an EV has no revs to show) and runs
   into a red zone past the speed-warning threshold. The speed sits in an LCD window with
   a second window under it for the clock, gear, odometer and trip. Two small round dials
   sit on the dome's right shoulder (power, centre-zero with regen to the left, and the
   battery, E to F), warning lamps sit in its lower left, and a dark strip along the
   bottom carries the text lamps. Unlit segments stay faintly visible, as on the real
   LCD. Everything is drawn here on one canvas: no images, and no font but Montserrat. */
(function () {
  "use strict";
  var cv = document.getElementById("s2k");
  if (!cv) return;
  var ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  var W = 0, H = 0, spd = 0, pw = 0, last = "";
  // LIT and GHOST follow the chosen colour scheme (the bars, digits, LCD and dials); TXT,
  // the printed scale and labels, stays white as on the real cluster
  var LIT = "#F4F4F0", GHOST = "rgba(255,255,255,0.05)", TXT = "#F4F4F0", RED = "#FF2B1C", RED_GHOST = "rgba(255,43,28,0.07)";
  var GLOW = 0;          // backlight glow on lit segments, in px (0 at the lowest render quality)
  var SCHEMES = {
    white:  { lit: "#F4F4F0", dark: "#9C9C98", ghost: "rgba(255,255,255,0.05)" },
    yellow: { lit: "#E8F23C", dark: "#8C9418", ghost: "rgba(232,242,60,0.06)" },
    red:    { lit: "#FF3A26", dark: "#9E1C10", ghost: "rgba(255,58,38,0.08)", zone: "#FF9A2E", warn: ["#FFB020", "#FFFFFF"] },
    purple: { lit: "#E650F2", dark: "#80288A", ghost: "rgba(230,80,242,0.07)" },
    green:  { lit: "#3CF25A", dark: "#1A8A2C", ghost: "rgba(60,242,90,0.06)" },
    // Sport: white digits, bars that run green, yellow, orange as the speed rises
    sport:  { lit: "#F4F4F0", dark: "#9C9C98", ghost: "rgba(255,255,255,0.05)", bands: [[0.45, "#3CF25A", "#1A8A2C"], [0.7, "#E8F23C", "#8C9418"], [2, "#FFA21E", "#9A5A0A"]] }
  };
  var GREEN = "#3BE36B", ORANGE = "#FF8A1E", AMBER = "#FFB020", TICK = "#8FB4E3", OFF = "rgba(255,255,255,0.07)";
  var SEGS = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc",
    "8": "abcdefg", "9": "abcdfg", "-": "g", "P": "abefg", "R": "eg", "N": "ceg", "D": "bcdeg", " ": "" };
  var KM_PER_MI = 1.609344, D2R = Math.PI / 180;

  function active() { return document.documentElement.classList.contains("s2000"); }
  function path(p) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); }
  function poly(p) { path(p); ctx.fill(); }
  function rrect(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

  // one slanted seven-segment digit; ghost (if given) paints the unlit segments
  function digit(ch, x, y, w, h, lit, ghost) {
    var t = w * 0.19, g = t * 0.16, on = SEGS[ch] || "", k = 0.08, m = y + h / 2;
    function hs(x1, x2, yc) { return [x1, yc, x1 + t / 2, yc - t / 2, x2 - t / 2, yc - t / 2, x2, yc, x2 - t / 2, yc + t / 2, x1 + t / 2, yc + t / 2]; }
    function vs(xc, y1, y2) { return [xc, y1, xc + t / 2, y1 + t / 2, xc + t / 2, y2 - t / 2, xc, y2, xc - t / 2, y2 - t / 2, xc - t / 2, y1 + t / 2]; }
    var l = x + t / 2, r = x + w - t / 2;
    var P = { a: hs(l + g, r - g, y + t / 2), g: hs(l + g, r - g, m), d: hs(l + g, r - g, y + h - t / 2),
      f: vs(l, y + t / 2 + g, m - g), b: vs(r, y + t / 2 + g, m - g), e: vs(l, m + g, y + h - t / 2 - g), c: vs(r, m + g, y + h - t / 2 - g) };
    ctx.save(); ctx.transform(1, 0, -k, 1, k * (y + h), 0);
    for (var n in P) {
      var hit = on.indexOf(n) >= 0;
      if (!hit && !ghost) continue;
      ctx.shadowBlur = hit && GLOW ? GLOW * w / 30 : 0; ctx.shadowColor = lit;
      ctx.fillStyle = hit ? lit : ghost; poly(P[n]);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  // a right-aligned row of `slots` digits ending at xr; "." lights the point after a digit.
  // Returns the row's left edge.
  function field(text, slots, xr, y, w, h, gap, lit, ghost) {
    var chars = [], dots = [];
    for (var i = 0; i < text.length; i++) { if (text[i] === ".") dots[chars.length - 1] = true; else chars.push(text[i]); }
    while (chars.length < slots) { chars.unshift(" "); dots.unshift(false); }
    for (var j = 0; j < slots; j++) digit(chars[j], xr - (slots - j) * (w + gap) + gap, y, w, h, lit, ghost);
    for (j = 0; j < slots; j++) if (dots[j]) {                 // after the digits, so no ghost covers them
      var d = w * 0.2, x = xr - (slots - j) * (w + gap) + gap + w + (gap - d) / 2;
      ctx.fillStyle = lit; ctx.fillRect(x, y + h - d, d, d);
    }
    return xr - slots * (w + gap) + gap;
  }
  function label(text, x, y, size, color, align, weight, slant, glow) {
    ctx.save(); ctx.font = (weight || 500) + " " + size + "px Montserrat, system-ui, sans-serif";
    if (glow && GLOW) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color;
    if (slant !== false) ctx.transform(1, 0, -0.1, 1, 0.1 * y, 0);
    ctx.fillText(text, x, y); ctx.restore();
  }
  function arrow(x, y, s, dir, color) {
    var p = [0, 0, 0.5, -0.5, 0.5, -0.2, 1, -0.2, 1, 0.2, 0.5, 0.2, 0.5, 0.5], q = [];
    for (var i = 0; i < p.length; i += 2) q.push(x + (dir < 0 ? p[i] : -p[i]) * s, y + p[i + 1] * s);
    ctx.fillStyle = color; poly(q);
  }
  // an LCD window: a dark recessed panel with a faint rim
  function lcd(x, y, w, h) {
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#0C0E10"); g.addColorStop(0.18, "#15181B"); g.addColorStop(1, "#101215");
    rrect(x, y, w, h, h * 0.08); ctx.fillStyle = g; ctx.fill();
    // recessed: a dark lip along the top, a faint lit edge along the bottom, and glass on top
    ctx.save(); rrect(x, y, w, h, h * 0.08); ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + w, y + 1); ctx.stroke();
    var gl = ctx.createLinearGradient(0, y, 0, y + h * 0.45);
    gl.addColorStop(0, "rgba(255,255,255,0.045)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.3); ctx.quadraticCurveTo(x + w / 2, y + h * 0.48, x, y + h * 0.3); ctx.fill();
    ctx.restore();
    rrect(x, y, w, h, h * 0.08); ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; ctx.stroke();
  }
  // a small round dial on the shoulder: n radial bars over the top half; color(i) says
  // what bar i shows (a colour when lit, or null to leave it unlit)
  function dial(cx, cy, r, n, color, redAt) {
    for (var i = 0; i < n; i++) {
      var a0 = (180 + (i + 0.2) / n * 180) * D2R, a1 = (180 + (i + 0.8) / n * 180) * D2R, k0 = 0.66;
      var c = color(i), red = redAt(i);
      ctx.shadowBlur = c && GLOW ? GLOW * 0.8 : 0; ctx.shadowColor = c || "#000";
      ctx.fillStyle = c || (red ? RED_GHOST : GHOST);
      poly([cx + Math.cos(a0) * r * k0, cy + Math.sin(a0) * r * k0, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r,
        cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cx + Math.cos(a1) * r * k0, cy + Math.sin(a1) * r * k0]);
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx - r * 1.04, cy); ctx.lineTo(cx - r * 0.6, cy); ctx.moveTo(cx + r * 0.6, cy); ctx.lineTo(cx + r * 1.04, cy); ctx.stroke();
  }
  // little lamps drawn as shapes: seatbelt, steering wheel, lightning bolt, battery
  function icon(kind, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = ctx.strokeStyle = color; ctx.lineWidth = 0.13; ctx.lineCap = "round";
    if (kind === "belt") {
      ctx.beginPath(); ctx.arc(0, -0.62, 0.18, 0, 7); ctx.fill();
      path([-0.3, -0.35, 0.3, -0.35, 0.36, 0.25, 0.5, 0.6, -0.5, 0.6, -0.36, 0.25]); ctx.fill();
      ctx.strokeStyle = "#000"; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(-0.28, -0.32); ctx.lineTo(0.34, 0.4); ctx.stroke();
    } else if (kind === "wheel") {
      ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 0.12, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-0.48, -0.06); ctx.quadraticCurveTo(0, -0.18, 0.48, -0.06); ctx.moveTo(0, 0.12); ctx.lineTo(0, 0.5); ctx.stroke();
    } else if (kind === "bolt") {
      poly([0.1, -0.55, -0.3, 0.08, -0.02, 0.08, -0.12, 0.55, 0.3, -0.1, 0.02, -0.1]);
    } else if (kind === "car") {
      rrect(-0.28, -0.5, 0.56, 1, 0.16); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.55)"; rrect(-0.2, -0.28, 0.4, 0.2, 0.05); ctx.fill(); rrect(-0.2, 0.22, 0.4, 0.14, 0.05); ctx.fill();
      ctx.lineWidth = 0.09;
      [0.48, 0.68].forEach(function (r) { ctx.beginPath(); ctx.arc(0.05, 0, r, -0.6, 0.6); ctx.stroke(); });
    } else if (kind === "batt") {
      ctx.strokeRect(-0.4, -0.25, 0.8, 0.5); ctx.fillRect(0.42, -0.1, 0.1, 0.2); ctx.fillRect(-0.3, -0.15, 0.35, 0.3);
    }
    ctx.restore();
  }

  // ---- three layouts share the data, warnings and colours. Each style keeps its own colour
  // scheme (settings.s2kColors[style]); Classic falls back to the older single s2kColor.
  var STYLE_COLOUR = { classic: "sport", modern: "white", redlcd: "red" };
  function colourOf(st) {
    var style = st.s2kStyle || "classic", m = st.s2kColors || {};
    return m[style] || (style === "classic" && st.s2kColor) || STYLE_COLOUR[style];
  }
  window.HaloS2kColour = colourOf;
  function mixBlack(hex, k) { var n = parseInt(hex.slice(1), 16); return "rgb(" + [n >> 16, n >> 8 & 255, n & 255].map(function (v) { return Math.round(v * (1 - k)); }).join(",") + ")"; }
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }
  function bandColour(K, t, redFrom) { var bd = K.bands ? K.bands.filter(function (b) { return t < b[0]; })[0] : null; return t >= redFrom ? (K.zone || RED) : bd ? bd[1] : K.lit; }
  // blind spots, as in Classic: a car alongside tints that side's arrow red; signalling into it pulses
  function blindSpots(s) {
    var show = s.alwaysOnBlindSpotMonitor || s.leftBlinker || s.rightBlinker || s.dataSourceType === "demo";
    function lvl(bs, blink) { return !show || !bs ? 0 : bs === 2 || blink ? 2 : 1; }
    return { L: lvl(s.leftBlindSpot, s.leftBlinker), R: lvl(s.rightBlindSpot, s.rightBlinker), pulse: 0.55 + 0.45 * Math.sin(performance.now() / 1000 * 14) };
  }
  function turnArrow(x, y, size, dir, blink, lvl, pulse) {
    var c = lvl === 2 ? "rgba(255,43,28," + pulse.toFixed(2) + ")" : blink === 2 ? GREEN : lvl ? "rgba(255,43,28,0.4)" : OFF;
    ctx.save();
    if (GLOW && (blink === 2 || lvl)) { ctx.shadowColor = lvl ? RED : GREEN; ctx.shadowBlur = GLOW * 1.4; }
    if (lvl) ctx.globalAlpha = 1;
    arrow(x, y, size, dir, c); ctx.restore();
  }
  function carLamp(x, y, size, side, lvl, pulse) {        // side -1 left, 1 right: the waves face outward
    if (!lvl) return;
    ctx.save(); ctx.globalAlpha = 1; ctx.translate(x, y); ctx.scale(side, 1);
    if (GLOW) { ctx.shadowColor = RED; ctx.shadowBlur = GLOW * 1.6; }
    icon("car", 0, 0, size, "rgba(255,43,28," + (lvl === 2 ? pulse : 1).toFixed(2) + ")"); ctx.restore();
  }
  function lightAhead(s, settings, imp) {
    var tl = settings.stopLine === false ? 0 : s.trafficLightColor;
    return { c: ["", RED, GREEN, AMBER][tl] || "", d: tl && s.stopLineDist > 0 ? (imp ? Math.round(s.stopLineDist * 3.281) + " FT" : Math.round(s.stopLineDist) + " M") : "" };
  }
  function clockText(s, imp) {
    var d = new Date(s.currentTime || Date.now()), h = d.getHours(), m = d.getMinutes();
    if (imp) h = h % 12 || 12;
    return h + ":" + (m < 10 ? "0" : "") + m;
  }

  // ---- squared numerals, after the rounded-rectangle figures on Honda's digital S2000-style
  // screen. Drawn as stroked paths on a unit box (x 0..1 across a glyph, y 0..1 down), so no
  // font file is needed. Each entry is a list of strokes; a stroke "R" is a rounded rectangle.
  var SQ = {
    "0": ["R"], "8": ["R", [[0, 0.5], [1, 0.5]]],
    "1": [[[0.2, 0.2], [0.55, 0]], [[0.55, 0], [0.55, 1]]],
    "2": [[[0, 0], [1, 0], [1, 0.5], [0, 0.5], [0, 1], [1, 1]]],
    "3": [[[0, 0], [1, 0], [1, 1], [0, 1]], [[0.28, 0.5], [1, 0.5]]],
    "4": [[[0, 0], [0, 0.56], [1, 0.56]], [[1, 0], [1, 1]]],
    "5": [[[1, 0], [0, 0], [0, 0.5], [1, 0.5], [1, 1], [0, 1]]],
    "6": [[[1, 0], [0, 0], [0, 1], [1, 1], [1, 0.5], [0, 0.5]]],
    "7": [[[0, 0], [1, 0], [1, 1]]],
    "9": [[[1, 0.5], [0, 0.5], [0, 0], [1, 0], [1, 1], [0, 1]]],
    "P": [[[0, 1], [0, 0], [1, 0], [1, 0.55], [0, 0.55]]],
    "R": [[[0, 1], [0, 0], [1, 0], [1, 0.55], [0, 0.55]], [[0.5, 0.55], [1, 1]]],
    "N": [[[0, 1], [0, 0], [1, 1], [1, 0]]],
    "D": [[[0, 0], [0.62, 0], [1, 0.32], [1, 0.68], [0.62, 1], [0, 1], [0, 0]]],
    "-": [[[0.1, 0.5], [0.9, 0.5]]]
  };
  var SQ_ADV = { ":": 0.3, ".": 0.28, ",": 0.28, " ": 0.35, "1": 0.5, "-": 0.55 };   // advance, in glyph heights; others 0.74
  function sqWidth(str, h) { var w = 0; for (var i = 0; i < str.length; i++) w += (SQ_ADV[str[i]] || 0.74) * h; return w; }
  // draws str with its box from y - h to y; align "left" | "center" | "right" on x; weight is
  // the stroke as a share of the height
  function sqText(str, x, y, h, color, align, weight, glow) {
    var w = sqWidth(str, h), lw = (weight || 0.12) * h, gw = 0.56 * h - lw, x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    ctx.save(); ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (glow && GLOW) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    var top = y - h + lw / 2, gh = h - lw, rad = Math.min(gh * 0.17, gw * 0.3);
    for (var i = 0; i < str.length; i++) {
      var ch = str[i], adv = (SQ_ADV[ch] || 0.74) * h, gx = x0 + (adv - gw) / 2;
      if (ch === ":") { [0.32, 0.72].forEach(function (k) { ctx.beginPath(); ctx.arc(x0 + adv / 2, top + gh * k, lw * 0.62, 0, 7); ctx.fill(); }); }
      else if (ch === "." || ch === ",") { ctx.beginPath(); ctx.arc(x0 + adv / 2, top + gh, lw * 0.62, 0, 7); ctx.fill(); }
      else (SQ[ch] || []).forEach(function (st) {
        ctx.beginPath();
        if (st === "R") { rrect(gx, top, gw, gh, rad); ctx.stroke(); return; }
        var P = st.map(function (q) { return [gx + q[0] * gw, top + q[1] * gh]; });
        ctx.moveTo(P[0][0], P[0][1]);
        for (var k = 1; k < P.length - 1; k++) ctx.arcTo(P[k][0], P[k][1], P[k + 1][0], P[k + 1][1], rad);
        ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]); ctx.stroke();
      });
      x0 += adv;
    }
    ctx.restore();
  }

  // ---- Modern: after Honda's later digital S2000-style screen. One wide arc of fine bars
  // numbered 0 to 9 carries the design; the speed sits calmly under it in the same squared
  // figures. Two short arcs step down the right (power, battery). Below, one grid: values in
  // white at one size, captions in small grey, centred on the speed.
  function drawModern(o) {
    var s = o.s, W = o.W, H = o.H, K = o.K, imp = o.imp, warn = o.warn;
    var step = imp ? 10 : 20, max = step * 10;                       // 0-9, each 10 mph (20 km/h)
    var cx = W * 0.44, cy = H * 0.97, rx = W * 0.41, ry = H * 0.87, A0 = 166, A1 = 57;
    var WHITE = "#F2F2F0", GREY = "#868A90", UNLIT = "rgba(255,255,255,0.13)", RED_UNLIT = "rgba(255,43,28,0.24)";
    function at(t, k, a0, a1) { var a = ((a0 == null ? A0 : a0) - ((a0 == null ? A0 : a0) - (a1 == null ? A1 : a1)) * t) * D2R; return [cx + Math.cos(a) * rx * k, cy - Math.sin(a) * ry * k]; }
    function band(a0, a1, n, kIn, litFrom, litTo, colourAt, redAt) {
      for (var i = 0; i < n; i++) {
        var t0 = (i + 0.18) / n, t1 = (i + 0.82) / n, q = (i + 0.5) / n, on = q >= litFrom && q <= litTo, red = redAt(q);
        var a = at(t0, kIn, a0, a1), b = at(t0, 1, a0, a1), c = at(t1, 1, a0, a1), d = at(t1, kIn, a0, a1);
        ctx.shadowBlur = on && GLOW ? GLOW * 0.6 : 0; ctx.shadowColor = on ? colourAt(q) : "#000";
        ctx.fillStyle = on ? colourAt(q) : red ? RED_UNLIT : UNLIT;
        poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]);
      }
      ctx.shadowBlur = 0;
    }
    function tick(t, k0, k1, w, a0, a1, colour) {
      var p = at(t, k0, a0, a1), q = at(t, k1, a0, a1);
      ctx.strokeStyle = colour || WHITE; ctx.lineWidth = w; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }

    // the arc: lit up to the speed, red past the warning point (or from 8.7 without a limit)
    var frac = Math.min(1, spd / max), redFrom = warn.at > 0 ? Math.min(1, warn.at / max) : 0.87;
    band(A0, A1, 112, 0.925, 0, frac, function (q) { return bandColour(K, q, redFrom); }, function (q) { return q >= redFrom; });
    for (var v = 0; v <= max; v += step / 2) {
      var tt = v / max, major = v % step === 0;
      tick(tt, 0.895, major ? 0.858 : 0.878, major ? H * 0.008 : H * 0.005);
      if (major && v < max) { var np = at(tt, 0.765); sqText(String(v / step), np[0], np[1] + H * 0.043, H * 0.086, WHITE, "center", 0.13); }
    }

    // the speed: same figures, calm, under the arc; orange then red over the limit
    var wc = K.warn || [ORANGE, RED], sc = warn.stage === 2 ? wc[1] : warn.stage === 1 ? wc[0] : WHITE;
    // the centre column runs down the middle of the screen (as on the original), not the arc's centre
    var gx = W * 0.5, spH = H * 0.2, spY = H * 0.67;
    sqText(String(Math.round(s.egoSpeed)), gx, spY, spH, sc, "center", 0.15, GLOW * 0.9);
    var bs = blindSpots(s), as = H * 0.055, half = Math.max(sqWidth("88", spH), sqWidth(String(Math.round(s.egoSpeed)), spH)) / 2 + W * 0.035;
    turnArrow(gx - half, spY - spH / 2, as, -1, s.leftBlinker, bs.L, bs.pulse);
    turnArrow(gx + half + as, spY - spH / 2, as, 1, s.rightBlinker, bs.R, bs.pulse);

    // one grid under the speed: the units, gear in the centre column; clock | date either side
    // of it; power starting just right of the arc's 0, battery ending under the battery arc.
    // Values in the squared figures at one size, captions small and grey.
    var C1 = W * 0.14, PL = W * 0.2, BR = W * 0.86, vh = H * 0.052, r1 = H * 0.835, r2 = H * 0.955, cap = Math.round(H * 0.024);
    label(imp ? "mph" : "km/h", gx, r1, Math.round(H * 0.046), "#BFC3C8", "center", 500, false);
    var clk = clockText(s, imp), dd = new Date(s.currentTime || Date.now());
    var date = (dd.getMonth() < 9 ? "0" : "") + (dd.getMonth() + 1) + "-" + (dd.getDate() < 10 ? "0" : "") + dd.getDate();
    sqText(clk, gx - C1, r1, vh, WHITE, "center", 0.12);
    sqText(date, gx + C1, r1, vh, WHITE, "center", 0.12);
    var kwMax = s.maxDischargePower > 0 ? s.maxDischargePower : 0, regenMax = s.maxRegenPower > 0 ? s.maxRegenPower : 0;
    var kw = kwMax || regenMax ? Math.round(pw >= 0 ? pw / 100 * kwMax : pw / 100 * regenMax) : Math.round(pw);
    var kwStr = (kw < 0 ? "-" : "") + Math.abs(kw), kwW = sqWidth(kwStr, vh);
    sqText(kwStr, PL, r1, vh, kw < 0 ? GREEN : WHITE, "left", 0.12);
    label(kwMax || regenMax ? "kW" : "%", PL + kwW + W * 0.008, r1 - vh * 0.52, cap, WHITE, "left", 600, false);
    label("POWER", PL + kwW + W * 0.008, r1, cap, GREY, "left", 600, false);
    var chg = window.Dash && Dash.charge ? Dash.charge(s) : -1;
    if (chg >= 0 && s.showCarBattery !== false) {
      var cw = sqWidth(String(chg), vh);
      sqText(String(chg), BR, r1, vh, chg < 20 ? RED : WHITE, "right", 0.12);
      label("%", BR - cw - W * 0.008, r1 - vh * 0.52, cap, WHITE, "right", 600, false);
      label("BATTERY", BR - cw - W * 0.008, r1, cap, GREY, "right", 600, false);
    }
    var clkL = gx - C1 - sqWidth(clk, vh) / 2, dateR = gx + C1 + sqWidth(date, vh) / 2, vh2 = vh * 0.8;
    if (s.showOdometer !== false && s.odometer > 0) {
      label("ODO", clkL, r2 - vh2 - H * 0.012, cap, GREY, "left", 600, false);
      sqText(String(Math.round(s.odometer)), clkL, r2, vh2, WHITE, "left", 0.12);
    }
    var trip = window.HaloDrives && HaloDrives.tripKm || 0;
    label("TRIP", dateR, r2 - vh2 - H * 0.012, cap, GREY, "right", 600, false);
    sqText((imp ? trip / KM_PER_MI : trip).toFixed(1), dateR, r2, vh2, WHITE, "right", 0.12);
    sqText(["", "P", "R", "N", "D"][s.gear] || "", gx, r2, vh, WHITE, "center", 0.13, GLOW * 0.4);

    // the shoulder arcs, stepping down the right: power (0 to P), then battery (E to F)
    var gl = Math.round(H * 0.048);
    function shoulder(a0, a1, f, colourAt, redAt, lo, hi, loC, hiC, kind, iconC) {
      band(a0, a1, 14, 0.925, 0, f, colourAt, redAt);
      [0, 0.5, 1].forEach(function (u) { tick(u, 0.895, 0.86, H * 0.007, a0, a1); });
      var pl = at(0, 0.8, a0, a1), ph = at(1, 0.8, a0, a1), pm = at(0.5, 0.78, a0, a1);
      label(lo, pl[0], pl[1] + gl * 0.36, gl, loC, "center", 600, false); label(hi, ph[0], ph[1] + gl * 0.36, gl, hiC, "center", 600, false);
      icon(kind, pm[0] - gl * 0.55, pm[1], H * 0.05, iconC);
    }
    // a0 is each arc's lower end, a1 its upper end (angles fall toward the right, so a0 < a1)
    var pf = Math.min(1, Math.abs(pw) / 100);
    shoulder(39, 52, pf, function (q) { return pw < 0 ? GREEN : q > 0.86 ? RED : K.lit; }, function (q) { return q > 0.86; }, "0", "P", WHITE, RED, "bolt", WHITE);
    if (chg >= 0 && s.showCarBattery !== false)
      shoulder(18, 32, chg / 100, function (q) { return q < 0.15 || chg < 20 ? RED : K.lit; }, function (q) { return q < 0.15; }, "E", "F", RED, WHITE, "batt", AMBER);

    // lamps, small, in the bottom corners and the outer columns; each only when it applies
    var ly = r2 - H * 0.02, ls = H * 0.055, lt = Math.round(H * 0.036);
    carLamp(W * 0.03, ly, ls, -1, bs.L, bs.pulse);
    carLamp(W * 0.97, ly, ls, 1, bs.R, bs.pulse);
    if (s.gear === 4 && !s.buckleStatus) icon("belt", W * 0.075, ly, ls * 0.85, RED);
    if (s.adasOn) {
      icon("wheel", PL + ls * 0.4, ly, ls * 0.72, GREEN);
      if (s.accSetSpeed > 0) label("SET " + Math.round(s.accSetSpeed), PL + ls * 0.95, r2, lt, GREEN, "left", 600, false, GLOW);
    }
    if (s.fusedSpeedLimit > 0) label("LIMIT " + Math.round(s.fusedSpeedLimit), BR, r2, lt, ORANGE, "right", 600, false, GLOW);
    // the light ahead sits above the speed, between it and the scale: a dot in the light's
    // colour and the distance to the stop line; the door lamp sits beside the right corner
    var la = lightAhead(s, o.settings, imp);
    if (la.c) {
      var ly2 = spY - spH - H * 0.045, txt = la.d || "", tw = txt ? sqWidth(txt.replace(/ .*/, ""), H * 0.04) : 0;
      ctx.save(); ctx.fillStyle = la.c; if (GLOW) { ctx.shadowColor = la.c; ctx.shadowBlur = GLOW; }
      ctx.beginPath(); ctx.arc(gx - (txt ? tw / 2 + H * 0.03 : 0), ly2 - H * 0.02, H * 0.016, 0, 7); ctx.fill(); ctx.restore();
      if (txt) { sqText(txt.replace(/ .*/, ""), gx + H * 0.012, ly2, H * 0.04, la.c, "center", 0.13); label(imp ? "ft" : "m", gx + tw / 2 + H * 0.022, ly2, cap, la.c, "left", 600, false); }
    }
    if (s.anyDoorOpen) label("DOOR", W * 0.935, r2, lt, RED, "right", 700, false, GLOW);
  }

  // ---- Red LCD: after the S2000 cluster with the red-backlit LCD. A thick lit band with a
  // hatched redline, amber digits on lit LCD windows, bar gauges either side, lamps in
  // pill-shaped recesses and a groove along the bottom. The band and windows take the
  // scheme's colour (red by default); the digits stay amber.
  function drawRedLcd(o) {
    var s = o.s, W = o.W, H = o.H, K = o.K, imp = o.imp, max = o.max, step = o.step, warn = o.warn;
    var AMB = "#FFD24A", AMB_GHOST = "rgba(255,210,74,0.13)", base = K.bands ? "#FF6A2A" : K.lit;
    var cx = W * 0.5, cy = H * 0.8, rx = W * 0.42, ry = H * 0.72, A0 = 152, A1 = 28;
    function at(t, k) { var a = (A0 - (A0 - A1) * t) * D2R; return [cx + Math.cos(a) * rx * k, cy - Math.sin(a) * ry * k]; }
    var frac = Math.min(1, spd / max), redFrom = warn.at > 0 ? Math.min(1, warn.at / max) : 0.88, hatch = Math.max(redFrom, 0.86);
    // the band: one continuous lit sweep (dim where unlit, as a backlit LCD shows), then hatched bars for the redline
    var N = 90;
    for (var i = 0; i < N; i++) {
      var t0 = i / N, t1 = (i + 1.02) / N;
      if (t0 >= hatch) break;
      var lit = (i + 1) / N <= frac + 0.0005, col = bandColour(K, t0, redFrom), a = at(t0, 0.8), b = at(t0, 1), c = at(Math.min(t1, hatch), 1), d = at(Math.min(t1, hatch), 0.8);
      ctx.shadowBlur = lit && GLOW ? GLOW * 0.8 : 0; ctx.shadowColor = col;
      ctx.fillStyle = lit ? col : rgba(t0 >= redFrom ? RED : (K.bands ? "#FF6A2A" : K.lit), 0.26);
      poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]);
    }
    for (var h = 0; h < 6; h++) {                       // the hatched redline
      var u0 = hatch + (1 - hatch) * (h + 0.25) / 6, u1 = hatch + (1 - hatch) * (h + 0.75) / 6, on = u1 <= frac + 0.0005;
      var p = at(u0, 0.78), q = at(u0, 1.03), r = at(u1, 1.03), z = at(u1, 0.78);
      ctx.shadowBlur = on && GLOW ? GLOW : 0; ctx.shadowColor = RED;
      ctx.fillStyle = on ? "#FF3B22" : "rgba(255,59,34,0.3)"; poly([p[0], p[1], q[0], q[1], r[0], r[1], z[0], z[1]]);
    }
    ctx.shadowBlur = 0;
    var fs = Math.round(H * 0.075);
    for (var v = 0; v <= max; v += step / 2) {
      var tt = v / max, major = v % step === 0, p1 = at(tt, 0.76), p2 = at(tt, major ? 0.7 : 0.73);
      ctx.strokeStyle = TXT; ctx.lineWidth = major ? 2.6 : 1.6; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      if (major) { var q2 = at(tt, 0.61); label(String(v / 10), q2[0], q2[1] + fs * 0.36, fs, TXT, "center", 500, false, GLOW * 0.4); }
    }
    var z0 = at(0.02, 0.6); label("x10" + (imp ? "mph" : "km/h"), z0[0] + fs * 0.5, z0[1] + fs * 0.36, Math.round(fs * 0.4), TXT, "left", 400, false);
    // lit LCD windows: the scheme's colour behind amber digits
    function window_(x, y, w, hh) {
      var g = ctx.createLinearGradient(0, y, 0, y + hh);
      g.addColorStop(0, mixBlack(base, 0.35)); g.addColorStop(1, mixBlack(base, 0.6));
      rrect(x, y, w, hh, hh * 0.1); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 2; ctx.stroke();
    }
    var ww = W * 0.19, wh = H * 0.19, wx = cx - ww / 2, wy = H * 0.41;
    window_(wx, wy, ww, wh);
    var dh = wh * 0.8, dw = dh * 0.52, gap = dw * 0.2, sc = warn.stage === 2 ? "#FFFFFF" : warn.stage === 1 ? "#FFF2B8" : AMB;
    field(String(Math.round(s.egoSpeed)), 3, wx + ww - W * 0.012, wy + (wh - dh) / 2, dw, dh, gap, sc, AMB_GHOST);
    digit(["", "P", "R", "N", "D"][s.gear] || " ", wx + W * 0.014, wy + wh * 0.5, dw * 0.45, dh * 0.4, AMB, AMB_GHOST);
    label(imp ? "mph" : "km/h", wx + W * 0.012, wy + wh * 0.3, Math.round(H * 0.04), AMB, "left", 600, false);
    var lx = wx, lw = ww, ly = wy + wh + H * 0.02, lh = H * 0.11;
    window_(lx, ly, lw, lh);
    var oh = lh * 0.55, ow = oh * 0.52, og = ow * 0.24;
    if (s.showOdometer !== false && s.odometer > 0) field(String(Math.round(s.odometer) % 1000000), 6, lx + lw * 0.56, ly + lh * 0.32, ow, oh, og, AMB, AMB_GHOST);
    var trip = window.HaloDrives && HaloDrives.tripKm || 0;
    field((imp ? trip / KM_PER_MI : trip).toFixed(1), 4, lx + lw * 0.97, ly + lh * 0.32, ow, oh, og * 1.3, AMB, AMB_GHOST);
    label("TRIP A", lx + lw * 0.8, ly + lh * 0.27, Math.round(lh * 0.22), AMB, "center", 600, false);
    var bs = blindSpots(s), as = H * 0.065;
    turnArrow(lx - W * 0.015 - as, ly + lh * 0.5, as, -1, s.leftBlinker, bs.L, bs.pulse);
    turnArrow(lx + lw + W * 0.015 + as, ly + lh * 0.5, as, 1, s.rightBlinker, bs.R, bs.pulse);
    // bar gauges either side: power (green when regenerating) and battery
    var gy = H * 0.63, gh = H * 0.045, gw = W * 0.14, gl = Math.round(H * 0.055);
    function hbar(x, f, colour, track) {
      rrect(x, gy, gw, gh, 2); ctx.fillStyle = track; ctx.fill();
      if (f > 0.005) { ctx.shadowBlur = GLOW ? GLOW * 0.8 : 0; ctx.shadowColor = colour; rrect(x, gy, gw * Math.min(1, f), gh, 2); ctx.fillStyle = colour; ctx.fill(); ctx.shadowBlur = 0; }
      ctx.strokeStyle = TXT; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 4, gy + gh + 6); ctx.lineTo(x + gw + 4, gy + gh + 6); ctx.stroke();
    }
    var g1 = W * 0.075;
    hbar(g1, Math.abs(pw) / 100, pw < 0 ? GREEN : AMB, rgba(base, 0.45));
    label("0", g1 - gl * 0.55, gy + gh, gl, TXT, "center", 400, false); label("P", g1 + gw + gl * 0.55, gy + gh, gl, TXT, "center", 400, false);
    icon("bolt", g1 + gw * 0.25, gy - gh * 1.1, H * 0.055, TXT);
    var chg = window.Dash && Dash.charge ? Dash.charge(s) : -1, g2 = W * 0.785;
    if (chg >= 0 && s.showCarBattery !== false) {
      hbar(g2, chg / 100, chg < 20 ? RED : AMB, rgba(base, 0.45));
      label("E", g2 - gl * 0.55, gy + gh, gl, TXT, "center", 400, false); label("F", g2 + gw + gl * 0.55, gy + gh, gl, TXT, "center", 400, false);
      icon("batt", g2 + gw * 0.75, gy - gh * 1.1, H * 0.05, TXT);
    }
    // pill recesses under the gauges (blind spot, belt / door) and the groove for the rest
    function recess(x, y, w, hh) { rrect(x, y, w, hh, hh / 2); ctx.fillStyle = "#0A0B0C"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1; ctx.stroke(); }
    var py = H * 0.73, ph = H * 0.09, gy2 = H * 0.86, gh2 = H * 0.11;
    recess(W * 0.06, py, W * 0.19, ph); recess(W * 0.75, py, W * 0.19, ph); recess(W * 0.2, gy2, W * 0.6, gh2);
    carLamp(W * 0.1, py + ph / 2, ph * 0.75, -1, bs.L, bs.pulse);
    carLamp(W * 0.9, py + ph / 2, ph * 0.75, 1, bs.R, bs.pulse);
    var ts = Math.round(H * 0.045);
    if (s.gear === 4 && !s.buckleStatus) label("BELT", W * 0.2, py + ph * 0.68, ts, RED, "center", 800, true, GLOW);
    if (s.anyDoorOpen) label("DOOR", W * 0.8, py + ph * 0.68, ts, RED, "center", 800, true, GLOW);
    var gyc = gy2 + gh2 * 0.68;
    if (s.adasOn) label("ASSIST", W * 0.3, gyc, ts, GREEN, "center", 800, true, GLOW);
    if (s.adasOn && s.accSetSpeed > 0) label("SET " + Math.round(s.accSetSpeed), W * 0.42, gyc, ts, GREEN, "center", 800, true, GLOW);
    if (s.fusedSpeedLimit > 0) label("LIMIT " + Math.round(s.fusedSpeedLimit), W * 0.56, gyc, ts, ORANGE, "center", 800, true, GLOW);
    var la = lightAhead(s, o.settings, imp);
    if (la.c) label(la.d || "LIGHT", W * 0.7, gyc, ts, la.c, "center", 800, true, GLOW);
  }

  // FW x FH is the screen; the cluster is laid out in a box of fixed proportions centred on
  // it, so a near-square screen (the unfolded iPhone Duo) doesn't stretch it
  function draw(s, FW, FH) {
    var imp = s.isImperial !== false, max = imp ? 140 : 220, step = imp ? 20 : 40;
    var dim = window.HaloDim ? HaloDim() : 1, warn = window.HaloWarn || { stage: 0, at: 0 };
    var settings = window.HaloSettings || {};
    var style = settings.s2kStyle || "classic";
    var K = SCHEMES[window.HaloS2kPreview || colourOf(settings)] || SCHEMES.sport; LIT = K.lit; GHOST = K.ghost;
    GLOW = s.renderQuality === 1 ? 0 : Math.max(4, FH * 0.016);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, FW, FH);
    var W = Math.min((FW - 2 * (window.HaloSx || 0)) * 0.97, FH * 2.16), H = W / 2.16, ox = (FW - W) / 2, oy = (FH - H) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
    ctx.globalAlpha = dim;
    if (style !== "classic") {
      (style === "modern" ? drawModern : drawRedLcd)({ s: s, W: W, H: H, K: K, dim: dim, warn: warn, settings: settings, imp: imp, max: max, step: step });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      return;
    }

    // ---- the face: a lopsided dome with a lower shoulder on the right, and the strip below
    var cx = W * 0.42, cy = H * 0.8, rx = W * 0.4, ry = H * 0.76, A0 = 178, A1 = 48;      // bar arc, degrees
    function at(t, k) { var a = (A0 - (A0 - A1) * t) * D2R; return [cx + Math.cos(a) * rx * k, cy - Math.sin(a) * ry * k]; }
    var fx0 = W * 0.012, fy1 = H * 0.79;
    // no face shape: the cluster sits straight on the black screen
    // the strip: a bevelled band with a recessed groove for the lamps
    var sy0 = H * 0.83, sh = H * 0.15;
    var sg = ctx.createLinearGradient(0, sy0, 0, sy0 + sh); sg.addColorStop(0, "#121315"); sg.addColorStop(1, "#070808");
    rrect(W * 0.012, sy0, W * 0.976, sh, sh * 0.5); ctx.fillStyle = sg; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1; ctx.stroke();
    rrect(W * 0.17, sy0 + sh * 0.2, W * 0.66, sh * 0.6, sh * 0.3); ctx.fillStyle = "#040505"; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1; ctx.stroke();

    // ---- the bars: lit up to the speed, red past the warning threshold (or the top eighth without a limit)
    var N = 118, frac = Math.min(1, spd / max), redFrom = warn.at > 0 ? Math.min(1, warn.at / max) : 0.875;
    function barColor(t) { var bd = K.bands ? K.bands.filter(function (b) { return t < b[0]; })[0] : null; return t >= redFrom ? (K.zone || RED) : bd ? bd[1] : LIT; }
    // backlight bloom behind the lit bars: only the blur of a stroke is drawn (the stroke
    // itself sits off-canvas, the shadow is offset back on), so the glow has no hard edge
    if (GLOW && frac > 0.005) {
      var OFF_X = W * 4;
      ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = H * 0.1; ctx.globalAlpha = dim * (K.bands ? 0.4 : 0.28);
      ctx.shadowOffsetX = -OFF_X; ctx.shadowBlur = H * 0.05;
      for (var bt = 0; bt < frac; bt += 0.04) {
        var b0 = at(bt, 0.89), b1 = at(Math.min(frac, bt + 0.04), 0.89);
        ctx.shadowColor = barColor(bt); ctx.strokeStyle = "#000";
        ctx.beginPath(); ctx.moveTo(b0[0] + OFF_X, b0[1]); ctx.lineTo(b1[0] + OFF_X, b1[1]); ctx.stroke();
      }
      ctx.restore();
    }
    var lastLit = Math.floor(frac * N + 0.0005) - 1;
    for (var i = 0; i < N; i++) {
      var t0 = (i + 0.22) / N, t1 = (i + 0.78) / N, kin = 0.78, lit = (i + 1) / N <= frac + 0.0005, red = t0 >= redFrom;
      var a = at(t0, kin), b = at(t0, 1), c = at(t1, 1), d = at(t1, kin);
      if (lit) {
        var bg = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
        var band = K.bands ? K.bands.filter(function (b) { return t0 < b[0]; })[0] : null;
        bg.addColorStop(0, red ? "#B3170C" : band ? band[2] : K.dark); bg.addColorStop(1, red ? (K.zone || RED) : band ? band[1] : LIT);
        if (i === lastLit) bg.addColorStop(1, "#FFFFFF");            // the leading bar burns white-hot
        ctx.fillStyle = bg;
      } else ctx.fillStyle = red ? RED_GHOST : GHOST;
      poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]);
    }
    // the red line under the red zone
    ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.beginPath();
    for (var r2 = redFrom; r2 <= 1.0001; r2 += 0.01) { var rp = at(Math.min(1, r2), 0.755); r2 === redFrom ? ctx.moveTo(rp[0], rp[1]) : ctx.lineTo(rp[0], rp[1]); }
    ctx.stroke();
    // ticks and numbers in tens (like the S2000's x1000 r/min)
    var fs = Math.round(H * 0.075);
    for (var v = 0; v <= max; v += step / 2) {
      var tt = v / max, major = v % step === 0, p1 = at(tt, 0.735), p2 = at(tt, major ? 0.695 : 0.715);
      ctx.shadowColor = TICK; ctx.shadowBlur = GLOW * 0.6;
      ctx.strokeStyle = TICK; ctx.lineWidth = major ? 2.2 : 1.4; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      ctx.shadowBlur = 0;
      if (major) { var q = at(tt, 0.635); label(String(v / 10), q[0], q[1] + fs * 0.36, fs, TXT, "center", 300, false, GLOW * 0.5); }
    }
    var z = at(0.02, 0.62); label("x10" + (imp ? "mph" : "km/h"), z[0] + fs * 0.55, z[1] + fs * 0.36, Math.round(fs * 0.38), TXT, "left", 400, false);

    // ---- the speed, in its LCD window, orange then red when over the limit
    var ww = W * 0.24, wh = H * 0.19, wx = cx - ww / 2 - W * 0.02, wy = H * 0.43;
    lcd(wx, wy, ww, wh);
    var dh = wh * 0.8, dw = dh * 0.52, gap = dw * 0.2, wc = K.warn || [ORANGE, RED], sc = warn.stage === 2 ? wc[1] : warn.stage === 1 ? wc[0] : LIT;
    var dl = field(String(Math.round(s.egoSpeed)), 3, wx + ww - (ww - 3 * (dw + gap) + gap) / 2, wy + (wh - dh) / 2, dw, dh, gap, sc, GHOST);
    var us = Math.round(H * 0.06);
    label("mph", wx + ww + W * 0.01, wy + wh * 0.5, us, imp ? TXT : OFF, "left", 500, false);
    label("km/h", wx + ww + W * 0.01, wy + wh * 0.5 + us * 1.15, us, imp ? OFF : TXT, "left", 500, false);

    // ---- the second window: gear and clock, then odometer and trip
    var lw = W * 0.27, lh = H * 0.15, lx = cx - lw / 2, ly = wy + wh + H * 0.02;
    lcd(lx, ly, lw, lh);
    var ch1 = lh * 0.36, cw1 = ch1 * 0.54, cg1 = cw1 * 0.24, now = new Date(s.currentTime || Date.now()), hh = now.getHours(), mm = now.getMinutes();
    if (imp) hh = hh % 12 || 12;
    var clockR = lx + lw * 0.5 + 2 * (cw1 + cg1), cl = field((hh < 10 ? " " : "") + hh + (mm < 10 ? "0" : "") + mm, 4, clockR, ly + lh * 0.08, cw1, ch1, cg1, LIT, GHOST);
    var colonX = cl + 2 * (cw1 + cg1) - cg1 / 2 - ch1 * 0.05;
    ctx.fillStyle = LIT; ctx.fillRect(colonX, ly + lh * 0.08 + ch1 * 0.28, ch1 * 0.08, ch1 * 0.08); ctx.fillRect(colonX - ch1 * 0.03, ly + lh * 0.08 + ch1 * 0.62, ch1 * 0.08, ch1 * 0.08);
    digit(["", "P", "R", "N", "D"][s.gear] || " ", lx + lw * 0.06, ly + lh * 0.08, cw1, ch1, LIT, GHOST);
    var oh = lh * 0.34, ow = oh * 0.52, og = ow * 0.24, oy2 = ly + lh * 0.55;
    if (s.showOdometer !== false && s.odometer > 0) field(String(Math.round(s.odometer) % 1000000), 6, lx + lw * 0.48, oy2, ow, oh, og, LIT, GHOST);
    var trip = window.HaloDrives && HaloDrives.tripKm || 0, td = imp ? trip / KM_PER_MI : trip;
    var tl0 = field(td.toFixed(1), 4, lx + lw * 0.95, oy2, ow, oh, og * 1.3, LIT, GHOST);
    label("TRIP", (lx + lw * 0.48 + tl0) / 2, oy2 + oh * 0.45, Math.round(lh * 0.15), LIT, "center", 600, false);

    // turn arrows either side of the second window
    // Blind spots: a car alongside tints that side's arrow red; signalling into it (or the car
    // flagging it urgent) turns the arrow solid red and pulses it with the rim glow below.
    var showBs = s.alwaysOnBlindSpotMonitor || s.leftBlinker || s.rightBlinker || s.dataSourceType === "demo", tnow = performance.now() / 1000;
    var pulse = 0.55 + 0.45 * Math.sin(tnow * 14);
    function bsLevel(bs, blink) { return !showBs || !bs ? 0 : bs === 2 || blink ? 2 : 1; }
    var bsL = bsLevel(s.leftBlindSpot, s.leftBlinker), bsR = bsLevel(s.rightBlindSpot, s.rightBlinker);
    function arrowColor(blink, lvl) { return lvl === 2 ? "rgba(255,43,28," + pulse.toFixed(2) + ")" : blink === 2 ? GREEN : lvl ? "rgba(255,43,28,0.4)" : OFF; }
    var as = H * 0.065, ay = ly + lh * 0.5;
    [[lx - W * 0.015 - as, -1, s.leftBlinker, bsL], [lx + lw + W * 0.015 + as, 1, s.rightBlinker, bsR]].forEach(function (a) {   // x is the tip
      var c = arrowColor(a[2], a[3]); ctx.save();
      if (GLOW && (a[2] === 2 || a[3])) { ctx.shadowColor = a[3] ? RED : GREEN; ctx.shadowBlur = GLOW * 1.4; }
      if (a[3]) ctx.globalAlpha = 1;                     // hazards stay at full strength
      arrow(a[0], ay, as, a[1], c); ctx.restore();
    });

    // ---- the shoulder dials: power (centre zero, green regen to the left) and battery
    var d1x = W * 0.835, d1y = H * 0.44, dr = W * 0.075, n = 22, half = n / 2, ps = Math.min(1, Math.abs(pw) / 100) * half;
    dial(d1x, d1y, dr, n, function (i) {
      if (pw >= 0) return i >= half && i < half + ps ? (i >= n - 3 ? RED : LIT) : null;
      return i < half && i >= half - ps ? GREEN : null;
    }, function (i) { return i >= n - 3; });
    var gl = Math.round(H * 0.06);
    label("R", d1x - dr * 0.95, d1y + gl * 1.05, gl, TXT, "center", 400, false);
    label("P", d1x + dr * 0.95, d1y + gl * 1.05, gl, TXT, "center", 400, false);
    icon("bolt", d1x, d1y - dr * 0.25, dr * 0.42, TXT);
    var kwMax = s.maxDischargePower > 0 ? s.maxDischargePower : 0, regenMax = s.maxRegenPower > 0 ? s.maxRegenPower : 0;
    if (kwMax || regenMax) label(Math.round(pw >= 0 ? pw / 100 * kwMax : pw / 100 * regenMax) + " kW", d1x, d1y + gl * 0.95, Math.round(gl * 0.62), pw < -0.5 ? GREEN : TXT, "center", 600, false);
    var chg = window.Dash && Dash.charge ? Dash.charge(s) : -1;
    if (chg >= 0 && s.showCarBattery !== false) {
      var d2x = W * 0.9, d2y = H * 0.74, d2r = W * 0.065, n2 = 20, lit2 = Math.round(chg / 100 * n2);
      dial(d2x, d2y, d2r, n2, function (i) { return i < lit2 ? (i < 3 || chg < 20 ? RED : LIT) : null; }, function (i) { return i < 3; });
      label("E", d2x - d2r * 0.95, d2y + gl * 1.0, gl, TXT, "center", 400, false);
      label("F", d2x + d2r * 0.95, d2y + gl * 1.0, gl, TXT, "center", 400, false);
      icon("batt", d2x, d2y - d2r * 0.28, d2r * 0.42, TXT);
      label(chg + "%", d2x, d2y + gl * 0.9, Math.round(gl * 0.62), TXT, "center", 600, false);
    }

    // ---- text lamps in the strip, two-line like MAINT REQ'D; dim when off
    var ty = sy0 + sh * 0.5, ts = Math.round(sh * 0.24);
    function lamp(l1, l2, x, color, on) {
      if (!on) return;                                  // a lamp only shows when it has something to say
      var c = color;
      if (l2) { label(l1, x, ty - ts * 0.12, ts, c, "center", 800, true, GLOW); label(l2, x, ty + ts * 0.95, ts, c, "center", 800, true, GLOW); }
      else label(l1, x, ty + ts * 0.4, Math.round(ts * 1.25), c, "center", 800, true, GLOW);
    }
    lamp("ASSIST", "", W * 0.25, GREEN, !!s.adasOn);
    lamp("SET", String(Math.round(s.accSetSpeed)), W * 0.35, GREEN, s.adasOn && s.accSetSpeed > 0);
    lamp("LIMIT", String(Math.round(s.fusedSpeedLimit)), W * 0.43, ORANGE, s.fusedSpeedLimit > 0);
    var tl = settings.stopLine === false ? 0 : s.trafficLightColor, TLC = ["", RED, GREEN, AMBER];
    var tld = tl && s.stopLineDist > 0 ? (imp ? Math.round(s.stopLineDist * 3.281) + " FT" : Math.round(s.stopLineDist) + " M") : "- -";
    lamp("LIGHT", tld, W * 0.53, TLC[tl] || RED, tl > 0);
    lamp("SEAT", "BELT", W * 0.63, RED, s.gear === 4 && !s.buckleStatus);
    lamp("DOOR", "OPEN", W * 0.73, RED, !!s.anyDoorOpen);

    // ---- blind spots: a car-alongside lamp in that end of the strip (empty space, so it
    // never overlaps anything); full strength whatever the brightness, pulsing when urgent
    ctx.globalAlpha = 1;
    [[bsL, W * 0.085, -1], [bsR, W * 0.915, 1]].forEach(function (b) {
      if (!b[0]) return;
      var a = b[0] === 2 ? pulse : 1;
      ctx.save(); ctx.translate(b[1], sy0 + sh * 0.5); ctx.scale(b[2], 1);   // waves face outward
      if (GLOW) { ctx.shadowColor = RED; ctx.shadowBlur = GLOW * 1.6; }
      icon("car", 0, 0, sh * 0.62, "rgba(255,43,28," + a.toFixed(2) + ")");
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  Dash.onFrame(function (s, dt) {
    if (!active()) return;
    var w = innerWidth, h = innerHeight;
    if (w !== W || h !== H) { W = w; H = h; cv.width = w * dpr; cv.height = h * dpr; last = ""; }
    spd = Dash.smooth(spd, Math.max(0, s.egoSpeed || 0), dt, 8);
    pw = Dash.smooth(pw, s.powerLevel || 0, dt, 6);
    var warn = window.HaloWarn || {};
    // anything pulsing (an urgent blind spot, or signalling toward a car alongside) redraws every frame
    var urgent = s.leftBlindSpot === 2 || s.rightBlindSpot === 2 || (s.leftBlindSpot && s.leftBlinker) || (s.rightBlindSpot && s.rightBlinker);
    var key = [Math.round(spd * 4), Math.round(pw), Math.round(s.egoSpeed), s.gear, s.leftBlinker, s.rightBlinker, s.leftBlindSpot, s.rightBlindSpot,
      s.adasOn, s.accSetSpeed, s.fusedSpeedLimit, s.trafficLightColor, Math.round(s.stopLineDist), s.buckleStatus, s.anyDoorOpen, s.isImperial,
      Math.round(s.odometer), new Date(s.currentTime || Date.now()).getMinutes(), warn.stage, warn.at, window.HaloDim ? HaloDim() : 1,
      window.HaloDrives && Math.round((HaloDrives.tripKm || 0) * 10), (window.HaloSettings || {}).stopLine, (window.HaloSettings || {}).s2kColor, (window.HaloSettings || {}).s2kStyle, JSON.stringify((window.HaloSettings || {}).s2kColors || {}), window.HaloS2kPreview, W, H].join();
    if (key === last && !urgent) return;
    last = key; draw(s, W, H);
  });
})();
