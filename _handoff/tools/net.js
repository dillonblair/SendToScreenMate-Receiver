const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => { const b = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1140, height: 540 } });
 const reqs = []; p.on('request', r => reqs.push(r.url()));
 await p.goto('file://' + process.argv[2]); await p.waitForTimeout(5000);
 const ext = reqs.filter(u => !u.startsWith('file://') && !u.startsWith('data:') && !u.startsWith('blob:'));
 console.log('requests:', reqs.length, '| non-local:', ext.length ? ext : 'none');
 await b.close(); })();
