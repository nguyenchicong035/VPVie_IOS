const assert=require('node:assert/strict');
const fs=require('node:fs');
exports.verifyZoomExport=async function(page){
 async function png(){const download=page.waitForEvent('download');await page.locator('#btn-png').click();const d=await download;return fs.promises.readFile(await d.path());}
 await page.locator('#page-zoom-reset').click();const normal=await png();
 await page.evaluate(()=>window.VPViewport.zoomTo(2.5));const zoomed=await png();
 assert.equal(normal.readUInt32BE(16),zoomed.readUInt32BE(16));assert.equal(normal.readUInt32BE(20),zoomed.readUInt32BE(20));
 assert.deepEqual(zoomed,normal,'export must include the same full page regardless of zoom/pan');
 await page.locator('#page-zoom-reset').click();
 console.log('PASS: PNG export remains the full logical page and is identical at 100% and 250%.');
};
