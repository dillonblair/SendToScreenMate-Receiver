/* Halo 3D lane view: a chase-camera scene drawn with three.js (MIT, shipped in this
   folder). Every shape here is built in code: no model files, no textures to license.
   If WebGL isn't available, or the app asks for the lowest render quality, the flat
   SVG lane view stays in place. */
(function () {
  "use strict";
  var viz = document.querySelector(".viz"), cv = document.getElementById("gl");
  if (!viz || !cv || !window.THREE) return;
  var T = window.THREE, renderer;
  try { renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: "low-power" }); }
  catch (e) { return; }
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  var LANE = 3.3, FAR = 95, DASH = 3, PERIOD = 12;
  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(44, 1, 0.1, 200);
  camera.position.set(0, 4.9, 9.6);
  camera.lookAt(0, 0.3, -6);

  // ---- a small studio to reflect in, so the paint and glass read as paint and glass
  (function () {
    var env = new T.Scene(), pm = new T.PMREMGenerator(renderer);
    var room = new T.Mesh(new T.BoxGeometry(30, 14, 30), new T.MeshBasicMaterial({ color: 0x15171b, side: T.BackSide }));
    env.add(room);
    function panel(w, h, x, y, z, rx, ry, c) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
    }
    panel(16, 5, 0, 6.9, 0, Math.PI / 2, 0, 0xffffff);      // softbox overhead
    panel(2, 8, -14.9, 3, 0, 0, Math.PI / 2, 0x9fb4ff);      // cool strip left
    panel(2, 8, 14.9, 3, 0, 0, -Math.PI / 2, 0xffffff);      // strip right
    panel(30, 3, 0, 1, -14.9, 0, 0, 0x30343c);
    scene.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();
  })();

  scene.add(new T.HemisphereLight(0xdfe8ff, 0x101216, 0.6));
  var key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 9, 6); scene.add(key);
  // rim light from ahead, so dark paints keep a readable outline at night
  var rim = new T.DirectionalLight(0xcfe0ff, 1.4); rim.position.set(2, 5, -12); scene.add(rim);

  // ---- textures drawn on a canvas once
  function canvasTex(w, h, draw) {
    var c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    var t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  var radial = canvasTex(128, 128, function (g, w) {
    var r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.45, "rgba(255,255,255,.35)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  var fadeUp = canvasTex(4, 256, function (g, w, h) {
    var l = g.createLinearGradient(0, h, 0, 0);
    l.addColorStop(0, "rgba(255,255,255,.9)"); l.addColorStop(0.5, "rgba(255,255,255,.3)"); l.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = l; g.fillRect(0, 0, w, h);
  });

  // ---- road: strips whose vertices follow the curve every frame
  function strip(x0, x1, z0, z1, segs, mat) {
    var geo = new T.PlaneGeometry(1, 1, 1, segs); geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position, base = [];
    for (var i = 0; i < pos.count; i++) {
      var u = pos.getX(i) + 0.5, v = pos.getZ(i) + 0.5;   // 0..1 across, 0..1 along
      base.push([x0 + (x1 - x0) * u, z1 + (z0 - z1) * v]);
    }
    var m = new T.Mesh(geo, mat); m.userData.base = base; scene.add(m); return m;
  }
  function bendStrip(m, curve, y) {
    var pos = m.geometry.attributes.position, b = m.userData.base;
    for (var i = 0; i < pos.count; i++) pos.setXYZ(i, b[i][0] + curve(b[i][1]), y, b[i][1]);
    pos.needsUpdate = true;
  }
  var roadMat = new T.MeshStandardMaterial({ color: 0x14171c, roughness: 0.92, metalness: 0 });
  var road = strip(-LANE * 1.5 - 1.2, LANE * 1.5 + 1.2, 12, -FAR, 48, roadMat);
  var edgeMat = new T.MeshBasicMaterial({ color: 0x4a4f57, transparent: true, opacity: 0.7 });
  var edgeL = strip(-LANE * 1.5 - 0.08, -LANE * 1.5 + 0.08, 12, -FAR, 48, edgeMat);
  var edgeR = strip(LANE * 1.5 - 0.08, LANE * 1.5 + 0.08, 12, -FAR, 48, edgeMat);
  var pathMat = new T.MeshBasicMaterial({ color: 0x3d7bff, map: fadeUp, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
  var path = strip(-0.95, 0.95, -2.6, -45, 30, pathMat);
  var beamMat = new T.MeshBasicMaterial({ color: 0xffffff, map: fadeUp, transparent: true, opacity: 0.16, depthWrite: false, blending: T.AdditiveBlending });
  var beam = strip(-1.1, 1.1, -2.4, -24, 12, beamMat);

  // lane dashes: one instanced mesh, matrices rewritten each frame
  var NDASH = Math.ceil((FAR + 12) / PERIOD) + 1;
  var dashMat = new T.MeshBasicMaterial({ color: 0x5a6069 });
  var dashes = new T.InstancedMesh(new T.BoxGeometry(0.14, 0.02, DASH), dashMat, NDASH * 2);
  scene.add(dashes);
  var mtx = new T.Matrix4(), q = new T.Quaternion(), scl = new T.Vector3(1, 1, 1), up = new T.Vector3(0, 1, 0);

  // ---- cars (see car3d.js); ours follows the settings, neighbours are generic
  var shadowMat = new T.MeshBasicMaterial({ color: 0x000000, map: radial, transparent: true, opacity: 0.6, depthWrite: false });
  function withShadow(car) {
    var sh = new T.Mesh(new T.PlaneGeometry(2.7, 6), shadowMat); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; car.add(sh); return car;
  }
  var ego = new T.Group(); scene.add(ego);
  var egoCar = null, egoKey = "";
  var tailGlowMat = new T.MeshBasicMaterial({ color: 0xff2a2a, map: radial, transparent: true, opacity: 0.2, depthWrite: false, blending: T.AdditiveBlending });
  var tailGlow = new T.Mesh(new T.PlaneGeometry(3.4, 1.8), tailGlowMat); tailGlow.rotation.x = -Math.PI / 2; tailGlow.position.set(0, 0.02, 2.95); ego.add(tailGlow);
  function setEgo(cfg) {
    var key = cfg.model + cfg.gen;
    if (egoCar && key === egoKey) {                                   // paint-only change: just recolour
      var p = HaloCar.paintById(cfg.paint), m = egoCar.userData.mats.paint;
      m.color.set(p.hex); m.metalness = p.metal; m.roughness = p.rough; return;
    }
    if (egoCar) { ego.remove(egoCar); HaloCar.dispose(egoCar); }
    egoCar = withShadow(HaloCar.build(T, cfg)); egoKey = key; ego.add(egoCar);
  }
  window.HaloCarChanged = function () { lastCfg = ""; };
  var lastCfg = "";

  // neighbours for the blind spots
  function neighbour() {
    var g = new T.Group(), car = withShadow(HaloCar.build(T, { model: "Y", gen: "legacy", paint: "midnight" }));
    var halo = new T.Mesh(new T.PlaneGeometry(3.6, 7), new T.MeshBasicMaterial({ color: 0xff3b30, map: radial, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03;
    g.add(halo); g.add(car); g.userData = { a: 0, halo: halo }; g.visible = false; scene.add(g); return g;
  }
  var others = { L: neighbour(), R: neighbour() };

  // stop line + its glow
  var stopMat = new T.MeshBasicMaterial({ color: 0xff3b30 });
  var stop = new T.Mesh(new T.BoxGeometry(LANE - 0.3, 0.03, 0.45), stopMat); scene.add(stop);
  var stopGlowMat = new T.MeshBasicMaterial({ color: 0xff3b30, map: radial, transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending });
  var stopGlow = new T.Mesh(new T.PlaneGeometry(LANE + 2.5, 3), stopGlowMat); stopGlow.rotation.x = -Math.PI / 2; scene.add(stopGlow);
  var label = document.getElementById("gllabel");

  viz.classList.add("gl");
  var TL = [0, 0xff3b30, 0x2fcb6a, 0xffb020];
  var steer = 0, scroll = 0, ap = 0, pw = 0, day = null, w = 0, h = 0, v3 = new T.Vector3();

  Dash.onFrame(function (s, dt, now) {
    var on = s.renderQuality !== 1;
    viz.classList.toggle("gl", on);
    if (!on || !viz.offsetParent) return;          // lane view hidden or low quality: draw nothing

    var cw = cv.clientWidth, ch = cv.clientHeight;
    if (cw !== w || ch !== h) { w = cw; h = ch; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); }

    if (day !== !s.darkMode) {
      day = !s.darkMode;
      var bg = new T.Color(getComputedStyle(document.documentElement).getPropertyValue("--bg").trim());
      scene.fog = new T.Fog(bg, 30, FAR - 5);
      roadMat.color.set(day ? 0xdfe2e7 : 0x14171c);
      edgeMat.color.set(day ? 0xa3a9b2 : 0x4a4f57);
      beam.visible = !day;
      shadowMat.opacity = day ? 0.28 : 0.6;
      // added light vanishes on a light background, so glows blend normally by day
      [pathMat, tailGlowMat, stopGlowMat, others.L.userData.halo.material, others.R.userData.halo.material].forEach(function (m) {
        m.blending = day ? T.NormalBlending : T.AdditiveBlending; m.needsUpdate = true;
      });
    }

    steer = Dash.smooth(steer, s.egoSteeringAngle, dt, 4);
    ap = Dash.smooth(ap, s.adasOn ? 1 : 0, dt, 4);
    pw = Dash.smooth(pw, s.powerLevel, dt, 6);
    var c = Math.max(-15, Math.min(15, steer)) * 0.00009;
    function curve(z) { return z < 0 ? c * z * z : 0; }

    bendStrip(road, curve, 0); bendStrip(edgeL, curve, 0.012); bendStrip(edgeR, curve, 0.012);
    bendStrip(path, curve, 0.015); bendStrip(beam, curve, 0.016);
    pathMat.opacity = (day ? 0.3 : 0.55) * ap;

    // dashes scroll at road speed (US 10 ft dash, 30 ft gap is about 3 m / 9 m)
    var mps = s.isImperial ? s.egoSpeed * 0.447 : s.egoSpeed / 3.6;
    scroll = (scroll + mps * dt) % PERIOD;
    dashMat.color.set(s.adasOn ? 0x3d7bff : (day ? 0x8e949c : 0x5a6069));
    var k = 0;
    [-LANE / 2, LANE / 2].forEach(function (x) {
      for (var i = 0; i < NDASH; i++) {
        var z = 12 - i * PERIOD + scroll;
        var ang = Math.atan(2 * c * Math.min(0, z));   // follow the curve's heading
        q.setFromAxisAngle(up, ang);
        mtx.compose(v3.set(x + curve(z), 0.02, z), q, scl);
        dashes.setMatrixAt(k++, mtx);
      }
    });
    dashes.instanceMatrix.needsUpdate = true;

    // our car follows the settings (and the car itself, if DashPilot ever shares it)
    var cfg = HaloCar.resolve(window.HaloSettings || {}, s), ck = cfg.model + cfg.gen + cfg.paint;
    if (ck !== lastCfg) { lastCfg = ck; setEgo(cfg); }

    // brake lamps glow under strong regen
    var brake = Math.min(1, Math.max(0, -pw - 15) / 30);
    egoCar.userData.mats.tail.emissiveIntensity = 0.9 + 1.8 * brake; tailGlowMat.opacity = 0.12 + 0.6 * brake;

    // neighbours slide up from behind into the blind spot
    var showBs = s.alwaysOnBlindSpotMonitor || s.leftBlinker || s.rightBlinker || s.dataSourceType === "demo";
    [["L", s.leftBlindSpot, -LANE], ["R", s.rightBlindSpot, LANE]].forEach(function (o) {
      var g = others[o[0]], d = g.userData;
      d.a = Dash.smooth(d.a, showBs && o[1] ? 1 : 0, dt, 5);
      g.visible = d.a > 0.01;
      var z = 8 - 8.6 * d.a;
      g.position.set(o[2] + curve(z), 0, z);
      d.halo.material.opacity = d.a * (o[1] === 2 ? 0.55 + 0.35 * Math.sin(now * 20) : 0.7);
    });

    // stop line ahead for a light we know about (legacy cars)
    var tl = (window.HaloSettings || {}).stopLine === false ? 0 : s.trafficLightColor, show = tl > 0 && s.stopLineDist > 0;
    stop.visible = stopGlow.visible = show;
    if (show) {
      var sz = -(4 + Math.min(150, s.stopLineDist) / 150 * 34);
      stop.position.set(curve(sz), 0.02, sz); stopGlow.position.set(curve(sz), 0.025, sz);
      stopMat.color.setHex(TL[tl]); stopGlowMat.color.setHex(TL[tl]);
      v3.set(curve(sz), 0.9, sz).project(camera);
      label.hidden = false;
      label.style.left = ((v3.x + 1) / 2 * 100) + "%"; label.style.top = ((1 - v3.y) / 2 * 100) + "%";
      label.textContent = s.isImperial ? Math.round(s.stopLineDist * 3.281) + " ft" : Math.round(s.stopLineDist) + " m";
    } else label.hidden = true;

    renderer.render(scene, camera);
  });
})();
