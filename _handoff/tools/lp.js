const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1140, height: 540 }, deviceScaleFactor: 2 });
 p.on('pageerror', e => console.log('ERR', e.message));
 await p.goto('file://' + process.argv[2]); await p.waitForTimeout(400);
 await p.mouse.move(500, 300); await p.mouse.down(); await p.waitForTimeout(200); await p.mouse.up();
 console.log('short press open?', await p.evaluate(() => !document.getElementById('sheet').hidden));
 await p.mouse.down(); await p.waitForTimeout(2000); await p.mouse.up();
 console.log('long press open?', await p.evaluate(() => !document.getElementById('sheet').hidden));
 await p.screenshot({ path: 'shots/sheet.png' });
 await p.click('#laneSwitch'); console.log('after switch', await p.evaluate(() => [document.body.className, localStorage.getItem('halo')]));
 await p.click('#sheetDone'); console.log('closed?', await p.evaluate(() => document.getElementById('sheet').hidden));
 await p.reload(); await p.waitForTimeout(300); console.log('reload', await p.evaluate(() => document.body.className));
 // live data driving: opens too (no speed lock)
 await p.evaluate(() => window.receiveMessage({ egoSpeed: 40, dataSourceType: 'dashkit', gear: 4 }));
 await p.mouse.down(); await p.waitForTimeout(2000); await p.mouse.up();
 console.log('open while driving? (expect true)', await p.evaluate(() => !document.getElementById('sheet').hidden));
 await b.close(); })();
