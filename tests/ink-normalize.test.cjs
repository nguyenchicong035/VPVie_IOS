const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},localStorage:{getItem:()=>null,setItem:()=>{}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../web/js/ink-recognize.js','utf8'),context);
const ink=context.window.VPInk;
test('duplicate pointer samples produce exactly 32 finite points without stalling',()=>{
 for(const strokes of [
  [[{x:3,y:7},{x:3,y:7}]],
  [[{x:3,y:7},{x:3,y:7},{x:50,y:100},{x:50,y:100}]],
  [[{x:2,y:2},{x:2,y:2}],[{x:6,y:6},{x:6,y:6}]]
 ]){
  const result=ink.normalize(strokes);assert.equal(result.length,32);
  assert.ok(result.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 }
});
test('learned strokes remain recognizable after resampling',()=>{
 const stroke=[[{x:0,y:0},{x:0,y:0},{x:30,y:30},{x:50,y:50}]];
 assert.equal(ink.learn('test',stroke),true);
 assert.equal(ink.recognizeSymbol(stroke).name,'test');
});
