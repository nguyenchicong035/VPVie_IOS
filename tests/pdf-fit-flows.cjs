const assert=require('node:assert/strict');
const path=require('node:path');
exports.verifyPdfFit=async function(page){
 await page.evaluate(()=>{
  window._paperImages=[];const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
   if(this.canvas.id==='paper'&&(image instanceof HTMLImageElement||image.dataset?.pdfPage==='true'))window._paperImages.push({src:image.src||window.__vp.state.pageBg,args,natural:[image.naturalWidth||image.width,image.naturalHeight||image.height],canvas:[this.canvas.clientWidth,this.canvas.clientHeight]});
   return original.call(this,image,...args);
  };
 });
 await page.locator('#imp-pdf').setInputFiles(path.join(__dirname,'fixtures/lesson.pdf'));
 await page.waitForFunction(()=>window._paperImages.some(d=>d.src===window.__vp.state.pageBg));
 for(const viewport of [{width:1875,height:915},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const index of [0,1]){
   await page.evaluate(i=>{window._paperImages=[];window.__vp.gotoPage(i);window.__vp.redraw();},index);
   await page.waitForFunction(()=>window._paperImages.some(d=>d.src===window.__vp.state.pageBg));
   const d=await page.evaluate(()=>window._paperImages.filter(d=>d.src===window.__vp.state.pageBg).at(-1));
   assert.equal(d.args.length,4,'drawImage must use the complete source image');
   const [x,y,w,h]=d.args;assert.ok(x>=0&&y>=0&&x+w<=d.canvas[0]+.1&&y+h<=d.canvas[1]+.1,'entire page must fit on paper');
   assert.ok(Math.abs(w/h-d.natural[0]/d.natural[1])<.001,'PDF aspect ratio must be preserved');
  }
 }
 await page.setViewportSize({width:1365,height:900});
 console.log('PASS: both PDF pages fit entirely on desktop and phone viewports without cropping or distortion.');
};
