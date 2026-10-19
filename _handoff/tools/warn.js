// Drive speed past a 65 limit under different settings and read back the speed's warning class + ring
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch(); 
 async function run(settings, imperial, speeds) {
  const p = await b.newPage({ viewport: { width: 1140, height: 540 } }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(`window.webkit = { messageHandlers: { editing: { postMessage(){} } } }; window.__DASHPILOT_APP_DATA__ = ${JSON.stringify(JSON.stringify(settings))};`);
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(300);
  const out = [];
  for (const v of speeds) {
   await p.evaluate(([v, imp]) => receiveMessage({ egoSpeed: v, fusedSpeedLimit: imp ? 65 : 100, isImperial: imp, gear: 4, dataSourceType: 'dashkit' }), [v, imperial]);
   await p.waitForTimeout(120);
   out.push(v + ':' + (await p.evaluate(() => { const c = document.getElementById('spd').classList; return c.contains('over2') ? 'ORANGE' : c.contains('over') ? 'amber' : 'white'; })));
  }
  console.log(JSON.stringify(settings).padEnd(34), imperial ? 'mph ' : 'km/h', out.join('  '));
  await p.close(); }
 await run({}, true, [60, 65, 68, 69, 67.5, 66, 75, 79, 77, 70]);
 await run({ warnOver: '0' }, true, [64, 65, 66, 76]);
 await run({ warnOver: '3' }, true, [70, 75, 76, 86]);
 await run({ warn: 'off' }, true, [70, 90]);
 await run({ warnOver: '2' }, false, [105, 110, 111, 126]);
 await b.close(); })();
