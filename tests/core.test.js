import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticleData, createRibbonData, treeRadius, TREE_BOTTOM, TREE_HEIGHT } from '../src/particles.js';
import { classifyHand, GestureStabilizer } from '../src/gestures.js';

test('particles form a bounded tree and a wider three-dimensional cloud',()=>{
  const data=createParticleData(10000);let cloudOutside=0;
  for(let i=0;i<data.sizes.length;i++){
    const j=i*3,t=(data.positions[j+1]-TREE_BOTTOM)/TREE_HEIGHT;
    assert.ok(t>=0&&t<=1);assert.ok(Math.hypot(data.positions[j],data.positions[j+2])<=treeRadius(t)+.00001);
    assert.ok(data.sizes[i]>0);assert.ok([...data.scatter.slice(j,j+3)].every(Number.isFinite));
    if(Math.abs(data.scatter[j])>2.5)cloudOutside++;
  }
  assert.ok(cloudOutside>3000);
});
test('ribbon climbs continuously from the base to the crown',()=>{
  const data=createRibbonData(1000);for(let i=1;i<1000;i++)assert.ok(data.positions[i*3+1]>data.positions[(i-1)*3+1]);
  assert.ok(Math.hypot(data.positions[2997],data.positions[2999])<.15);
});
function handFixture(extended=true){
  const hand=Array.from({length:21},()=>({x:.5,y:.65,z:0}));hand[0]={x:.5,y:.9,z:0};
  for(const [n,x]of [[5,.38],[9,.47],[13,.56],[17,.65]]){hand[n]={x,y:.64,z:0};hand[n+1]={x,y:.48,z:0};hand[n+2]={x,y:extended?.35:.56,z:0};hand[n+3]={x,y:extended?.23:.7,z:0};}
  hand[4]={x:.12,y:.63,z:0};return hand;
}
test('hand classifier distinguishes an open palm, a fist, and a pinch',()=>{
  const palm=handFixture(true);assert.equal(classifyHand(palm).gesture,'palm');
  assert.equal(classifyHand(handFixture(false)).gesture,'fist');
  palm[4]={...palm[8],x:palm[8].x+.02};assert.equal(classifyHand(palm).gesture,'pinch');
});
test('pinch hysteresis prevents flickering near its boundary',()=>{
  const palm=handFixture(true);palm[4]={...palm[8],x:palm[8].x+.105};
  assert.equal(classifyHand(palm,false).pinch,false);assert.equal(classifyHand(palm,true).pinch,true);
});
test('invalid landmarks are ignored',()=>{assert.equal(classifyHand(null).gesture,'none');assert.equal(classifyHand([]).gesture,'none');const bad=handFixture();bad[8].x=NaN;assert.equal(classifyHand(bad).gesture,'none');});
test('gesture stabilization requires a sustained pose and emits only transitions',()=>{
  const s=new GestureStabilizer(180);assert.equal(s.update('palm',0),null);assert.equal(s.update('fist',100),null);assert.equal(s.update('palm',150),null);assert.equal(s.update('palm',329),null);assert.equal(s.update('palm',331),'palm');assert.equal(s.update('palm',600),null);s.reset();assert.equal(s.current,'none');
});

test('cinematic density keeps the crown airy and the lower branches full',()=>{
  const data=createParticleData(10000,1225,true);let lower=0,upper=0;
  for(let i=0;i<10000;i++){const t=(data.positions[i*3+1]-TREE_BOTTOM)/TREE_HEIGHT;if(t<.4)lower++;if(t>.8)upper++;}
  assert.ok(lower>5000);assert.ok(upper<1100);
});
