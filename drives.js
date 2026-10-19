/* Halo drives: a trip card when you park, this week's totals, an optional 0-60 timer
   and a parked screensaver. Drives are kept in the app's dash-app storage alongside
   the settings; nothing leaves the phone. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var settings = window.HaloSettings, save = window.HaloSave;
  var KM_PER_MI = 1.609344, SAVER_AFTER = 60, DRIFT_EVERY = 60;
  var trip = null;          // the drive in progress
  var launch = null;        // a 0-60 attempt: { t0, pv, pt, top }
  var lastT = 0, parkedSince = 0, wakeKey = "", saverOffT = 0, driftT = 0, panelT = 0;
  var api = window.HaloDrives = { saver: false };

  // ---- formatting
  function dist(km, imp) { var d = imp ? km / KM_PER_MI : km; return d < 100 ? d.toFixed(1) : Math.round(d).toLocaleString("en-US"); }
  function dur(ms) {
    var s = Math.round(ms / 1000), m = Math.round(s / 60);
    return s < 60 ? [s, "s"] : m < 60 ? [m, "min"] : [Math.floor(m / 60) + " h " + (m % 60), "min"];
  }
  function eff(kwh, km, imp) {
    var d = imp ? km / KM_PER_MI : km;
    return d >= 0.1 ? Math.round(kwh * 1000 / d) : "—";
  }
  function clock(ms, imp) { return Dash.clock({ currentTime: ms, isImperial: imp }); }
  function goal(imp) { return imp ? "0–60 mph" : "0–100 km/h"; }

  // ---- this week's totals, Monday to Sunday in local time
  function weekStart(ms) {
    var d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d.getTime();
  }
  function week(ms) {
    var ws = weekStart(ms), w = settings.week;
    if (!w || w.start !== ws) w = settings.week = { start: ws, km: 0, kwh: 0, drives: 0 };
    return w;
  }

  // one drive's stats as HTML; used by the trip card and the Drives tab
  function driveHtml(d, title, imp) {
    var t = dur(d.end - d.start), u = imp ? "mi" : "km";
    var h = '<div class="hd">' + title + "<span>" + clock(d.start, imp) + " – " + clock(d.end, imp) + "</span></div>" +
      '<div class="st"><div><b>' + dist(d.km, imp) + "<small>" + u + "</small></b><span>Distance</span></div>" +
      "<div><b>" + t[0] + "<small>" + t[1] + "</small></b><span>Time</span></div>" +
      "<div><b>" + eff(d.kwh, d.km, imp) + "<small>Wh/" + u + "</small></b><span>Efficiency</span></div></div>" +
      '<div class="more">' + d.kwh.toFixed(1) + " kWh used · <em>" + d.regen.toFixed(1) + " kWh</em> back from regen" +
      (d.launch ? ' · <span style="white-space:nowrap">' + goal(d.imp) + " <i>" + d.launch.toFixed(1) + " s</i></span>" : "") + "</div>";
    return h;
  }
  function weekHtml(imp) {
    var w = week(Date.now());
    if (!w.drives) return "";
    var u = imp ? "mi" : "km";
    return '<div class="wk"><small>THIS WEEK</small>' + dist(w.km, imp) + " " + u + " · " + eff(w.kwh, w.km, imp) + " Wh/" + u +
      " · " + w.drives + (w.drives === 1 ? " drive" : " drives") + "</div>";
  }

  // ---- energy: pack voltage x current when the source sends them, else the power meter
  function powerKw(s) {
    if (s.packVoltage > 0 && s.packCurrent) return s.packVoltage * s.packCurrent / 1000;
    var p = s.powerLevel || 0;
    return p / 100 * (p >= 0 ? s.maxDischargePower || 0 : s.maxRegenPower || 0);
  }

  function startTrip(s) {
    trip = { start: s.currentTime || Date.now(), km: 0, kwh: 0, regen: 0, lost: 0, launch: 0, imp: !!s.isImperial,
      odo0: s.odometer, nom0: s.nominalEnergyRemaining };
  }
  function endTrip(s) {
    var d = trip; trip = null; launch = null;
    d.end = s.currentTime || Date.now();
    // Frames stop while the screen is off or the app is in the background. If many were
    // missed, trust the odometer and the pack's energy counter over the running sums.
    var odoKm = (s.odometer - d.odo0) * (s.isImperial ? KM_PER_MI : 1);
    if (d.odo0 > 0 && odoKm > d.km + 1.7 && odoKm < d.km + 1000) d.km = odoKm;
    var used = d.nom0 - s.nominalEnergyRemaining;
    if (d.lost > 30 && d.nom0 > 0 && used > d.kwh) d.kwh = used;
    if (d.km < (s.dataSourceType === "demo" ? 0.05 : 0.2)) return;     // moving the car up the driveway isn't a drive
    var rec = { start: d.start, end: d.end, km: d.km, kwh: d.kwh, regen: d.regen, imp: d.imp, launch: d.launch ? +d.launch.toFixed(2) : 0 };
    settings.lastDrive = rec;
    var w = week(rec.end); w.km += rec.km; w.kwh += rec.kwh; w.drives++;
    if (rec.launch) {
      var k = rec.imp ? "mph" : "kmh", best = settings.bestLaunch || (settings.bestLaunch = {});
      if (!best[k] || rec.launch < best[k]) best[k] = rec.launch;
    }
    save();
    showCard(s);
  }

  // 0-60 mph (0-100 km/h) from a standstill in Drive. Integer speeds arrive ~10 times
  // a second, so the crossing is interpolated between the last two readings.
  function timeLaunch(s, t) {
    if (settings.launch !== true) { launch = null; return; }
    var v = s.egoSpeed, g = s.isImperial ? 60 : 100;
    if (v < 0.5) { launch = s.gear === 4 ? { t0: t, pv: 0, pt: t, top: 0 } : null; return; }
    if (!launch) return;
    if (v < launch.top - 2 || t - launch.t0 > 25) { launch = null; return; }     // lifted off: not a launch
    if (v >= g) {
      var at = launch.pt + (t - launch.pt) * (g - launch.pv) / Math.max(0.01, v - launch.pv), sec = at - launch.t0;
      launch = null;
      if (trip && sec > 1.5 && (!trip.launch || sec < trip.launch)) trip.launch = sec;
      return;
    }
    if (v !== launch.pv) { launch.pv = v; launch.pt = t; }
    launch.top = Math.max(launch.top, v);
  }

  // ---- trip card
  function showCard(s) {
    $("tripBody").innerHTML = driveHtml(settings.lastDrive, "Drive complete", !!s.isImperial) + weekHtml(!!s.isImperial);
    $("trip").hidden = false; document.body.classList.add("tripOn");
  }
  function hideCard() {
    if ($("trip").hidden) return;
    $("trip").hidden = true; document.body.classList.remove("tripOn");
  }
  $("trip").addEventListener("click", hideCard);

  // ---- screensaver
  function startSaver(t) {
    hideCard();
    api.saver = true; saverOffT = 0; driftT = t;
    var el = $("saver"); el.hidden = false; document.body.classList.add("saving");
    requestAnimationFrame(function () { el.classList.add("on"); });
    setTimeout(function () { if (api.saver) document.body.classList.add("saved"); }, 1300);   // pauses the 3D view
  }
  function wake(t) {
    if (parkedSince) parkedSince = t;
    if (!api.saver) return;
    api.saver = false; saverOffT = t;
    document.body.classList.remove("saved", "saving");
    $("saver").classList.remove("on");
    $("c").style.transform = "";
  }
  function onTouch() { wake(performance.now() / 1000); }
  document.addEventListener("pointerdown", onTouch, true);
  document.addEventListener("touchstart", onTouch, { passive: true, capture: true });
  function drift() {
    var r = function (n) { return Math.round((Math.random() * 2 - 1) * n); };
    $("saverIn").style.transform = "translate(" + r(6) + "vw," + r(6) + "vh)";
    $("c").style.transform = "translate(" + r(3) + "px," + r(3) + "px)";
  }

  // ---- the Drives tab in settings
  var tabs = $("tabs");
  tabs.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    [].forEach.call(tabs.children, function (x) {
      var on = x === b; x.setAttribute("aria-selected", on ? "true" : "false"); $(x.dataset.tab).hidden = !on;
    });
    renderPanel();
  });
  var opts = document.querySelectorAll(".switch[data-opt]");
  function optOn(b) { var v = settings[b.dataset.opt]; return v === undefined ? b.dataset.def === "true" : v === true; }
  [].forEach.call(opts, function (b) {
    b.addEventListener("click", function () { settings[b.dataset.opt] = !optOn(b); save(); renderPanel(); });
  });
  function renderPanel() {
    var s = Dash.state, imp = !!s.isImperial, h;
    [].forEach.call(opts, function (b) { b.setAttribute("aria-checked", optOn(b) ? "true" : "false"); });
    $("launchLbl").textContent = goal(imp) + " timer";
    if (trip) h = driveHtml({ start: trip.start, end: s.currentTime || Date.now(), km: trip.km, kwh: trip.kwh, regen: trip.regen, imp: trip.imp, launch: trip.launch }, "This drive", imp);
    else if (settings.lastDrive) h = driveHtml(settings.lastDrive, "Last drive", imp);
    else h = '<div class="hd">Drives</div><div class="none">Nothing yet. Each time you park, Halo shows the drive and adds it to this week.</div>';
    var best = settings.bestLaunch && settings.bestLaunch[imp ? "mph" : "kmh"];
    if (best && settings.launch === true) h += '<div class="more">Best ' + goal(imp) + " <i>" + best.toFixed(1) + " s</i></div>";
    $("drvBody").innerHTML = h + weekHtml(imp);
  }

  Dash.onFrame(function (s) {
    var t = performance.now() / 1000, dt = lastT ? t - lastT : 0; lastT = t;
    if (dt > 2) { if (trip) trip.lost += dt; dt = 0; }

    // ---- the drive
    if (!trip && s.gear >= 2 && s.gear <= 4 && s.egoSpeed > 0.5) startTrip(s);
    if (trip) {
      trip.km += s.egoSpeed * (s.isImperial ? KM_PER_MI : 1) * dt / 3600;
      var kw = powerKw(s);
      trip.kwh += kw * dt / 3600;
      if (kw < 0) trip.regen -= kw * dt / 3600;
    }
    timeLaunch(s, t);         // also while stopped, so it sees the standstill a launch starts from
    if (trip && s.gear === 1) endTrip(s);

    // ---- parked: card first, then the screensaver after a quiet minute
    var parked = s.gear === 1, key = [s.gear, s.anyDoorOpen, s.buckleStatus].join();
    if (key !== wakeKey) { wakeKey = key; wake(t); }
    if (!parked) { hideCard(); parkedSince = 0; }
    else if (!parkedSince) parkedSince = t;
    if (parked && !api.saver && settings.saver !== false && $("sheet").hidden && t - parkedSince > SAVER_AFTER) startSaver(t);
    if (api.saver) {
      $("saverClock").textContent = Dash.clock(s);
      var c = Dash.charge(s), d = new Date(s.currentTime || Date.now());
      var sub = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + (c >= 0 && s.showCarBattery ? "  ·  " + c + "%" : "");
      if ($("saverSub").textContent !== sub) $("saverSub").textContent = sub;
      if (t - driftT > DRIFT_EVERY) { driftT = t; drift(); }
    } else if (saverOffT && t - saverOffT > 1.3) { saverOffT = 0; $("saver").hidden = true; }

    if (!$("sheet").hidden && !$("panelDrv").hidden && t - panelT > 0.5) { panelT = t; renderPanel(); }
  });
})();
