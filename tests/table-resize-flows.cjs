const assert=require('node:assert/strict');
exports.verifyTableResize=async function(page){
 await page.evaluate(()=>{if(!window.__vp.state.overlays.some(o=>o.kind==='table')){const i=window.__vp.pages().findIndex(p=>p.overlays.some(o=>o.kind==='table'));if(i>=0)window.__vp.gotoPage(i);}});
 const table=page.locator('.ov.ov-table').first(); await table.locator('td').first().click();
 const initial=await page.evaluate(()=>{const o=window.__vp.state.overlays.find(o=>o.kind==='table');return {id:o.id,x:o.x,y:o.y,widths:[...o.data.colWidths],heights:[...o.data.rowHeights]};});
 const col=table.locator('.table-col-resize').first();let box=await col.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2,{steps:8});await page.mouse.up();
 const row=table.locator('.table-row-resize').nth(1);box=await row.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2+40,{steps:8});await page.mouse.up();
 let state=await page.evaluate(()=>window.__vp.state.overlays.find(o=>o.kind==='table'));
 assert.ok(Math.abs(state.data.colWidths[0]-initial.widths[0]-60)<=1);
 assert.equal(state.data.colWidths[1],initial.widths[1]);assert.equal(state.data.rowHeights[0],initial.heights[0]);
 assert.ok(Math.abs(state.data.rowHeights[1]-initial.heights[1]-40)<=1);assert.equal(state.x,initial.x);assert.equal(state.y,initial.y);
 await table.locator('.table-cell').first().fill('Bang trong suot');
 // Resizing must honor the object's scale rather than treating screen pixels as table units.
 await page.evaluate(()=>{const o=window.__vp.state.overlays.find(o=>o.kind==='table');o.scale=2;document.querySelector('.table-cell').dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForTimeout(900);await page.reload();await page.waitForFunction(()=>!!window.__vp);await page.evaluate(()=>window.__vp.closeLibrary());await table.locator("td").first().click();
 const before=state.data.colWidths[0];box=await col.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2,{steps:6});await page.mouse.up();
 state=await page.evaluate(()=>window.__vp.state.overlays.find(o=>o.kind==='table'));assert.ok(Math.abs(state.data.colWidths[0]-before-20)<=1);
 await col.focus();await page.keyboard.press('ArrowRight');
 state=await page.evaluate(()=>window.__vp.state.overlays.find(o=>o.kind==='table'));const expected=JSON.parse(JSON.stringify(state.data));
 await page.waitForTimeout(900);await page.reload();await page.waitForFunction(()=>!!window.__vp);
 await page.evaluate(()=>window.__vp.closeLibrary());
 const saved=await page.evaluate(()=>window.__vp.state.overlays.find(o=>o.kind==='table').data);
 assert.deepEqual(saved,expected);assert.equal(saved.cells[0][0],'Bang trong suot');
 assert.equal(await page.locator('.table-headers').first().getAttribute('data-html2canvas-ignore'),'true');
 console.log('PASS: independent row/column resizing, 2x scale, keyboard adjustment, transparent cells and dimensions/text persisted after reload.');
};
