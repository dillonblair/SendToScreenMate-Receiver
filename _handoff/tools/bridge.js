const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch();
 const url = 'file://' + process.argv[2];
 // iOS: webkit handlers present, state pushed via receiveMessage
 let p = await b.newPage({ viewport: { width: 844, height: 390 } }); p.on('pageerror', e => console.log('ERR', e.message));
 await p.addInitScript(() => { window.__posted = []; window.webkit = { messageHandlers: { editing: { postMessage: v => __posted.push(['editing', v]) }, log: { postMessage(){} } } }; });
 await p.goto(url); await p.waitForTimeout(2000);
 console.log('iOS before data:', await p.evaluate(() => document.getElementById('v').textContent), '(expect 0, no demo)');
 await p.evaluate(() => receiveMessage({ egoSpeed: 57, gear: 4, isImperial: true, darkMode: true, fusedSpeedLimit: 55, adasOn: true, accSetSpeed: 60, dataSourceType: 'dashkit', leftBlindSpot: 1, alwaysOnBlindSpotMonitor: true, nominalEnergyRemaining: 50, fullPackEnergy: 75, energyBuffer: 3, buckleStatus: 1 }));
 await p.waitForTimeout(300);
 console.log('iOS live:', await p.evaluate(() => [v.textContent, setv.textContent, document.querySelector('.us b') && document.querySelector('.us b').textContent, bat.textContent]));
 await p.waitForTimeout(2500);
 console.log('iOS 2.5s after data stops:', await p.evaluate(() => v.textContent), '(expect 57 held)');
 await p.evaluate(() => receiveMessage({ egoSpeed: 0, gear: 1 }));
 await p.mouse.move(400,200); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up();
 console.log('iOS settings open:', await p.evaluate(() => [!sheet.hidden, JSON.stringify(__posted)]));
 await p.close();
 // Android: NativeCarState getters
 p = await b.newPage({ viewport: { width: 844, height: 390 } }); p.on('pageerror', e => console.log('ERR', e.message));
 await p.addInitScript(() => { const st = { EgoSpeed: 88, Gear: 4, FusedSpeedLimit: 100, AccSetSpeed: 0, DataSourceType: 'dashkit', PowerLevel: -40, CurrentTime: Date.now() };
   window.__saved = null;
   window.NativeCarState = new Proxy({}, { get: (_, k) => {
     if (k === 'getAppData') return () => ''; if (k === 'setAppData') return v => { __saved = v; }; if (k === 'setEditing') return () => {};
     if (k === 'isImperial') return () => false; if (k === 'isDarkMode') return () => false; if (k === 'isAdasOn') return () => false;
     const m = /^get(.+)$/.exec(k); if (m && m[1] in st) return () => st[m[1]]; return undefined; } }); });
 await p.goto(url); await p.evaluate(() => onCarStateUpdate()); await p.waitForTimeout(300);
 console.log('Android live:', await p.evaluate(() => [v.textContent, unit.textContent, document.documentElement.className, !!document.querySelector('.eu')]));
 await p.screenshot({ path: 'shots/android.png' });
 await b.close(); })();
