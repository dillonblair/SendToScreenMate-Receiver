const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
 async function run(label, opts) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.addInitScript(`window.webkit = { messageHandlers: { editing: { postMessage(){} } } };`);
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(800);
  await p.evaluate(sp => receiveMessage({ egoSpeed: sp, gear: sp ? 4 : 1, dataSourceType: 'dashkit', isImperial: true }), opts.speed || 0);
  if (opts.jank) await p.evaluate(() => { (function f(){ const t = performance.now(); while (performance.now() - t < 300); requestAnimationFrame(f); })(); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 600, y: 200 }] });
  await p.waitForTimeout(opts.hold);
  if (!opts.noEnd) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(opts.jank ? 1200 : 300);
  const r = await p.evaluate(() => [!document.getElementById('sheet').hidden, document.getElementById('toast').hidden ? '' : document.getElementById('toast').textContent]);
  console.log(label.padEnd(44), 'sheet open:', r[0], r[1] ? '| notice: ' + r[1] : '');
  await ctx.close(); }
 await run('touch hold 800 ms, parked', { hold: 800 });
 await run('short tap 200 ms (should NOT open)', { hold: 200 });
 await run('hold 800 ms, phone overloaded (300 ms frames)', { hold: 800, jank: true });
 await run('hold 900 ms, touch never ends (native grab)', { hold: 900, noEnd: true });
 await run('hold 800 ms while driving 40 mph', { hold: 800, speed: 40 });
 await b.close(); })();
