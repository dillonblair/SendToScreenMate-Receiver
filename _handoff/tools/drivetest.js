// Drive features end to end through the iOS path: 0-60 timer, Autopilot-off drain,
// green-light nudge, trip card + weekly totals saved to appData, screensaver after a
// minute in Park and wake on touch. Takes ~90 s. usage: node drives.js /abs/index.html [outdir]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const file = process.argv[2], out = process.argv[3] || '.';
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1140, height: 540 }, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(`window.__saved = []; window.__DASHPILOT_APP_DATA__ = '{"launch":true,"bright":"100"}';
    window.webkit = { messageHandlers: { editing: { postMessage(){} }, appData: { postMessage(v){ __saved.push(v); } } } };`);
  await p.goto('file://' + file); await p.waitForTimeout(800);
  await p.evaluate(() => {
    window.__s = { egoSpeed: 0, gear: 4, isImperial: true, darkMode: true, renderQuality: 3, dataSourceType: 'dashkit', buckleStatus: 1,
      nominalEnergyRemaining: 57, fullPackEnergy: 75, energyBuffer: 3, maxRegenPower: 78, maxDischargePower: 310, packVoltage: 380, packCurrent: 0,
      odometer: 18452, showCarBattery: true, adasOn: false, trafficLightColor: 0 };
    setInterval(() => receiveMessage(Object.assign({}, __s, { currentTime: Date.now() })), 50);
  });
  const set = o => p.evaluate(o => Object.assign(__s, o), o);
  const ok = (name, cond, extra) => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''));
  const ringPx = (fx = 0.5) => p.evaluate(fx => {   // average colour of the ring's top edge around x = fx * width
    const c = document.getElementById('c'), d = c.getContext('2d').getImageData(c.width * fx - 40, 0, 80, c.height * 0.06).data;
    let r = 0, g = 0, bl = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; }
    const n = d.length / 4; return [r / n, g / n, bl / n].map(Math.round);
  }, fx);

  await p.waitForTimeout(1000);
  // launch: 0 -> 66 mph in 6.6 s, 60 mph at 6.0 s (v = 10 t)
  const t0 = Date.now();
  while (Date.now() - t0 < 6600) { await set({ egoSpeed: Math.round((Date.now() - t0) / 100), packCurrent: 300 }); await p.waitForTimeout(40); }
  await set({ egoSpeed: 66, packCurrent: 50, adasOn: true });
  await p.waitForTimeout(6000);
  const apOn = await ringPx();
  await set({ adasOn: false });
  await p.waitForTimeout(450);   // headless frames lag the feed; the top is empty by ~0.3 s into the drain
  const draining = await ringPx();
  await p.screenshot({ path: out + '/drain.png' });
  await p.waitForTimeout(1500);
  const drained = await ringPx();
  ok('Autopilot-off drain: ring top blue, empties first', apOn[2] > 90 && draining[2] < apOn[2] - 30 && drained[2] < 60, JSON.stringify([apOn, draining, drained]));

  // brake to a red light (regen), stop, green, stay put
  for (let v = 66; v >= 0; v -= 6) { await set({ egoSpeed: v, packCurrent: -120, trafficLightColor: 1 }); await p.waitForTimeout(150); }
  await set({ egoSpeed: 0, packCurrent: 0 });
  await p.waitForTimeout(1200);
  await set({ trafficLightColor: 2 });
  await p.waitForTimeout(1200);
  const before = await ringPx(0.3);
  await p.waitForTimeout(1500);
  const nudge = await ringPx(0.3);
  await p.screenshot({ path: out + '/nudge.png' });
  ok('green-light nudge after 2 s stopped on green', nudge[1] > before[1] + 40 && nudge[1] > nudge[0] + 40, JSON.stringify([before, nudge]));

  await set({ gear: 1 });
  await p.waitForTimeout(1200);
  const card = await p.evaluate(() => [!document.getElementById('trip').hidden, document.getElementById('tripBody').innerText.replace(/\s+/g, ' ')]);
  await p.screenshot({ path: out + '/card.png' });
  ok('trip card on Park', card[0], card[1]);
  ok('0-60 timed about 6.0 s', /0–60 mph (5\.[7-9]|6\.[0-3]) s/.test(card[1]));
  const saved = await p.evaluate(() => JSON.parse(__saved[__saved.length - 1] || '{}'));
  ok('drive saved to appData with week totals', saved.lastDrive && saved.week && saved.week.drives === 1 && saved.bestLaunch && saved.bestLaunch.mph > 0,
    JSON.stringify({ km: saved.lastDrive && saved.lastDrive.km.toFixed(3), kwh: saved.lastDrive && saved.lastDrive.kwh.toFixed(3), regen: saved.lastDrive && saved.lastDrive.regen.toFixed(3), week: saved.week }));

  // Drives tab
  await p.evaluate(() => { document.getElementById('trip').click(); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 300 }] });
  await p.waitForTimeout(1500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.click('#tabs [data-tab=panelDrv]');
  await p.waitForTimeout(800);
  await p.screenshot({ path: out + '/drives-tab.png' });
  const tab = await p.evaluate(() => document.getElementById('drvBody').innerText.replace(/\s+/g, ' '));
  ok('Drives tab shows last drive + week', /Last drive/i.test(tab) && /This week/i.test(tab), tab);
  await p.click('#sheetDone');

  // screensaver after a quiet minute in Park, woken by a touch
  await p.waitForTimeout(62000);
  const sv = await p.evaluate(() => [!document.getElementById('saver').hidden, HaloDrives.saver, document.body.className, document.getElementById('saverClock').textContent]);
  await p.screenshot({ path: out + '/saver.png' });
  ok('screensaver after 60 s parked', sv[0] && sv[1] && /saved/.test(sv[2]), JSON.stringify(sv));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 300 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(1800);
  const woke = await p.evaluate(() => [document.getElementById('saver').hidden, HaloDrives.saver, document.body.className]);
  ok('touch wakes it', woke[0] && !woke[1] && !/sav/.test(woke[2]), JSON.stringify(woke));
  await set({ gear: 4 });
  await p.waitForTimeout(500);
  ok('card gone once out of Park', await p.evaluate(() => document.getElementById('trip').hidden));
  await b.close();
})();
