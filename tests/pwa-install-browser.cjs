const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
 for(const mobile of [false,true]){
  const p=await b.newPage({viewport:mobile?{width:390,height:844}:{width:1365,height:900},serviceWorkers:'block',...(mobile?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',isMobile:true,hasTouch:true}:{})});
  await p.goto((process.env.VPVIE_TEST_URL||'http://127.0.0.1:8001')+'/bang.html');await p.waitForFunction(()=>!!window.__vp);await p.evaluate(()=>window.__vp.closeLibrary());
  if(!mobile)await p.evaluate(()=>window.dispatchEvent(new Event('beforeinstallprompt',{cancelable:true})));
  const panel=p.locator('#pwa-install-panel');await panel.waitFor({state:'attached'});assert.equal(await panel.isVisible(),false);
  assert.equal(await p.locator('#pwa-install').evaluate(e=>getComputedStyle(e).position),'fixed');
  if(mobile){await p.locator('#pwa-install').click();await panel.waitFor({state:'visible'});assert.equal(await panel.evaluate(e=>getComputedStyle(e).position),'fixed');
   const card=await p.locator('.pwa-install-card').boundingBox();assert.ok(card.width<=390&&card.x>=0);
   await p.locator('.pwa-install-close').click();assert.equal(await panel.isVisible(),false);
  }
  assert.ok(await p.evaluate(()=>{const before=document.body.scrollHeight;document.getElementById('pwa-install-panel').remove();document.getElementById('pwa-install').remove();return document.body.scrollHeight===before;}),'install UI must not add any content below the footer');await p.close();
 }
 console.log('PASS: install panel hidden on desktop and mobile, fixed compact button, mobile open/close, no extra content below the page.');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
