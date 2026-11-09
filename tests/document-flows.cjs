const assert=require('node:assert/strict');
const path=require('node:path');
const fixture=ext=>path.join(__dirname,'fixtures','lesson.'+ext);
exports.verifyDocumentFlows=async function(page){
 await page.locator('#btn-table').click();
 await page.locator('#table-rows').fill('2');await page.locator('#table-cols').fill('3');
 await page.locator('#table-form button[type=submit]').click();
 assert.equal(await page.locator('table.ov-table td').count(),6);
 assert.ok(await page.locator('.ov.ov-table').evaluate(el=>[el,el.querySelector('table'),el.querySelector('td')].every(node=>getComputedStyle(node).backgroundColor==='rgba(0, 0, 0, 0)')));
 const cell=page.locator('table.ov-table td').first();await cell.click();await page.keyboard.type('Bai tap 1');
 assert.equal(await cell.textContent(),'Bai tap 1');
 // Recognition must not block typing as soon as the pen is lifted.
 await page.evaluate(()=>document.getElementById('btn-ink-train').click());
 await page.locator('#ink-label').fill('x');
 const pad=await page.locator('#ink-pad').boundingBox();
 await page.evaluate(()=>{window._recognizeCalls=0;const original=window.VPInk.recognizeSymbol;window.VPInk.recognizeSymbol=(...args)=>{window._recognizeCalls++;return original(...args)};});
 await page.mouse.move(pad.x+30,pad.y+30);await page.mouse.down();await page.mouse.move(pad.x+150,pad.y+140,{steps:12});await page.mouse.up();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'ink-label');
 await page.keyboard.press('Control+a');await page.keyboard.type('y');
 assert.equal(await page.locator('#ink-label').inputValue(),'y');
 assert.equal(await page.evaluate(()=>window._recognizeCalls),0);
 await page.locator('#ink-learn').click();assert.ok(await page.evaluate(()=>window.VPInk.templates().some(t=>t.name==='y')));
 await page.locator('[data-close="dlg-ink"]').click();
 // The normal Open command accepts both document formats on web and desktop.
 for(const ext of ['pdf','docx']){
  const chooser=page.waitForEvent('filechooser');await page.locator('#book-open').click();
  await (await chooser).setFiles(fixture(ext));
  await page.waitForFunction(ext=>document.querySelector('.toast')?.textContent.includes(ext==='pdf'?'trang PDF':'trang Word'),ext);
  const result=await page.evaluate(async()=>{
   const image=new Image();image.src=window.__vp.state.pageBg;await image.decode();
   const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d');g.drawImage(image,0,0);
   const pixels=g.getImageData(0,0,c.width,c.height).data;let ink=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i]<120&&pixels[i+1]<120&&pixels[i+2]<120)ink++;
   return {ink,pages:window.__vp.pages().length};
  });
  assert.ok(result.ink>100,ext+' must render actual document text');assert.equal(result.pages,2);
 }
 // The settings entry point uses the same document importer.
 await page.locator('#imp-pdf').setInputFiles(fixture('pdf'));
 await page.waitForFunction(()=>window.__vp.pages().length===3);
 console.log('PASS: transparent editable table, immediate ink-label input, learning, PDF/DOCX Open command and PDF settings import with rendered text.');
};
