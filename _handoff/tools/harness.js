// Feed Halo a fixed car state through the iOS path, then screenshot. usage: node harness.js file.html out.png 'json-state' [w h] [settingsJSON]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [,, file, out, stateJson, w, h, settingsJson] = process.argv;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(w || 1140), height: +(h || 540) }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(`window.webkit = { messageHandlers: { editing: { postMessage(){} }, log: { postMessage(){} } } };
    ${settingsJson ? `window.__DASHPILOT_APP_DATA__ = ${JSON.stringify(settingsJson)};` : ''}`);
  await p.goto('file://' + file);
  const st = Object.assign({ egoSpeed: 70, gear: 4, isImperial: true, darkMode: true, renderQuality: 3, dataSourceType: 'dashkit',
    fusedSpeedLimit: 65, nominalEnergyRemaining: 57, fullPackEnergy: 75, energyBuffer: 3, buckleStatus: 1, alwaysOnBlindSpotMonitor: true,
    currentTime: Date.now(), maxRegenPower: 78, maxDischargePower: 310 }, JSON.parse(stateJson));
  await p.evaluate(s => { window.__t = setInterval(() => receiveMessage(Object.assign({}, s, { currentTime: Date.now() })), 40); }, st);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out });
  await b.close();
})();
