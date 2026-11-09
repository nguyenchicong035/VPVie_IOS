const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'../web');let updated=false;
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let name=url.pathname.replace(/^\/VPVie_IOS\//,'')||'index.html';
  if(name==='sw.js'&&!updated){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(__dirname,'fixtures/sw-v10.js')));return;}

  const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(404);return res.end();}
  fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end();}const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(data);});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();page.on("pageerror",e=>console.log("PAGE ERROR",e.message));const url=`http://127.0.0.1:${server.address().port}/VPVie_IOS/bang.html`;
  const until=async predicate=>{const deadline=Date.now()+30000;while(Date.now()<deadline){if(await page.evaluate(predicate))return;await page.waitForTimeout(100);}throw new Error("PWA update did not become ready");};
  await page.goto(url);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(()=>localStorage.setItem('vpvie.update-test','preserve my notebooks'));
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  updated=true;
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await until(async()=>{const keys=await caches.keys();return keys.includes('vpvie-ios-v11')&&!keys.includes('vpvie-ios-v10');});
  await until(()=>new Promise(resolve=>{
    const channel=new MessageChannel();const timer=setTimeout(()=>resolve(false),300);
    channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data==='vpvie-ios-v11');};
    navigator.serviceWorker.controller?.postMessage({type:'VERSION'},[channel.port2]);
  }));
  await page.reload();await page.waitForFunction(()=>window.__vp&&window.VPLicense?.isActive());
  assert.equal(await page.locator('html').getAttribute('data-vpvie-version'),'1.1.6');
  assert.equal(await page.evaluate(()=>localStorage.getItem('vpvie.update-test')),'preserve my notebooks');
  const code=await page.evaluate(()=>fetch('js/app.js?v=1.1.6').then(r=>r.text()));assert.ok(code.includes('table-form'));
  await page.context().setOffline(true);
  await page.reload();await page.waitForFunction(()=>!!window.__vp);
  assert.equal(await page.locator('html').getAttribute('data-vpvie-version'),'1.1.6');
  console.log('PASS: v10 cache upgrades to v11 under a Pages subfolder, loads 1.1.6 code, preserves local data and reopens offline.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
