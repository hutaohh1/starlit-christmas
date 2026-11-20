import test from 'node:test';
import assert from 'node:assert/strict';
import {HandInteraction,PhotoFocus,nearestPhotoTarget} from '../src/gestures.js';
function palm(){
  const hand=Array.from({length:21},()=>({x:.5,y:.65,z:0}));hand[0]={x:.5,y:.9,z:0};
  for(const [n,x]of [[5,.38],[9,.47],[13,.56],[17,.65]]){hand[n]={x,y:.64,z:0};hand[n+1]={x,y:.48,z:0};hand[n+2]={x,y:.35,z:0};hand[n+3]={x,y:.23,z:0};}
  hand[4]={x:.12,y:.63,z:0};return hand;
}
function pinch(){const hand=palm();hand[4]={...hand[8],x:hand[8].x+.02};return hand;}
function run(interaction,hand,start,end){let frames=[];for(let t=start;t<=end;t+=50)frames.push(interaction.process([hand],t));return frames;}
const candidate=(index,x=.5)=>({index,x,y:.5,visible:true,bounds:{left:x-.05,right:x+.05,top:.4,bottom:.6}});
const frame=(point,pinching=false)=>({tracked:true,point,pinching,gesture:pinching?'pinch':'point'});
test('pinching does not relocate the fingertip pointer',()=>{
  const interaction=new HandInteraction();run(interaction,palm(),0,400);
  const before=interaction.process([palm()],450),after=interaction.process([pinch()],500);
  assert.deepEqual(after.point,before.point);
});
test('one pinch opens once and a short release reliably rearms the next pinch',()=>{
  const interaction=new HandInteraction();run(interaction,palm(),0,400);
  assert.equal(run(interaction,pinch(),450,900).filter(f=>f.intent==='pinch').length,1);
  // Release is long enough to rearm but shorter than the palm stabilization time.
  run(interaction,palm(),950,1150);
  assert.equal(run(interaction,pinch(),1200,1550).filter(f=>f.intent==='pinch').length,1);
});
test('arriving with fingers already pinched never opens an unrelated photo',()=>{
  const interaction=new HandInteraction();assert.equal(run(interaction,pinch(),0,800).filter(f=>f.intent==='pinch').length,0);
});
test('loss of hand requires release before another pinch can open',()=>{
  const interaction=new HandInteraction();run(interaction,palm(),0,400);interaction.process([],1000);
  assert.equal(run(interaction,pinch(),1050,1700).filter(f=>f.intent==='pinch').length,0);
});
test('a frame edge is clickable and a far-away frame is never selected',()=>{
  const targets=[candidate(0)];assert.equal(nearestPhotoTarget({x:.549,y:.59},targets,1200,800).index,0);
  assert.equal(nearestPhotoTarget({x:.7,y:.5},targets,1200,800),null);
});
test('closing fingers locks the highlighted photo even when the fingertip crosses another frame',()=>{
  const focus=new PhotoFocus(),targets=[candidate(0),candidate(1,.7)];
  assert.equal(focus.update(frame({x:.5,y:.5}),targets,1200,800,0).index,0);
  assert.equal(focus.update(frame({x:.7,y:.5},true),targets,1200,800,100).index,0);
  assert.equal(focus.update(frame({x:.7,y:.5},true),targets,1200,800,300).index,0);
  assert.equal(focus.update(frame({x:.7,y:.5}),targets,1200,800,400).index,1);
});
test('brief jitter retains focus but stale focus, lost hands and two-hand zoom clear it',()=>{
  const focus=new PhotoFocus(),targets=[candidate(0)];
  focus.update(frame({x:.5,y:.5}),targets,1200,800,0);
  assert.equal(focus.update(frame({x:.56,y:.5}),targets,1200,800,100).index,0);
  assert.equal(focus.update(frame({x:.56,y:.5}),targets,1200,800,500),null);
  assert.equal(focus.update(frame({x:.56,y:.5},true),targets,1200,800,600),null);
  focus.update(frame({x:.5,y:.5}),targets,1200,800,700);
  assert.equal(focus.update({tracked:false},targets,1200,800,750),null);
  assert.equal(focus.update(frame({x:.5,y:.5},true),targets,1200,800,800),null);
  focus.update(frame({x:.5,y:.5}),targets,1200,800,850);
  assert.equal(focus.update({...frame({x:.5,y:.5}),twoHands:true},targets,1200,800,900),null);
});
test('deleting a hovered photo cannot transfer a held pinch to its replacement',()=>{
  const focus=new PhotoFocus();focus.update(frame({x:.5,y:.5}),[candidate(4)],1200,800,0);
  focus.update(frame({x:.5,y:.5},true),[candidate(4)],1200,800,100);
  assert.equal(focus.update(frame({x:.5,y:.5},true),[candidate(5)],1200,800,200),null);
});
