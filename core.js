/* DashPilot data plumbing: Android + iOS delivery, plus a demo loop that only
   runs outside the app (e.g. in a desktop browser) when no car data has arrived. */
(function () {
  "use strict";
  var KEYS = ["currentTime", "phoneBattery", "isImperial", "darkMode", "renderQuality",
    "alwaysOnBlindSpotMonitor", "dataSourceType", "egoSpeed", "gear", "egoSteeringAngle",
    "leftBlinker", "rightBlinker", "anyDoorOpen", "buckleStatus", "odometer", "adasOn",
    "accSetSpeed", "fusedSpeedLimit", "leftBlindSpot", "rightBlindSpot", "trafficLightColor",
    "stopLineDist", "changingLane", "nominalEnergyRemaining", "fullPackEnergy", "energyBuffer",
    "powerLevel", "maxRegenPower", "maxDischargePower", "packTMin", "packTMax",
    "showPhoneBattery", "showCarBattery", "showOdometer",
    // not sent to dash apps today; read if a future DashPilot adds them
    "vin", "exteriorColor"];

  var state = {};
  KEYS.forEach(function (k) { state[k] = 0; });
  state.darkMode = true;
  state.vin = ""; state.exteriorColor = -1;   // "not reported": 0 is a real paint code
  state.showPhoneBattery = state.showCarBattery = state.showOdometer = true;   // the app's defaults
  var lastLive = 0;
  // demo-only switches from the URL hash, e.g. index.html#day or #metric
  function readHash() { var h = location.hash; state.__demoLight = h.indexOf("day") >= 0; state.__demoMetric = h.indexOf("metric") >= 0; state.__demoJuniper = h.indexOf("juniper") >= 0; }
  readHash(); window.addEventListener("hashchange", readHash);

  function fromAndroid() {
    var n = window.NativeCarState, s = {};
    if (!n) return s;
    KEYS.forEach(function (k) {
      var cap = k[0].toUpperCase() + k.slice(1);
      var m = k === "isImperial" ? k : n["get" + cap] ? "get" + cap : "is" + cap;
      if (typeof n[m] === "function") s[k] = n[m]();
    });
    return s;
  }
  function merge(s) { for (var k in s) state[k] = s[k]; lastLive = Date.now(); }
  window.onCarStateUpdate = function () { merge(fromAndroid()); };
  window.receiveMessage = function (s) { if (s) merge(s); };

  // ---- demo loop (48 s): pull away, cruise on assist, lane change with a car in
  // the blind spot, then brake to a red light and wait for green.
  var L = 48;
  function ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function speedAt(t) {
    t = ((t % L) + L) % L;
    if (t < 3) return 0;
    if (t < 13) return 68 * (1 - Math.pow(1 - (t - 3) / 10, 2));
    if (t < 31) return 68 + 2 * ease((t - 15) / 3) + Math.sin(t * 0.9) * 0.4;
    if (t < 41) return 70 * (1 - ease((t - 31) / 10));
    return 0;
  }
  function blink(t, t0) { return Math.floor((t - t0) * 2.8) % 2 ? 1 : 2; }
  function sim(ms) {
    var t = (ms / 1000) % L, v = speedAt(t);
    var acc = (speedAt(t + 0.25) - speedAt(t - 0.25)) / 0.5;
    var s = {
      currentTime: Date.now(), phoneBattery: 82, isImperial: state.__demoMetric ? false : true,
      darkMode: state.__demoLight ? false : true, renderQuality: 3, dataSourceType: "demo",
      egoSpeed: Math.round(v), gear: t < 1.5 ? 1 : 4, buckleStatus: 1, anyDoorOpen: 0,
      odometer: 18452 + Math.floor(ms / 60000),
      egoSteeringAngle: Math.sin(t * 0.5) * 3, leftBlinker: 0, rightBlinker: 0,
      leftBlindSpot: 0, rightBlindSpot: 0, changingLane: false,
      adasOn: t > 15 && t < 31.5, accSetSpeed: t > 15 && t < 31.5 ? 70 : 0,
      fusedSpeedLimit: t < 11 || t > 33 ? 45 : 65,
      trafficLightColor: t < 8 ? 2 : t > 46 ? 2 : t > 31 ? 1 : 0,
      stopLineDist: 0,
      nominalEnergyRemaining: 57.9 - t * 0.004, fullPackEnergy: 75, energyBuffer: 3,
      powerLevel: v < 0.5 && acc === 0 ? 0 : acc > 0.05 ? Math.min(100, acc * 9 + v * 0.18) : acc < -0.05 ? Math.max(-100, acc * 14) : v * 0.18,
      maxRegenPower: 78, maxDischargePower: 310, packTMin: 76, packTMax: 81
    };
    if (state.__demoMetric) { s.egoSpeed = Math.round(v * 1.609); s.fusedSpeedLimit = t < 11 || t > 33 ? 70 : 100; s.accSetSpeed = s.accSetSpeed ? 110 : 0; }
    if (t > 19 && t < 25.5) s.leftBlinker = blink(t, 19);
    if (t > 19.5 && t < 22.8) s.leftBlindSpot = t > 21.6 ? 2 : 1;
    if (t > 23 && t < 25.5) { s.changingLane = true; s.egoSteeringAngle = -9 * Math.sin((t - 23) / 2.5 * Math.PI); }
    if (t > 27.5 && t < 30) s.rightBlinker = blink(t, 27.5);
    if (t > 31 && t < 41) s.stopLineDist = Math.max(2, 150 * (1 - ease((t - 31) / 10) * 0.99));
    if (t >= 41 && t < 46) s.stopLineDist = 2;
    // Juniper: DAS_road is static, so no traffic light or stop line comes through
    if (state.__demoJuniper) { s.trafficLightColor = 0; s.stopLineDist = 0; }
    return s;
  }

  var inApp = !!(window.NativeCarState || (window.webkit && window.webkit.messageHandlers));
  var subs = [], last = performance.now();
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    // The demo only runs in a plain browser. Inside DashPilot a lost connection must
    // never turn into a fake drive, so there the dash just holds the last real state.
    if (!inApp && Date.now() - lastLive > 1500) { var s = sim(Date.now()); for (var k in s) state[k] = s[k]; }
    for (var i = 0; i < subs.length; i++) subs[i](state, dt, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.Dash = {
    state: state,
    onFrame: function (fn) { subs.push(fn); },
    // charge = (remaining - buffer) / (full - buffer)
    charge: function (s) {
      var d = s.fullPackEnergy - s.energyBuffer;
      return d > 0 ? Math.max(0, Math.min(100, Math.round((s.nominalEnergyRemaining - s.energyBuffer) / d * 100))) : -1;
    },
    clock: function (s) {
      var d = new Date(s.currentTime || Date.now()), h = d.getHours(), m = d.getMinutes();
      return (s.isImperial ? ((h + 11) % 12 + 1) : (h < 10 ? "0" + h : h)) + ":" + (m < 10 ? "0" + m : m);
    },
    smooth: function (cur, target, dt, rate) { return cur + (target - cur) * (1 - Math.exp(-dt * (rate || 10))); },
    blinkOn: function (v) { return v === 2; },
    setDemo: function (o) { for (var k in o) state["__demo" + k] = o[k]; }
  };
})();
