const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
async function observe(page){
 await page.evaluate(()=>{window._pdfRendered=null;const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='paper'&&image.dataset?.pdfPage==='true')window._pdfRendered={width:image.width,height:image.height,pixels:this.canvas.width,logical:this.canvas.clientWidth};return draw.call(this,image,...args);};});
}
exports.verifyPdfQuality=async function(page){
 await page.locator('#page-zoom-reset').click();await observe(page);
 await page.locator('#imp-pdf').setInputFiles(path.join(__dirname,'fixtures/lesson.pdf'));
 await page.waitForFunction(()=>!!window._pdfRendered);
 const initial=await page.evaluate(()=>window._pdfRendered);
 await page.evaluate(()=>{window.__vp.state.items.push({type:'circle',cx:50,cy:50,r:10,color:'#f00',size:2});window.__vp.redraw();});
 const ink=await page.evaluate(()=>JSON.stringify(window.__vp.state.items));
 const count=await page.evaluate(()=>window.__vp.pages().length);await page.evaluate(()=>{window.__vp.pages().forEach(p=>delete p.pdf);window.__vp.redraw();});
 await page.locator('#imp-pdf').setInputFiles(path.join(__dirname,'fixtures/lesson.pdf'));await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('cập nhật PDF gốc'));assert.equal(await page.evaluate(()=>window.__vp.pages().length),count);assert.equal(await page.evaluate(()=>JSON.stringify(window.__vp.state.items)),ink);
 await page.evaluate(()=>window.VPViewport.zoomTo(4));
 await page.waitForFunction(width=>window._pdfRendered?.width>width*3,initial.width);
 const sharp=await page.evaluate(()=>window._pdfRendered);
 assert.ok(sharp.pixels>initial.pixels*3);assert.equal(sharp.logical,initial.logical);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__vp.state.items)),ink);
 assert.ok(sharp.width*sharp.height<=12100000,'PDF raster is bounded for tablet memory');
 await page.waitForFunction(()=>{const value=localStorage.getItem('vpvie.book.'+window.__vp.lib().current);return value&&JSON.parse(value).pages[window.__vp.cur()]?.pdf;});await page.reload();await page.waitForFunction(()=>!!window.__vp);await page.evaluate(()=>window.__vp.closeLibrary());await observe(page);await page.evaluate(()=>window.__vp.redraw());await page.waitForFunction(()=>!!window._pdfRendered);
 const afterReload=await page.evaluate(()=>window.__vp.pages()[window.__vp.cur()].pdf);assert.ok(afterReload?.documentId,'original PDF reference survives autosave and reload');
 const json=await page.evaluate(()=>window.VPPdfQuality.portable(JSON.stringify({v:1,cur:window.__vp.cur(),pages:window.__vp.pages()})));
 const book=JSON.parse(json),sources=Object.values(book.pdfSources);assert.equal(sources.length,1,'one original is shared by all imported pages');
 assert.deepEqual(Buffer.from(sources[0].dataUrl.split(',')[1],'base64'),fs.readFileSync(path.join(__dirname,'fixtures/lesson.pdf')));
 console.log('PASS: 400% uses a new PDF raster at >3x resolution, preserves ink/logical coordinates, survives reload, and exports one intact original PDF.');
 return json;
};
exports.verifyPortablePdf=async function(page,json){
 await observe(page);const chooser=page.waitForEvent('filechooser');await page.locator('#book-open').click();await(await chooser).setFiles({name:'quality.vpvie.json',mimeType:'application/json',buffer:Buffer.from(json)});
 await page.waitForFunction(()=>!!window._pdfRendered);const width=await page.evaluate(()=>window._pdfRendered.width);
 await page.evaluate(()=>window.VPViewport.zoomTo(4));await page.waitForFunction(w=>window._pdfRendered?.width>w*3,width);
 console.log('PASS: a portable notebook restores the original PDF and sharp zoom in a clean browser profile.');
};
