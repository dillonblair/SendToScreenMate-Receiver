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

  // ---- Modern: after Honda's later digital S2000-style screen. A wide arc of fine bars with
  // bold numbers inside, a big rounded speed, two small arc gauges stepping down the right
  // (power, battery), an info row, and lamps in the bottom corners.
  function drawModern(o) {
    var s = o.s, W = o.W, H = o.H, K = o.K, imp = o.imp, warn = o.warn;
    // numbered 0 to 9 like the original, each number 10 mph (20 km/h); the arc runs on to 10
    var step = imp ? 10 : 20, max = step * 10;
    var cx = W * 0.46, cy = H * 0.95, rx = W * 0.44, ry = H * 0.9, A0 = 170, A1 = 60;
    function at(t, k, a0, a1, sc) { var a = ((a0 || A0) - ((a0 || A0) - (a1 || A1)) * t) * D2R; sc = sc || 1; return [cx + Math.cos(a) * rx * k * sc, cy - Math.sin(a) * ry * k * sc]; }
    var frac = Math.min(1, spd / max), redFrom = warn.at > 0 ? Math.min(1, warn.at / max) : 0.875;
    // the band: fine bars, dark grey when unlit, the scheme's colour when lit, red past the warning point
    var N = 120;
    for (var i = 0; i < N; i++) {
      var t0 = (i + 0.2) / N, t1 = (i + 0.8) / N, lit = (i + 1) / N <= frac + 0.0005, red = t0 >= redFrom, a = at(t0, 0.93), b = at(t0, 1), c = at(t1, 1), d = at(t1, 0.93);
      ctx.shadowBlur = lit && GLOW ? GLOW * 0.7 : 0; ctx.shadowColor = bandColour(K, t0, redFrom);
      ctx.fillStyle = lit ? bandColour(K, t0, redFrom) : red ? "rgba(255,43,28,0.22)" : "rgba(255,255,255,0.1)";
      poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]);
    }
    ctx.shadowBlur = 0;
    // ticks and bold numbers inside the band
    var fs = Math.round(H * 0.1);
    for (var v = 0; v <= max; v += step / 2) {
      var tt = v / max, major = v % step === 0, p1 = at(tt, 0.875), p2 = at(tt, major ? 0.83 : 0.85);
      ctx.strokeStyle = TXT; ctx.lineWidth = major ? 3 : 2; ctx.lineCap = "butt"; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      if (major && v < max) { var q = at(tt, 0.735); label(String(v / step), q[0], q[1] + fs * 0.36, fs, TXT, "center", 700, false, GLOW * 0.4); }
    }
    ctx.lineCap = "round";
    // the speed: big and rounded, orange then red over the limit, centred on the arc
    var wc = K.warn || [ORANGE, RED], sc = warn.stage === 2 ? wc[1] : warn.stage === 1 ? wc[0] : "#FFFFFF";
    label(String(Math.round(s.egoSpeed)), cx, H * 0.64, Math.round(H * 0.3), sc, "center", 700, false, GLOW * 1.2);
    var bs = blindSpots(s), as = H * 0.07;
    turnArrow(cx - W * 0.15, H * 0.545, as, -1, s.leftBlinker, bs.L, bs.pulse);
    turnArrow(cx + W * 0.15 + as, H * 0.545, as, 1, s.rightBlinker, bs.R, bs.pulse);
    // two rows on one grid centred under the speed: columns at cx -/+ C1 (clock, odometer |
    // date, trip) and cx -/+ C2 (power | battery); units and gear in the middle column
    var C1 = W * 0.115, C2 = W * 0.235, r1 = H * 0.805, r2 = H * 0.93;
    var big = Math.round(H * 0.056), mid = Math.round(H * 0.044), small = Math.round(H * 0.024), GREY = "#8C9096";
    label(imp ? "mph" : "km/h", cx, r1, mid, "#C9CCD1", "center", 500, false);
    label(clockText(s, imp), cx - C1, r1, mid, TXT, "center", 600, false);
    var dd = new Date(s.currentTime || Date.now());
    label((dd.getMonth() < 9 ? "0" : "") + (dd.getMonth() + 1) + "-" + (dd.getDate() < 10 ? "0" : "") + dd.getDate(), cx + C1, r1, mid, TXT, "center", 600, false);
    var kwMax = s.maxDischargePower > 0 ? s.maxDischargePower : 0, regenMax = s.maxRegenPower > 0 ? s.maxRegenPower : 0;
    var kw = kwMax || regenMax ? Math.round(pw >= 0 ? pw / 100 * kwMax : pw / 100 * regenMax) : Math.round(pw);
    // power: the number ends at the column, its unit and caption stacked just right of it
    label(String(kw), cx - C2, r1, big, pw < -0.5 ? GREEN : TXT, "right", 600, false);
    label(kwMax || regenMax ? "kW" : "%", cx - C2 + W * 0.006, r1 - big * 0.45, Math.round(small * 1.25), TXT, "left", 600, false);
    label("POWER", cx - C2 + W * 0.006, r1, small, GREY, "left", 600, false);
    var chg = window.Dash && Dash.charge ? Dash.charge(s) : -1;
    if (chg >= 0 && s.showCarBattery !== false) {
      // battery mirrors it: the number starts at the column, unit and caption just left of it
      label(String(chg), cx + C2, r1, big, chg < 20 ? RED : TXT, "left", 600, false);
      label("%", cx + C2 - W * 0.006, r1 - big * 0.45, Math.round(small * 1.25), TXT, "right", 600, false);
      label("BATTERY", cx + C2 - W * 0.006, r1, small, GREY, "right", 600, false);
    }
    label(["", "P", "R", "N", "D"][s.gear] || "", cx, r2, Math.round(big * 1.05), TXT, "center", 700, false, GLOW * 0.5);
    if (s.showOdometer !== false && s.odometer > 0) {
      label("ODO", cx - C1, r2 - mid * 1.15, small, GREY, "center", 600, false);
      label(Math.round(s.odometer).toLocaleString("en-US"), cx - C1, r2, mid, TXT, "center", 600, false);
    }
    var trip = window.HaloDrives && HaloDrives.tripKm || 0;
    label("TRIP", cx + C1, r2 - mid * 1.15, small, GREY, "center", 600, false);
    label((imp ? trip / KM_PER_MI : trip).toFixed(1), cx + C1, r2, mid, TXT, "center", 600, false);
    // the two shoulder gauges, short arcs stepping down the right: power, then battery
    function shoulder(a0, a1, sc, k0, n, litN, colour, redEnd) {
      for (var j = 0; j < n; j++) {
        var u0 = (j + 0.2) / n, u1 = (j + 0.8) / n, q0 = at(u0, k0, a1, a0, sc), q1 = at(u0, 1, a1, a0, sc), q2 = at(u1, 1, a1, a0, sc), q3 = at(u1, k0, a1, a0, sc);
        var on = j < litN, isRed = redEnd(j);
        ctx.shadowBlur = on && GLOW ? GLOW * 0.7 : 0; ctx.shadowColor = colour(j);
        ctx.fillStyle = on ? colour(j) : isRed ? "rgba(255,43,28,0.22)" : "rgba(255,255,255,0.1)";
        poly([q0[0], q0[1], q1[0], q1[1], q2[0], q2[1], q3[0], q3[1]]);
      }
      ctx.shadowBlur = 0;
    }
    var gs = Math.round(H * 0.05), n1 = 12, p1n = Math.round(Math.min(1, Math.abs(pw) / 100) * n1);
    // power: 0 at the lower end, P (red) at the upper; green when regenerating
    shoulder(52, 39, 1, 0.91, n1, p1n, function (j) { return pw < 0 ? GREEN : j >= n1 - 2 ? RED : K.lit; }, function (j) { return j >= n1 - 2; });
    var e0 = at(1, 0.83, 39, 52, 1), e1 = at(0, 0.83, 39, 52, 1), ic = at(0.5, 0.76, 39, 52, 1);
    label("P", e0[0], e0[1] + gs * 0.35, gs, RED, "center", 600, false); label("0", e1[0], e1[1] + gs * 0.35, gs, TXT, "center", 600, false);
    icon("bolt", ic[0] - gs * 0.6, ic[1], H * 0.05, TXT);
    if (chg >= 0 && s.showCarBattery !== false) {
      // battery, a step further down: F at the upper end, E (red) at the lower
      var n2 = 12, b2 = Math.round(chg / 100 * n2);
      shoulder(28, 13, 1.0, 0.91, n2, b2, function (j) { return j < 2 || chg < 20 ? RED : K.lit; }, function (j) { return j < 2; });
      var f0 = at(1, 0.83, 13, 28, 1), f1 = at(0, 0.83, 13, 28, 1), bi = at(0.5, 0.76, 13, 28, 1);
      label("F", f0[0], f0[1] + gs * 0.35, gs, TXT, "center", 600, false); label("E", f1[0], f1[1] + gs * 0.35, gs, RED, "center", 600, false);
      icon("batt", bi[0] - gs * 0.6, bi[1], H * 0.05, AMBER);
    }
    // lamps on the same grid: assist and set speed under power, the limit under battery; the
    // belt and the light ahead / door further out; blind-spot cars in the corners
    var ls = H * 0.06, lt = Math.round(H * 0.038), lamp2 = r2;
    carLamp(W * 0.035, lamp2 - ls * 0.3, ls, -1, bs.L, bs.pulse);
    carLamp(W * 0.965, lamp2 - ls * 0.3, ls, 1, bs.R, bs.pulse);
    if (s.gear === 4 && !s.buckleStatus) icon("belt", W * 0.085, lamp2 - ls * 0.3, ls * 0.85, RED);
    if (s.adasOn) {
      icon("wheel", cx - C2 - W * 0.04, lamp2 - ls * 0.3, ls * 0.75, GREEN);
      if (s.accSetSpeed > 0) label("SET " + Math.round(s.accSetSpeed), cx - C2 - W * 0.015, lamp2, lt, GREEN, "left", 700, false, GLOW);
    }
    if (s.fusedSpeedLimit > 0) label("LIMIT " + Math.round(s.fusedSpeedLimit), cx + C2, lamp2, lt, ORANGE, "left", 700, false, GLOW);
    var la = lightAhead(s, o.settings, imp), farR = W * 0.925;
    if (s.anyDoorOpen) { label("DOOR", farR, lamp2, lt, RED, "right", 800, false, GLOW); farR -= W * 0.075; }
    if (la.c) label(la.d || "LIGHT", farR, lamp2, lt, la.c, "right", 700, false, GLOW);
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
