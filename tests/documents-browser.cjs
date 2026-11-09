const {chromium}=require('playwright');
const assert=require('node:assert/strict');
async function prepareLicensedPage() {}
async function openBoard(p) { await p.waitForFunction(()=>window.__vp&&window.VPLicense?.isActive()); await p.evaluate(()=>window.__vp.closeLibrary()); }
const {verifyDocumentFlows}=require('./document-flows.cjs');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{const p=await b.newPage({viewport:{width:1365,height:900},serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await prepareLicensedPage(p);await p.goto((process.env.VPVIE_TEST_URL||'http://127.0.0.1:8000')+'/bang.html');await openBoard(p);await verifyDocumentFlows(p);await require("./pdf-fit-flows.cjs").verifyPdfFit(p);assert.deepEqual(errors,[]);}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
