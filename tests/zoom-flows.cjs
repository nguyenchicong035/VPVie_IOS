const assert=require('node:assert/strict');
exports.verifyZoom=async function(page){
 await page.evaluate(()=>window.__vp.addPage());
 await page.evaluate(()=>{window.__vp.state.beautify=false;window.__vp.state.tidyInk=false;window.__vp.state.writeMode="hand";});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator("#board").evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
 const paper=page.locator('#paper');let rect=await page.locator('#board').boundingBox();
 const original=await page.evaluate(()=>({items:JSON.stringify(window.__vp.state.items),w:document.getElementById('paper').width,h:document.getElementById('paper').height,cw:document.getElementById('paper').clientWidth}));
 await page.locator('#page-zoom-in').click();assert.equal(await page.locator('#page-zoom-reset').textContent(),'125%');
 await page.waitForFunction(w=>document.getElementById('paper').width>w,original.w);
 assert.equal(await page.evaluate(()=>document.getElementById('paper').clientWidth),original.cw);
 await page.locator('#page-zoom-reset').click();
 await page.evaluate(()=>window.VPViewport.zoomTo(2));
 // Drawing must map screen coordinates back to document coordinates.
 const logical={x:rect.width/2-80,y:rect.height/2-30};
 const at=await page.evaluate(p=>{const r=document.getElementById('page-surface').getBoundingClientRect(),z=window.VPViewport.getState().zoom;return {x:r.left+p.x*z,y:r.top+p.y*z}},logical);
 await page.mouse.move(at.x,at.y);await page.mouse.down();await page.mouse.move(at.x+80,at.y+40,{steps:8});await page.mouse.up();
 let stroke=await page.evaluate(()=>window.__vp.state.items.at(-1));assert.equal(stroke.type,'stroke');assert.ok(Math.abs(stroke.points[0].x-logical.x)<1);assert.ok(Math.abs(stroke.points.at(-1).x-logical.x-40)<1);
 const items=await page.evaluate(()=>JSON.stringify(window.__vp.state.items));
 await page.locator('[data-tool="pan"]').click();const before=await page.evaluate(()=>window.VPViewport.getState());
 await page.mouse.move(rect.x+100,rect.y+100);await page.mouse.down();await page.mouse.move(rect.x+140,rect.y+140,{steps:5});await page.mouse.up();
 const after=await page.evaluate(()=>window.VPViewport.getState());assert.ok(after.x>before.x&&after.y>before.y);
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__vp.state.items)),items);
 // Content, rather than browser UI, zooms on Ctrl+wheel.
 await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');
 assert.ok(await page.evaluate(()=>window.VPViewport.getState().zoom>2));
 // Simulate two native touch contacts with CDP in the Chromium wrapper below.
 await page.locator('#page-zoom-reset').click();
 await page.locator('[data-tool="pen"][data-pen="ball"]').click();
 assert.deepEqual(errors,[]);
 console.log('PASS: zoom buttons, Ctrl+wheel, viewport pan and accurate ink coordinates at 200%; logical page dimensions remain unchanged while backing resolution increases.');
};
exports.verifyPinch=async function(page,cdp){
 const rect=await page.locator('#board').boundingBox(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
 const before=await page.evaluate(()=>JSON.stringify(window.__vp.state.items));
 const touch=async points=>cdp.send('Input.dispatchTouchEvent',{type:points.length?'touchMove':'touchEnd',touchPoints:points});
 const points=(radius,dy=0)=>[{x:cx-radius,y:cy+dy,id:1,radiusX:5,radiusY:5},{x:cx+radius,y:cy+dy,id:2,radiusX:5,radiusY:5}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points(40)[0]]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(40)});
 for(let r=45;r<=100;r+=5)await touch(points(r));
 await page.waitForFunction(()=>window.VPViewport.getState().zoom>=2.4);
 const panBefore=await page.evaluate(()=>window.VPViewport.getState());await touch(points(100,20));
 await page.waitForFunction(before=>window.VPViewport.getState().y>before,panBefore.y);
 const panAfter=await page.evaluate(()=>window.VPViewport.getState());assert.ok(panAfter.y>panBefore.y);
 await touch([]);
 assert.ok(await page.evaluate(()=>window.VPViewport.getState().zoom>2));
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__vp.state.items)),before,'pinch must not add an ink stroke');
 await page.locator('#page-zoom-reset').click();assert.equal(await page.evaluate(()=>window.VPViewport.getState().zoom),1);
 await page.evaluate(()=>window.VPViewport.zoomTo(99));assert.equal(await page.evaluate(()=>window.VPViewport.getState().zoom),4);
 await page.evaluate(()=>window.VPViewport.zoomTo(.01));assert.equal(await page.evaluate(()=>window.VPViewport.getState().zoom),.25);
 await page.locator('#page-zoom-reset').click();
 console.log('PASS: native two-finger pinch/pan, no incidental ink, and bounded 25–400% zoom.');
};
