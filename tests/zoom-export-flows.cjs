const assert=require('node:assert/strict');
const fs=require('node:fs');
exports.verifyZoomExport=async function(page){
 async function png(){const download=page.waitForEvent('download');await page.locator('#btn-png').click();const d=await download;return fs.promises.readFile(await d.path());}
 await page.evaluate(()=>{const c=document.getElementById('paper');for(const [x,y] of [[20,20],[c.clientWidth-20,20],[20,c.clientHeight-20],[c.clientWidth-20,c.clientHeight-20]])window.__vp.state.items.push({type:'circle',cx:x,cy:y,r:10,color:'#df0000',fill:'#df0000',size:2});window.__vp.redraw();});
 await page.locator('#page-zoom-reset').click();await page.evaluate(()=>new Promise(requestAnimationFrame));const normal=await png();
 await page.evaluate(()=>window.VPViewport.zoomTo(2.5));await page.evaluate(()=>new Promise(requestAnimationFrame));const zoomed=await png();
 assert.equal(normal.readUInt32BE(16),zoomed.readUInt32BE(16));assert.equal(normal.readUInt32BE(20),zoomed.readUInt32BE(20));
 const result=await page.evaluate(async urls=>{
  const samples=[];for(const url of urls){const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d');g.drawImage(image,0,0);const w=document.getElementById('paper').clientWidth,h=document.getElementById('paper').clientHeight;const corners=[[20,20],[w-20,20],[20,h-20],[w-20,h-20]].map(([x,y])=>Array.from(g.getImageData(Math.round(x*c.width/w),Math.round(y*c.height/h),1,1).data));const small=document.createElement('canvas');small.width=64;small.height=64;const sg=small.getContext('2d');sg.drawImage(c,0,0,64,64);samples.push({corners,pixels:Array.from(sg.getImageData(0,0,64,64).data)});}let error=0;for(let i=0;i<samples[0].pixels.length;i++)error+=Math.abs(samples[0].pixels[i]-samples[1].pixels[i]);return {corners:samples.map(s=>s.corners),difference:error/(64*64*4*255)};
 },[normal,zoomed].map(b=>'data:image/png;base64,'+b.toString('base64')));
 for(const corners of result.corners)for(const pixel of corners)assert.ok(pixel[0]>180&&pixel[1]<20&&pixel[2]<20,'all four page corners must be present in both exports');
 assert.ok(result.difference<.03,'export content must remain aligned despite higher rendering quality');
 await page.locator('#page-zoom-reset').click();
 console.log('PASS: full-page PNG exports retain dimensions, all four corners and content alignment at 100%/250%.');
};
