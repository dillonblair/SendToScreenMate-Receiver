// Each layout at iPhone 14 landscape size, with the notch drawn on both sides, then a contact sheet.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const file = process.argv[2], out = process.argv[3], extra = process.argv[4] || '';
  const lays = [['classic', 'Classic (now)'], ['a', 'A · Top'], ['b', 'B · Beside'], ['c', 'C · Below'], ['d', 'D · Over']];
  const shots = [];
  for (const [k, name] of lays) {
    const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, screen: { width: 844, height: 390 } });
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.addInitScript(`window.webkit = { messageHandlers: { editing: { postMessage(){} } } };`);
    await p.goto('file://' + file + '#lay-' + k + extra);
    await p.evaluate(() => setInterval(() => receiveMessage({ egoSpeed: 72, gear: 4, adasOn: true, accSetSpeed: 75, fusedSpeedLimit: 65, isImperial: true, darkMode: true, renderQuality: 3,
      dataSourceType: 'dashkit', buckleStatus: 1, nominalEnergyRemaining: 57, fullPackEnergy: 75, energyBuffer: 3, phoneBattery: 64, odometer: 18452, currentTime: Date.now(),
      showCarBattery: true, showPhoneBattery: true, showOdometer: true, maxRegenPower: 78, maxDischargePower: 310, powerLevel: 12, leftBlinker: 2, bright: 100 }), 50));
    await p.waitForTimeout(3000);
    // iPhone 13/14 notch in landscape: ~30 px deep, 209 px long, centred; screen corners ~47 px
    await p.evaluate(() => {
      const mk = css => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:99;pointer-events:none;' + css; document.body.appendChild(d); };
      mk('left:0;top:90px;width:31px;height:210px;background:#000;border-radius:0 22px 22px 0;outline:1px dashed rgba(255,80,80,.7)');
      mk('right:0;top:90px;width:31px;height:210px;background:#000;border-radius:22px 0 0 22px;outline:1px dashed rgba(255,80,80,.7)');
      mk('inset:0;border-radius:47px;box-shadow:0 0 0 60px #000');
    });
    const f = `${out}/lay-${k}${extra.replace('#', '-')}.png`;
    await p.screenshot({ path: f }); shots.push([f, name]);
    await p.close();
  }
  const html = `<body style="margin:0;background:#2a2d33;font:600 22px system-ui;color:#eee;display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:18px">` +
    shots.map(([f, n]) => `<div><div style="margin:0 0 8px 6px">${n}</div><img src="file://${f}" style="width:100%;border-radius:28px;display:block"></div>`).join('') + '</body>';
  fs.writeFileSync(out + '/sheet.html', html);
  const p = await b.newPage({ viewport: { width: 1760, height: 1300 } });
  await p.goto('file://' + out + '/sheet.html'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/layouts${extra.replace('#', '-')}.png`, fullPage: true });
  await b.close(); })();
