/* Halo's car, built in code with three.js: a lofted body made from ~90 cross-sections,
   real wheel arches, multi-spoke rims, tyres, discs and calipers, mirrors, flush handles,
   plate and per-generation lamps. Proportions follow published Model 3 / Model Y
   dimensions; the shapes themselves are my own drawing. No model files, no textures. */
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
  // GTW_exteriorColor values from the legacy vehicle DBC
  var GTW_PAINT = { 0: "redmc", 1: "solidblack", 2: "silver", 3: "midnight", 5: "deepblue", 6: "pearl" };
  var VIN_YEAR = { H: 2017, J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026, V: 2027 };

  // metres; t runs 0 (rear) to 1 (nose)
  var SPECS = {
    "3": { L: 4.72, W: 1.85, H: 1.44, wb: 2.875, track: 1.58, clear: 0.14, belt: 0.95, tR: 0.335, tW: 0.235,
      rearGlass: 0.17, peak: 0.47, wsBase: 0.655, hoodNose: 0.68, deck: 0.93, rearTop: 0.9, roofW: 0.7, hatch: 1.0 },
    "Y": { L: 4.75, W: 1.92, H: 1.62, wb: 2.89, track: 1.64, clear: 0.17, belt: 1.06, tR: 0.355, tW: 0.255,
      rearGlass: 0.075, peak: 0.45, wsBase: 0.655, hoodNose: 0.76, deck: 1.07, rearTop: 1.02, roofW: 0.7, hatch: 0.55 }
  };

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sstep(a, b, x) { x = clamp01((x - a) / (b - a)); return x * x * (3 - 2 * x); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function shapeFns(S) {
    var L = S.L, hw = S.W / 2;
    function zOf(t) { return (0.5 - t) * L; }                 // rear at +z, nose toward -z
    function plan(t) { var u = Math.abs(2 * t - 1); return Math.pow(Math.max(0, 1 - Math.pow(u, 5)), 1 / 5); }
    function halfW(t) {
      var hips = 1 + 0.022 * Math.exp(-Math.pow((t - 0.2) / 0.08, 2)) + 0.012 * Math.exp(-Math.pow((t - 0.8) / 0.07, 2));
      return hw * plan(t) * hips;
    }
    function bottom(t) { return S.clear + 0.05 + 0.22 * (1 - sstep(0, 0.15, t)) + 0.16 * sstep(0.84, 1, t); }
    function belt(t) { return S.belt + 0.035 * (1 - sstep(0.1, 0.55, t)) - (S.belt - S.hoodNose - 0.02) * Math.pow(sstep(0.7, 1, t), 1.3); }
    function top(t) {
      var rg = S.rearGlass, pk = S.peak, ws = S.wsBase, hoodRoot = belt(ws) + 0.03;
      if (t <= rg) return lerp(S.rearTop, S.deck, sstep(0, rg, t));
      if (t <= pk) return S.deck + (S.H - S.deck) * Math.pow(Math.sin((t - rg) / (pk - rg) * Math.PI / 2), S.hatch);
      if (t <= ws) return S.H - (S.H - hoodRoot) * Math.pow((t - pk) / (ws - pk), 1.7);
      return lerp(hoodRoot, S.hoodNose, Math.pow(sstep(ws, 1, t), 0.9));
    }
    function arch(t) {
      var z = zOf(t), best = -1, R = S.tR + 0.075;
      [S.wb / 2, -S.wb / 2].forEach(function (za) {
        var dz = z - za; if (Math.abs(dz) < R) best = Math.max(best, S.tR + Math.sqrt(R * R - dz * dz));
      });
      return best;
    }
    return { zOf: zOf, halfW: halfW, bottom: bottom, belt: belt, top: top, arch: arch };
  }

  // right half of one cross-section, bottom centre to top centre
  function section(F, S, t) {
    var w = F.halfW(t), yb = F.bottom(t), yt = F.top(t), ybl = Math.min(F.belt(t), yt - 0.005);
    var a = F.arch(t), wellX = Math.min(w * 0.9, S.track / 2 - S.tW / 2 - 0.05);
    var ylo = a > 0 ? Math.max(yb, Math.min(a, ybl - 0.1)) : yb;
    var g = Math.min(sstep(S.rearGlass, S.rearGlass + 0.07, t), 1 - sstep(S.wsBase - 0.05, S.wsBase, t));
    var wr = w * lerp(0.88, S.roofW, g);
    return {
      glass: t > S.rearGlass && t < S.wsBase,
      pts: [
        [0, yb], [wellX, yb], [wellX, ylo], [w * 0.94, ylo], [w * 0.99, ylo + 0.06],
        [w, lerp(ylo, ybl, 0.45)], [w * 0.99, ybl - 0.05], [w * 0.955, ybl],
        [lerp(w * 0.955, wr, 0.55), lerp(ybl, yt, 0.55)], [wr, yt - 0.06 * g - 0.008],
        [wr * 0.82, yt - 0.012 * g], [wr * 0.42, yt + 0.006 * (1 - g)], [0, yt + 0.01 * (1 - g)]
      ]
    };
  }
  var GLASS_FROM = 7;   // section points from the shoulder up are glass inside the greenhouse

  function buildBody(S, F, paintMat, glassMat) {
    var NS = 96, rings = [], J, M;
    for (var k = 0; k <= NS; k++) {
      var t = 0.5 - 0.5 * Math.cos(Math.PI * k / NS);     // denser stations at nose and tail
      var sec = section(F, S, t); rings.push({ z: F.zOf(t), pts: sec.pts, glass: sec.glass });
    }
    J = rings[0].pts.length; M = 2 * J - 2;               // full ring: right side up, left side down
    var pos = new Float32Array((NS + 1) * M * 3), p = 0;
    function jOf(m) { return m < J ? m : 2 * J - 2 - m; }
    for (k = 0; k <= NS; k++) for (var m = 0; m < M; m++) {
      var pt = rings[k].pts[jOf(m)];
      pos[p++] = m < J ? pt[0] : -pt[0]; pos[p++] = pt[1]; pos[p++] = rings[k].z;
    }
    var paintIdx = [], glassIdx = [];
    for (k = 0; k < NS; k++) for (m = 0; m < M; m++) {
      var m2 = (m + 1) % M, a = k * M + m, b = k * M + m2, c = (k + 1) * M + m, d = (k + 1) * M + m2;
      var isGlass = rings[k].glass && rings[k + 1].glass && jOf(m) >= GLASS_FROM && jOf(m2) >= GLASS_FROM;
      (isGlass ? glassIdx : paintIdx).push(a, c, b, b, c, d);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setIndex(paintIdx.concat(glassIdx));
    geo.addGroup(0, paintIdx.length, 0); geo.addGroup(paintIdx.length, glassIdx.length, 1);
    geo.computeVertexNormals();
    return new T.Mesh(geo, [paintMat, glassMat]);
  }

  // where the body surface sits along z at half-width x, near the tail (rear) or nose
  function endZ(F, x, rear) {
    var lo = rear ? 0 : 0.5, hi = rear ? 0.5 : 1;
    for (var i = 0; i < 30; i++) {
      var mid = (lo + hi) / 2, w = F.halfW(mid);
      if (rear ? w < x : w > x) lo = mid; else hi = mid;   // tail: width grows with t; nose: shrinks
    }
    return F.zOf((lo + hi) / 2);
  }
  function lampCurve(F, x0, x1, y, rear, out, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var x = lerp(x0, x1, i / n);
      pts.push(new T.Vector3(x, y, endZ(F, Math.abs(x), rear) + (rear ? out : -out)));
    }
    return new T.CatmullRomCurve3(pts);
  }
  function tube(curve, r, mat) { return new T.Mesh(new T.TubeGeometry(curve, 48, r, 8, false), mat); }

  function buildWheel(S, mats, spokes) {
    var g = new T.Group(), R = S.tR, Wd = S.tW, rr = R * 0.66;
    // tyre: rounded section turned on a lathe
    var prof = [], c = 0.045;
    prof.push(new T.Vector2(rr + 0.01, -Wd / 2 + 0.01), new T.Vector2(R - c, -Wd / 2));
    for (var i = 1; i < 6; i++) { var a = -Math.PI / 2 + i / 6 * Math.PI / 2; prof.push(new T.Vector2(R - c + Math.cos(a) * c, -Wd / 2 + c + Math.sin(a) * c)); }
    for (i = 0; i <= 6; i++) { a = i / 6 * Math.PI / 2; prof.push(new T.Vector2(R - c + Math.cos(a) * c, Wd / 2 - c + Math.sin(a) * c)); }
    prof.push(new T.Vector2(rr + 0.01, Wd / 2 - 0.01));
    var tyre = new T.LatheGeometry(prof, 40); tyre.rotateZ(Math.PI / 2);
    g.add(new T.Mesh(tyre, mats.tyre));
    // rim face: a disc with the spaces between spokes cut out
    var face = new T.Shape(); face.absarc(0, 0, rr, 0, Math.PI * 2, false);
    var spokeW = 0.32 * (2 * Math.PI / spokes);
    for (i = 0; i < spokes; i++) {
      var a0 = i * 2 * Math.PI / spokes + spokeW / 2, a1 = (i + 1) * 2 * Math.PI / spokes - spokeW / 2, hole = new T.Path();
      hole.absarc(0, 0, rr * 0.86, a0, a1, false); hole.absarc(0, 0, rr * 0.3, a1, a0, true); hole.closePath();
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
      paint: new T.MeshPhysicalMaterial({ color: paint.hex, metalness: paint.metal, roughness: paint.rough, clearcoat: 1, clearcoatRoughness: 0.05 }),
      glass: new T.MeshPhysicalMaterial({ color: 0x080b10, metalness: 0.4, roughness: 0.05, clearcoat: 1, envMapIntensity: 0.9 }),
      trim: new T.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.45, metalness: 0.2 }),
      tyre: new T.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.85 }),
      rim: new T.MeshPhysicalMaterial({ color: 0x2f3237, metalness: 0.9, roughness: 0.3, clearcoat: 0.6 }),
      barrel: new T.MeshStandardMaterial({ color: 0x1a1b1e, metalness: 0.6, roughness: 0.5, side: T.DoubleSide }),
      disc: new T.MeshStandardMaterial({ color: 0x6b6e73, metalness: 0.9, roughness: 0.35 }),
      caliper: new T.MeshStandardMaterial({ color: 0x24262a, metalness: 0.3, roughness: 0.5 }),
      tail: new T.MeshStandardMaterial({ color: 0x400000, emissive: 0xff0808, emissiveIntensity: 0.9, roughness: 0.3 }),
      housing: new T.MeshPhysicalMaterial({ color: 0x2a0306, metalness: 0.2, roughness: 0.1, clearcoat: 1 }),
      head: new T.MeshStandardMaterial({ color: 0x777777, emissive: 0xffffff, emissiveIntensity: 1.6 }),
      plate: new T.MeshStandardMaterial({ color: 0xdedfe0, roughness: 0.6 })
    };
  }

  function build(three, cfg) {
    T = three;
    var S = SPECS[cfg.model] || SPECS["3"], F = shapeFns(S), refresh = cfg.gen === "refresh";
    var paint = PAINTS.filter(function (p) { return p.id === cfg.paint; })[0] || PAINTS[0];
    var mats = materials(paint), car = new T.Group(), wMax = S.W / 2;

    car.add(buildBody(S, F, mats.paint, mats.glass));

    // wheels: rims face outward on both sides
    var spokes = cfg.model === "Y" ? 10 : 5;
    [[1, S.wb / 2], [1, -S.wb / 2], [-1, S.wb / 2], [-1, -S.wb / 2]].forEach(function (wp) {
      var wh = buildWheel(S, mats, spokes);
      wh.position.set(wp[0] * S.track / 2, S.tR, wp[1]);
      if (wp[0] < 0) wh.rotation.y = Math.PI;
      car.add(wh);
    });

    // tail lamps, per generation
    var yTail = cfg.model === "Y" ? S.rearTop - 0.08 : S.rearTop - 0.06;
    if (refresh && cfg.model === "Y") {                                  // Juniper: full-width light bar
      car.add(tube(lampCurve(F, -wMax * 0.97, wMax * 0.97, yTail + 0.02, true, 0.012, 24), 0.014, mats.tail));
      [-1, 1].forEach(function (s) { car.add(tube(lampCurve(F, s * wMax * 0.62, s * wMax * 0.97, yTail - 0.07, true, 0.012, 10), 0.02, mats.housing)); });
    } else if (refresh) {                                               // Highland: slim C-shaped lamps
      [-1, 1].forEach(function (s) {
        car.add(tube(lampCurve(F, s * wMax * 0.55, s * wMax * 0.98, yTail, true, 0.012, 12), 0.012, mats.tail));
        car.add(tube(lampCurve(F, s * wMax * 0.68, s * wMax * 0.98, yTail - 0.08, true, 0.012, 12), 0.012, mats.tail));
      });
    } else {                                                            // legacy: wrap-around lamp units
      [-1, 1].forEach(function (s) {
        car.add(tube(lampCurve(F, s * wMax * 0.45, s * wMax * 0.985, yTail - 0.035, true, 0.0, 12), 0.045, mats.housing));
        car.add(tube(lampCurve(F, s * wMax * 0.5, s * wMax * 0.98, yTail - 0.012, true, 0.04, 12), 0.014, mats.tail));
        car.add(tube(lampCurve(F, s * wMax * 0.6, s * wMax * 0.975, yTail - 0.058, true, 0.04, 12), 0.011, mats.tail));
      });
    }
    // head lamps
    var yHead = S.hoodNose - 0.07;
    if (refresh && cfg.model === "Y") car.add(tube(lampCurve(F, -wMax * 0.9, wMax * 0.9, yHead + 0.03, false, 0.01, 24), 0.01, mats.head));
    [-1, 1].forEach(function (s) { car.add(tube(lampCurve(F, s * wMax * 0.55, s * wMax * 0.94, yHead, false, 0.01, 10), refresh ? 0.012 : 0.028, mats.head)); });

    // mirrors
    var tm = S.wsBase - 0.035, zm = F.zOf(tm), xm = F.halfW(tm) * 0.955, ym = F.belt(tm) + 0.06;
    [-1, 1].forEach(function (s) {
      var shell = new T.Mesh(new T.SphereGeometry(1, 20, 12), mats.paint); shell.scale.set(0.09, 0.065, 0.13);
      shell.position.set(s * (xm + 0.11), ym + 0.02, zm + 0.02); car.add(shell);
      var arm = new T.Mesh(new T.BoxGeometry(0.1, 0.03, 0.05), mats.trim); arm.position.set(s * (xm + 0.04), ym, zm + 0.05); car.add(arm);
    });
    // flush door handles
    [0.42, 0.6].forEach(function (t) {
      [-1, 1].forEach(function (s) {
        var h = new T.Mesh(new T.BoxGeometry(0.012, 0.022, 0.13), mats.trim);
        h.position.set(s * (F.halfW(t) * 0.99 + 0.004), F.belt(t) - 0.08, F.zOf(t)); car.add(h);
      });
    });
    // plate and diffuser
    var plate = new T.Mesh(new T.BoxGeometry(0.31, 0.155, 0.012), mats.plate);
    plate.position.set(0, cfg.model === "Y" ? 0.72 : 0.66, endZ(F, 0.16, true) + 0.01); car.add(plate);
    var diff = new T.Mesh(new T.BoxGeometry(1.3, 0.1, 0.3), mats.trim);
    diff.position.set(0, F.bottom(0.06) + 0.03, S.L / 2 - 0.2); car.add(diff);

    car.userData = { mats: mats, spec: S };
    return car;
  }

  function dispose(obj) {
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(function (m) { m.dispose(); });
    });
  }

  // settings + whatever the car tells us -> a concrete car
  function resolve(settings, state) {
    var vin = typeof state.vin === "string" && state.vin.length === 17 ? state.vin.toUpperCase() : "";
    var vModel = vin ? vin[3] : "", year = vin ? VIN_YEAR[vin[9]] : 0;
    var det = {
      model: vModel === "3" || vModel === "Y" ? vModel : "",
      year: year || 0,
      paint: GTW_PAINT[state.exteriorColor] || ""
    };
    if (det.model && year) det.gen = (det.model === "3" && year >= 2024) || (det.model === "Y" && year >= 2025) ? "refresh" : "legacy";
    var model = settings.car && settings.car !== "auto" ? settings.car : det.model || "3";
    var gen = settings.gen && settings.gen !== "auto" ? settings.gen : det.gen || "legacy";
    var paint = settings.paint && settings.paint !== "auto" ? settings.paint : det.paint || "pearl";
    return { model: model, gen: gen, paint: paint, detected: det };
  }

  return { PAINTS: PAINTS, build: build, dispose: dispose, resolve: resolve,
    paintById: function (id) { return PAINTS.filter(function (p) { return p.id === id; })[0] || PAINTS[0]; } };
})();
