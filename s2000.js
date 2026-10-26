/* Halo S2000 theme: a digital cluster after the Honda S2000's. A dome of LED bars sweeps
   with the speed (an EV has no revs to show), a big slanted seven-segment speed sits in
   the middle, an LCD strip carries the clock, gear, odometer and trip, and two small bar
   gauges show power and battery. Unlit segments stay faintly visible, as on the real
   LCD. The bars run into red past the speed-warning threshold (limit + chosen margin).
   Everything is drawn here on one canvas; no images or fonts beyond Montserrat. */
(function () {
  "use strict";
  var cv = document.getElementById("s2k");
  if (!cv) return;
  var ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  var W = 0, H = 0, spd = 0, pw = 0, last = "", blinkT = { l: 0, r: 0 };
  var LIT = "#F3F3EE", GHOST = "rgba(255,255,255,0.055)", RED = "#FF2B1C", RED_GHOST = "rgba(255,43,28,0.12)";
  var GREEN = "#3BE36B", ORANGE = "#FF8A1E", AMBER = "#FFB020", LCD = "#0C0E10";
  var SEGS = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc",
    "8": "abcdefg", "9": "abcdfg", "-": "g", "P": "abefg", "R": "eg", "N": "ceg", "D": "bcdeg", " ": "" };
  var KM_PER_MI = 1.609344;

  function active() { return document.documentElement.classList.contains("s2000"); }
  function poly(p) { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); ctx.fill(); }

  // one slanted seven-segment digit; ghost (if given) paints the unlit segments
  function digit(ch, x, y, w, h, lit, ghost) {
    var t = w * 0.2, g = t * 0.16, on = SEGS[ch] || "", k = 0.1, m = y + h / 2;
    function hs(x1, x2, yc) { return [x1, yc, x1 + t / 2, yc - t / 2, x2 - t / 2, yc - t / 2, x2, yc, x2 - t / 2, yc + t / 2, x1 + t / 2, yc + t / 2]; }
    function vs(xc, y1, y2) { return [xc, y1, xc + t / 2, y1 + t / 2, xc + t / 2, y2 - t / 2, xc, y2, xc - t / 2, y2 - t / 2, xc - t / 2, y1 + t / 2]; }
    var l = x + t / 2, r = x + w - t / 2;
    var P = { a: hs(l + g, r - g, y + t / 2), g: hs(l + g, r - g, m), d: hs(l + g, r - g, y + h - t / 2),
      f: vs(l, y + t / 2 + g, m - g), b: vs(r, y + t / 2 + g, m - g), e: vs(l, m + g, y + h - t / 2 - g), c: vs(r, m + g, y + h - t / 2 - g) };
    ctx.save(); ctx.transform(1, 0, -k, 1, k * (y + h), 0);
    for (var n in P) {
      var hit = on.indexOf(n) >= 0;
      if (!hit && !ghost) continue;
      ctx.fillStyle = hit ? lit : ghost; poly(P[n]);
    }
    ctx.restore();
  }
  // a right-aligned row of `slots` digits ending at xr; "." lights the point after a digit
  function field(text, slots, xr, y, w, h, gap, lit, ghost) {
    var chars = [], dots = [];
    for (var i = 0; i < text.length; i++) {
      if (text[i] === ".") dots[chars.length - 1] = true; else chars.push(text[i]);
    }
    while (chars.length < slots) { chars.unshift(" "); dots.unshift(false); }
    for (var j = 0; j < slots; j++) digit(chars[j], xr - (slots - j) * (w + gap) + gap, y, w, h, lit, ghost);
    // points after the digits, so the next digit's unlit segments don't cover them
    for (j = 0; j < slots; j++) if (dots[j]) {
      var d = w * 0.22, x = xr - (slots - j) * (w + gap) + gap + w + (gap - d) / 2;
      ctx.fillStyle = lit; ctx.fillRect(x, y + h - d, d, d);
    }
    return xr - slots * (w + gap) + gap;            // left edge, for placing labels
  }
  function label(text, x, y, size, color, align, weight) {
    ctx.save(); ctx.font = (weight || 600) + " " + size + "px Montserrat, system-ui, sans-serif";
    ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color;
    ctx.transform(1, 0, -0.12, 1, 0.12 * y, 0); ctx.fillText(text, x, y); ctx.restore();
  }
  function arrow(x, y, s, dir, color) {
    ctx.fillStyle = color; ctx.beginPath();
    var p = [0, 0, 0.5, -0.5, 0.5, -0.2, 1, -0.2, 1, 0.2, 0.5, 0.2, 0.5, 0.5];
    for (var i = 0; i < p.length; i += 2) {
      var px = x + (dir < 0 ? p[i] : -p[i]) * s, py = y + p[i + 1] * s;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
  // horizontal bar gauge of n segments; the first `red` segments are drawn red
  function bars(x, y, w, h, n, frac, color, red) {
    var sw = w / n;
    for (var i = 0; i < n; i++) {
      var lit = (i + 1) / n <= frac + 0.001, isRed = i < (red || 0);
      ctx.fillStyle = lit ? (isRed ? RED : color) : (isRed ? RED_GHOST : GHOST);
      ctx.save(); ctx.transform(1, 0, -0.18, 1, 0.18 * (y + h), 0); ctx.fillRect(x + i * sw + sw * 0.18, y, sw * 0.64, h); ctx.restore();
    }
  }

  // FW x FH is the screen; the cluster is laid out in a box of the S2000's own proportions
  // centred on it, so a near-square screen (the unfolded iPhone Duo) doesn't stretch it
  function draw(s, FW, FH) {
    var imp = s.isImperial !== false, max = imp ? 140 : 220, step = imp ? 20 : 40;
    var dim = window.HaloDim ? HaloDim() : 1, warn = window.HaloWarn || { stage: 0, at: 0 };
    var settings = window.HaloSettings || {};
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, FW, FH);
    var W = Math.min(FW, FH * 2.16), H = W / 2.16, ox = (FW - W) / 2, oy = (FH - H) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
    ctx.globalAlpha = dim;
    var sx = Math.max(0, (window.HaloSx || 0) - ox);
    var cx = W / 2, cy = H * 0.78, rx = Math.min(W * 0.43, W / 2 - sx - H * 0.08), ry = H * 0.64;
    function at(t, k) { var a = Math.PI * (0.94 - 0.88 * t); return [cx + Math.cos(a) * rx * k, cy - Math.sin(a) * ry * k]; }

    // the dome of bars: lit up to the speed, red past the warning threshold (or the top eighth without a limit)
    var N = 96, frac = Math.min(1, spd / max), redFrom = warn.at > 0 ? Math.min(1, warn.at / max) : 0.875;
    for (var i = 0; i < N; i++) {
      var t0 = i / N + 0.18 / N, t1 = (i + 1) / N, kin = 1 - (0.06 + 0.1 * t1), lit = t1 <= frac + 0.0005, red = t0 >= redFrom;
      var a = at(t0, kin), b = at(t0, 1), c = at(t1, 1), d = at(t1, kin);
      ctx.fillStyle = lit ? (red ? RED : LIT) : (red ? RED_GHOST : GHOST);
      poly([a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]);
    }
    // ticks and numbers (tens of mph or km/h, like the S2000's x1000 r/min)
    var fs = Math.round(H * 0.06);
    for (var v = 0; v <= max; v += step / 2) {
      var tt = v / max, kk = 1 - (0.06 + 0.1 * tt) - 0.03, major = v % step === 0;
      var p1 = at(tt, kk), p2 = at(tt, kk - (major ? 0.05 : 0.03));
      ctx.strokeStyle = LIT; ctx.lineWidth = major ? 2.4 : 1.6; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      if (major) { var q = at(tt, kk - 0.1); label(String(v / 10), q[0], q[1] + fs * 0.35, fs, LIT, "center", 500); }
    }
    var z = at(0.035, 0.74); label("x10 " + (imp ? "mph" : "km/h"), z[0], z[1], Math.round(fs * 0.45), LIT, "left", 500);

    // the speed, three big slanted digits; orange then red when over the limit
    var dh = H * 0.24, dw = dh * 0.56, gap = dw * 0.2, sc = warn.stage === 2 ? RED : warn.stage === 1 ? ORANGE : LIT;
    var dxr = cx + (3 * (dw + gap)) / 2, dy = H * 0.34;
    var dl = field(String(Math.round(s.egoSpeed)), 3, dxr, dy, dw, dh, gap, sc, GHOST);
    label(imp ? "mph" : "km/h", dxr + gap, dy + dh, Math.round(H * 0.05), LIT, "left", 500);
    // turn arrows either side of the speed
    var as = H * 0.075, ay = dy + dh * 0.55;
    arrow(dl - gap * 2.6, ay, as, -1, s.leftBlinker === 2 ? GREEN : GHOST);
    arrow(dxr + gap * 2.6 + as * 0.9, ay, as, 1, s.rightBlinker === 2 ? GREEN : GHOST);

    // LCD strip: gear and clock on top, odometer and trip below
    var lw = W * 0.3, lx = cx - lw / 2, ly = H * 0.64, lh = H * 0.15;
    ctx.fillStyle = LCD; ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(lx, ly, lw, lh, 6); else ctx.rect(lx, ly, lw, lh); ctx.fill(); ctx.stroke();
    var sh = lh * 0.36, swd = sh * 0.55, sg = swd * 0.24;
    var now = new Date(s.currentTime || Date.now()), hh = now.getHours(), mm = now.getMinutes();
    if (imp) hh = hh % 12 || 12;
    var clockR = cx + lw * 0.2, cl = field((hh < 10 ? " " : "") + hh + (mm < 10 ? "0" : "") + mm, 4, clockR, ly + lh * 0.08, swd, sh, sg, LIT, GHOST);
    var colonX = cl + 2 * (swd + sg) - sg / 2 - sh * 0.04;
    ctx.fillStyle = LIT; ctx.fillRect(colonX, ly + lh * 0.08 + sh * 0.28, sh * 0.08, sh * 0.08); ctx.fillRect(colonX - sh * 0.03, ly + lh * 0.08 + sh * 0.64, sh * 0.08, sh * 0.08);
    digit(["", "P", "R", "N", "D"][s.gear] || " ", lx + lw * 0.06, ly + lh * 0.08, swd, sh, LIT, GHOST);
    var oh = lh * 0.3, ow = oh * 0.55, og = ow * 0.24, oy = ly + lh * 0.58;
    if (s.showOdometer !== false && s.odometer > 0) field(String(Math.round(s.odometer) % 1000000), 6, lx + lw * 0.52, oy, ow, oh, og, LIT, GHOST);
    var trip = window.HaloDrives && HaloDrives.tripKm || 0, td = imp ? trip / KM_PER_MI : trip;
    var tl0 = field(td.toFixed(1), 4, lx + lw * 0.95, oy, ow, oh, og * 1.4, LIT, GHOST);
    label("TRIP", tl0 - og, oy + oh * 0.5, Math.round(lh * 0.13), ORANGE, "right", 700);

    // small bar gauges: power (green when regenerating) and battery (E to F)
    var gy = H * 0.84, gh = H * 0.04, gw = W * 0.16, gs = Math.round(H * 0.042);
    var glx = lx - gw - W * 0.07, grx = lx + lw + W * 0.07;
    var kwMax = s.maxDischargePower > 0 ? s.maxDischargePower : 0, regenMax = s.maxRegenPower > 0 ? s.maxRegenPower : 0;
    bars(glx, gy, gw, gh, 16, pw >= 0 ? pw / 100 : -pw / 100, pw >= 0 ? LIT : GREEN, 0);
    label("PWR", glx - gs * 0.4, gy + gh, Math.round(gs * 0.75), LIT, "right", 600);
    if (kwMax || regenMax) {
      var kw = pw >= 0 ? pw / 100 * kwMax : pw / 100 * regenMax;
      label(Math.round(kw) + " kW", glx + gw / 2, gy - gh * 0.5, Math.round(gs * 0.75), pw < 0 ? GREEN : LIT, "center", 600);
    }
    var ch = window.Dash && Dash.charge ? Dash.charge(s) : -1;
    if (ch >= 0 && s.showCarBattery !== false) {
      bars(grx, gy, gw, gh, 16, ch / 100, ch < 20 ? RED : LIT, 3);
      label("E", grx - gs * 0.7, gy + gh, gs, LIT, "center", 500); label("F", grx + gw + gs * 0.6, gy + gh, gs, LIT, "center", 500);
      label(ch + "%", grx + gw / 2, gy - gh * 0.5, Math.round(gs * 0.75), LIT, "center", 600);
    }

    // telltales along the bottom, S2000-style text lamps: dim when off
    var ty = H * 0.965, ts = Math.round(H * 0.04), off = "rgba(255,255,255,0.07)";
    function lamp(text, x, color, onNow, align) { label(text, x, ty, ts, onNow ? color : off, align || "center", 800); }
    lamp("BELT", W * 0.2, RED, s.gear === 4 && !s.buckleStatus);
    lamp("DOOR", W * 0.29, RED, !!s.anyDoorOpen);
    lamp("ASSIST", W * 0.39, GREEN, !!s.adasOn);
    lamp(s.adasOn && s.accSetSpeed > 0 ? "SET " + Math.round(s.accSetSpeed) : "SET", W * 0.49, GREEN, s.adasOn && s.accSetSpeed > 0);
    lamp(s.fusedSpeedLimit > 0 ? "LIMIT " + Math.round(s.fusedSpeedLimit) : "LIMIT", W * 0.61, ORANGE, s.fusedSpeedLimit > 0);
    var tl = settings.stopLine === false ? 0 : s.trafficLightColor, TLC = ["", RED, GREEN, AMBER];
    var tlText = tl && s.stopLineDist > 0 ? (imp ? Math.round(s.stopLineDist * 3.281) + " FT" : Math.round(s.stopLineDist) + " M") : "LIGHT";
    lamp(tlText, W * 0.75, TLC[tl] || RED, tl > 0);

    // blind spots: a red bar down that side of the screen, full strength whatever the brightness
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
    W = FW; H = FH; sx = window.HaloSx || 0;
    var showBs = s.alwaysOnBlindSpotMonitor || s.leftBlinker || s.rightBlinker || s.dataSourceType === "demo", t = performance.now() / 1000;
    [["l", s.leftBlindSpot], ["r", s.rightBlindSpot]].forEach(function (bs) {
      if (!showBs || !bs[1]) return;
      ctx.globalAlpha = bs[1] === 2 ? 0.55 + 0.45 * Math.sin(t * 20) : 1;
      ctx.fillStyle = RED; var bw = H * 0.018, bx = bs[0] === "l" ? sx + H * 0.03 : W - sx - H * 0.03 - bw;
      ctx.fillRect(bx, H * 0.2, bw, H * 0.6);
    });
    ctx.globalAlpha = 1;
  }

  Dash.onFrame(function (s, dt) {
    if (!active()) return;
    var w = innerWidth, h = innerHeight;
    if (w !== W || h !== H) { W = w; H = h; cv.width = w * dpr; cv.height = h * dpr; last = ""; }
    spd = Dash.smooth(spd, Math.max(0, s.egoSpeed || 0), dt, 8);
    pw = Dash.smooth(pw, s.powerLevel || 0, dt, 6);
    var warn = window.HaloWarn || {}, urgent = s.leftBlindSpot === 2 || s.rightBlindSpot === 2;
    var key = [Math.round(spd * 4), Math.round(pw), Math.round(s.egoSpeed), s.gear, s.leftBlinker, s.rightBlinker, s.leftBlindSpot, s.rightBlindSpot,
      s.adasOn, s.accSetSpeed, s.fusedSpeedLimit, s.trafficLightColor, Math.round(s.stopLineDist), s.buckleStatus, s.anyDoorOpen, s.isImperial,
      Math.round(s.odometer), new Date(s.currentTime || Date.now()).getMinutes(), warn.stage, warn.at, window.HaloDim ? HaloDim() : 1,
      window.HaloDrives && Math.round((HaloDrives.tripKm || 0) * 10), W, H].join();
    if (key === last && !urgent) return;
    last = key; draw(s, W, H);
  });
})();
