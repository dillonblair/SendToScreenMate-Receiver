// URL-loaded app: Android bridge whose appData is a no-op, and iOS with no appData handler.
// Settings must survive a reload through localStorage. Serve the folder first:
// python3 -m http.server 8765 --bind 127.0.0.1   then: node persist.js
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch();
  for (const [label, init] of [
    ['Android, URL app (setAppData drops data)', `window.NativeCarState = new Proxy({ getAppData: () => "", setAppData: () => {}, setEditing: () => {}, isImperial: () => true, isDarkMode: () => true, getGear: () => 1, getDataSourceType: () => "dashkit" }, { get: (t, k) => k in t ? t[k] : () => 0 });`],
    ['iOS, URL app (no appData handler)', `window.webkit = { messageHandlers: { editing: { postMessage(){} } } };`]]) {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.addInitScript(init);
    await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(800);
    await p.evaluate(() => { HaloSettings.bright = '40'; HaloSettings.week = { start: 1, km: 5, kwh: 1, drives: 1 }; HaloSave(); });
    await p.reload(); await p.waitForTimeout(800);
    const r = await p.evaluate(() => [HaloSettings.bright, getComputedStyle(document.documentElement).getPropertyValue('--bk').trim()]);
    console.log(label.padEnd(44), 'after reload:', JSON.stringify(r), r[0] === '40' ? 'PASS' : 'FAIL');
    await ctx.close();
  }
  await b.close(); })();
