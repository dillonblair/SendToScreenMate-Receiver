// Brightness: tab layout, fixed levels, Auto by time, Auto by dark mode, hazards stay full.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = process.argv[3];
  async function run(label, settings, st, shot, clockAt) {
    const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.addInitScript(`window.webkit = { messageHandlers: { editing: { postMessage(){} } } }; window.__DASHPILOT_APP_DATA__ = ${JSON.stringify(JSON.stringify(settings))};`);
    await p.goto('file://' + process.argv[2]);
    await p.evaluate(([st, at]) => setInterval(() => receiveMessage(Object.assign({ egoSpeed: 0, gear: 4, isImperial: true, darkMode: true, renderQuality: 3,
      dataSourceType: 'dashkit', buckleStatus: 1, currentTime: at || Date.now() }, st)), 50), [st, clockAt]);
    await p.waitForTimeout(2500);
    const bk = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bk').trim() || '1');
    const ring = await p.evaluate(() => { const c = document.getElementById('c'), d = c.getContext('2d').getImageData(c.width * 0.3 - 20, 0, 40, c.height * 0.06).data;
      let m = 0; for (let i = 0; i < d.length; i += 4) m += (d[i] + d[i + 1] + d[i + 2]) * d[i + 3] / 255; return Math.round(m / (d.length / 4)); });
    console.log(label.padEnd(46), '--bk', bk.padEnd(5), 'ring mean', ring);
    if (shot) {
      await p.evaluate(() => { document.getElementById('sheet').hidden = false; });
      await p.click('#tabs [data-tab=panelBri]'); await p.waitForTimeout(1500);
      await p.screenshot({ path: out + '/' + shot });
    }
    await p.close();
  }
  const d = new Date(); const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 13, 0).getTime(), mid = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 30).getTime();
  await run('fixed 100, Autopilot on', { bright: '100' }, { adasOn: true });
  await run('fixed 40, Autopilot on', { bright: '40' }, { adasOn: true });
  await run('auto by sun, 1 pm, AP on', {}, { adasOn: true }, 'bri-tab.png', noon);
  await run('auto by sun, 11:30 pm, AP on (night 60)', {}, { adasOn: true }, null, mid);
  await run('auto by sun, 11:30 pm, night 25', { nightLevel: '25' }, { adasOn: true }, null, mid);
  await run('auto by dark mode, dark on', { nightBy: 'dark' }, { adasOn: true }, null, noon);
  await run('auto by dark mode, dark off', { nightBy: 'dark' }, { adasOn: true, darkMode: false }, null, noon);
  await run('fixed 40, right blind spot: red stays full', { bright: '40' }, { leftBlinker: 2, leftBlindSpot: 1, alwaysOnBlindSpotMonitor: true });
  await run('fixed 100, right blind spot', { bright: '100' }, { leftBlinker: 2, leftBlindSpot: 1, alwaysOnBlindSpotMonitor: true });
  await run('fixed 40 night, sheet shot', { bright: '40', nightBy: 'dark' }, {}, 'bri-tab-fixed.png', mid);
  await b.close(); })();
