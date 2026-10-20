// iPhone landscape with a notch: emulate safe-area insets by overriding --sx, plus the
// fallback path (iOS app, tall screen, no inset reported).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = process.argv[3];
  async function run(label, init, shot) {
    const p = await b.newPage({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, screen: { width: 852, height: 393 } });
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.addInitScript(`window.webkit = { messageHandlers: { editing: { postMessage(){} } } }; ${init}`);
    await p.goto('file://' + process.argv[2]);
    await p.evaluate(() => setInterval(() => receiveMessage({ egoSpeed: 72, gear: 4, adasOn: true, accSetSpeed: 75, fusedSpeedLimit: 65, isImperial: true, darkMode: true, renderQuality: 3,
      dataSourceType: 'dashkit', buckleStatus: 1, nominalEnergyRemaining: 57, fullPackEnergy: 75, energyBuffer: 3, phoneBattery: 64, odometer: 18452, currentTime: Date.now(),
      showCarBattery: true, showPhoneBattery: true, showOdometer: true, maxRegenPower: 78, maxDischargePower: 310, powerLevel: 12 }), 50));
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const box = id => { const e = document.getElementById(id).getBoundingClientRect(); return [Math.round(e.left), Math.round(e.right)]; };
      return { sx: getComputedStyle(document.documentElement).getPropertyValue('--sx').trim(), gears: box('gears'), batt: box('battWrap'), clock: box('clk'), odo: box('odoWrap'), ap: box('ap'), w: innerWidth };
    });
    console.log(label.padEnd(36), JSON.stringify(r));
    await p.screenshot({ path: out + '/' + shot });
    // settings while moving
    await p.mouse.move(400, 200); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
    await p.waitForTimeout(500);
    console.log('  settings open at 72 mph:', await p.evaluate(() => !document.getElementById('sheet').hidden));
    await p.screenshot({ path: out + '/sheet-' + shot });
    await p.close();
  }
  await run('fallback (no inset reported)', '', 'notch-fallback.png');
  await run('reported inset 59px', 'document.addEventListener("DOMContentLoaded", () => document.documentElement.style.setProperty("--sx", "59px"));', 'notch-59.png');
  await b.close(); })();
