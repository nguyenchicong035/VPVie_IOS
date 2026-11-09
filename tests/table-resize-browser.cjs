const {chromium}=require('playwright');
async function prepareLicensedPage() {}
async function openBoard(p) { await p.waitForFunction(()=>window.__vp&&window.VPLicense?.isActive()); await p.evaluate(()=>window.__vp.closeLibrary()); }
const {verifyTableResize}=require('./table-resize-flows.cjs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{const p=await b.newPage({viewport:{width:1365,height:900},serviceWorkers:'block'});await prepareLicensedPage(p);await p.goto((process.env.VPVIE_TEST_URL||'http://127.0.0.1:8000')+'/bang.html');await openBoard(p);await p.locator('#btn-table').click();await p.locator('#table-rows').fill('2');await p.locator('#table-cols').fill('3');await p.locator('#table-form button[type=submit]').click();await verifyTableResize(p);}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
