const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
async function prepareLicensedPage() {}
async function openBoard(p) { await p.waitForFunction(()=>window.__vp&&window.VPLicense?.isActive()); await p.evaluate(()=>window.__vp.closeLibrary()); }
const {verifyPdfQuality,verifyPortablePdf}=require('./pdf-quality-flows.cjs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{const url=(process.env.VPVIE_TEST_URL||'http://127.0.0.1:8000')+'/bang.html';async function open(){const p=await b.newPage({viewport:{width:1365,height:900},serviceWorkers:'block'});await prepareLicensedPage(p);await p.goto(url);await openBoard(p);return p;}const first=await open();await verifyPdfQuality(first);const download=first.waitForEvent('download');await first.locator('#book-save').click();const json=await fs.promises.readFile(await(await download).path(),'utf8');assert.equal(Object.keys(JSON.parse(json).pdfSources).length,1);const second=await open();await verifyPortablePdf(second,json);}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
