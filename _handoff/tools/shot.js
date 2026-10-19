const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const [,, file, times, prefix, w, h] = process.argv;
  const b = await chromium.launch();
  for (const t of times.split(',')) {
    const p = await b.newPage({ viewport: { width: +(w||1140), height: +(h||540) }, deviceScaleFactor: 2 });
    p.on('pageerror', e => console.log('ERR', e.message));
    // make the 48 s demo loop sit at second t
    await p.addInitScript(`(function(){var base=Date.now(); var off = (${t}*1000) - (base % 48000) - 1200; var D=Date.now; Date.now=function(){return D()+off;};})()`);
    await p.goto('file://' + file + (process.env.HASH||''));
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${prefix}-${t}.png` });
    await p.close();
  }
  await b.close();
})();
