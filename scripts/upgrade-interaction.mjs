import {readFile,writeFile} from 'node:fs/promises';
let scene=await readFile('src/scene.js','utf8');
scene="import { nearestPhotoTarget } from './gestures.js';\n"+scene;
scene=scene.replace('this.handYaw=null;','this.handTracked=false;this.handCameraY=0;this.handSensitivity=1;this.hoverIndex=null;');
scene=scene.replace('if(this.autoRotate&&!this.isInteracting&&!this.reduced)','if(this.autoRotate&&!this.handTracked&&!this.isInteracting&&!this.reduced)');
scene=scene.replace('if(this.handYaw!==null&&!this.isInteracting)this.tree.rotation.y=THREE.MathUtils.damp(this.tree.rotation.y,this.handYaw,2,dt);','');
scene=scene.replace('group.scale.setScalar(THREE.MathUtils.lerp(this.edition.frameScale,this.mode===\'memories\'?1.05:.8,this.spread));',"const baseScale=THREE.MathUtils.lerp(this.edition.frameScale,this.mode==='memories'?1.05:.8,this.spread);const focusScale=this.hoverIndex===d.index?1.14:1;group.scale.setScalar(THREE.MathUtils.damp(group.scale.x,baseScale*focusScale,9,dt));const frameMaterial=group.children[0].material;frameMaterial.emissive.set(this.hoverIndex===d.index?'#b78d39':'#000000');frameMaterial.emissiveIntensity=this.hoverIndex===d.index?.45:0;");
const methods=`  applyHandFrame(frame){
    this.handTracked=!!frame.tracked;
    if(!frame.tracked){this.hoverIndex=null;return;}
    if(this.isInteracting)return;
    this.tree.rotation.y+=(frame.rotationDelta||0)*this.handSensitivity;
    const offset=this.camera.position.clone().sub(this.controls.target);
    if(frame.verticalDelta){
      const spherical=new THREE.Spherical().setFromVector3(offset);
      spherical.phi=THREE.MathUtils.clamp(spherical.phi+frame.verticalDelta*this.handSensitivity,this.controls.minPolarAngle,this.controls.maxPolarAngle);
      offset.setFromSpherical(spherical);
    }
    if(frame.zoomFactor&&frame.zoomFactor!==1){const current=offset.length(),wanted=THREE.MathUtils.clamp(current*Math.pow(frame.zoomFactor,this.handSensitivity),this.controls.minDistance,this.controls.maxDistance);offset.setLength(wanted);}
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }
  hoverPhotoAt(point){
    if(!point||this.spread<.65){this.hoverIndex=null;return null;}
    this.tree.updateWorldMatrix(true,true);
    const candidates=this.photoGroups.map(group=>{const projected=group.getWorldPosition(new THREE.Vector3()).project(this.camera);return {index:group.userData.index,x:(projected.x+1)/2,y:(1-projected.y)/2,visible:projected.z>-1&&projected.z<1};});
    const target=nearestPhotoTarget(point,candidates,innerWidth,innerHeight,Math.max(62,Math.min(110,Math.min(innerWidth,innerHeight)*.16)));
    this.hoverIndex=target?.index??null;return target;
  }
`;
scene=scene.replace('  pickPhoto(',methods+'  pickPhoto(');
await writeFile('src/scene.js',scene);
let main=await readFile('src/main.js','utf8');
main=main.replace("let scene,mode='tree',photos=[],focusedIndex=0,toastTimeout,cameraBusy=false,cameraRequest=0,handPosition=null,lastPinch=0;","let scene,mode='tree',photos=[],focusedIndex=0,toastTimeout,cameraBusy=false,cameraRequest=0,lastPinch=0,photoTarget=null,swipeAnchor=null,lastSwipe=0;");
const start=main.indexOf('const hand=new HandController('),end=main.indexOf("$('gesture-button').addEventListener",start);
if(start<0||end<0)throw new Error('Hand handler not found');
main=main.slice(0,start)+`const hand=new HandController({
  video:$('camera-video'),canvas:$('hand-overlay'),onStatus:message=>{$('camera-status').textContent=message;},onError:cameraError,
  onFrame:frame=>{
    const cursor=$('gesture-cursor');
    cursor.hidden=!frame.tracked||$('guide-dialog').open||$('photo-dialog').open;
    if(!frame.tracked){scene?.applyHandFrame(frame);photoTarget=null;swipeAnchor=null;$('gesture-feedback').hidden=true;return;}
    $('gesture-feedback').hidden=false;
    $('gesture-feedback').textContent=frame.twoHands?'双手拉开 / 靠拢 · 缩放视角':frame.gesture==='point'?'移动食指找到照片 · 捏合打开':frame.gesture==='pinch'?'捏住确认 · 松开手后可以再次选择':'张掌移动 · 转动视角   双手拉开 · 放大';
    if($('guide-dialog').open){scene?.applyHandFrame({...frame,rotationDelta:0,verticalDelta:0,zoomFactor:1});return;}
    if($('photo-dialog').open){
      scene?.applyHandFrame({...frame,rotationDelta:0,verticalDelta:0,zoomFactor:1});
      if(frame.intent==='fist'){closePhoto();setMode('tree');swipeAnchor=null;return;}
      const now=performance.now();
      if(frame.gesture==='palm'&&!frame.twoHands){if(!swipeAnchor)swipeAnchor={x:frame.palm.x,since:now};const dx=frame.palm.x-swipeAnchor.x;if(Math.abs(dx)>.18&&now-swipeAnchor.since<850&&now-lastSwipe>900){openPhoto(focusedIndex+(dx<0?1:-1));lastSwipe=now;swipeAnchor=null;}else if(now-swipeAnchor.since>850)swipeAnchor={x:frame.palm.x,since:now};}else swipeAnchor=null;
      return;
    }
    scene?.applyHandFrame(frame);
    cursor.style.left=String(frame.point.x*100)+'%';cursor.style.top=String(frame.point.y*100)+'%';cursor.style.setProperty('--hold',String(frame.progress||0));
    photoTarget=frame.twoHands?null:scene?.hoverPhotoAt(frame.point);
    if(frame.twoHands&&scene)scene.hoverIndex=null;
    cursor.classList.toggle('targeting',!!photoTarget);cursor.classList.toggle('pinching',frame.pinching);
    $('gesture-cursor-label').textContent=photoTarget?'捏合打开 · '+photos[photoTarget.index]?.caption:frame.gesture==='point'?'靠近一张照片':'';
    if(frame.intent==='fist'){setMode('tree');return;}
    if(frame.intent==='palm'&&mode==='tree'){setMode('scatter');return;}
    if(frame.intent==='pinch'&&performance.now()-lastPinch>650){
      lastPinch=performance.now();
      if(mode==='tree'){setMode('memories');toast('星河已展开。松开手，用食指靠近照片，再捏合打开。',4200);}
      else if(photoTarget){openPhoto(photoTarget.index);swipeAnchor=null;}
      else toast('先用食指靠近照片，看到金色亮框后再捏合。',2600);
    }
  }
});
`+main.slice(end);
main=main.replace("$('camera-panel').hidden=!enabled;","$('camera-panel').hidden=!enabled;$('gesture-feedback').hidden=!enabled;");
main=main.replace("function closePhoto(){$('photo-dialog').close();}","function closePhoto(){$('photo-dialog').close();swipeAnchor=null;}");
main=main.replace("$('snow-toggle').addEventListener", "$('hand-sensitivity').addEventListener('input',e=>{if(scene)scene.handSensitivity=Number(e.target.value)/100;$('hand-sensitivity-value').textContent=e.target.value+'%';});\n$('snow-toggle').addEventListener");
await writeFile('src/main.js',main);
let html=await readFile('index.html','utf8');
html=html.replace('<div class="gesture-cursor" id="gesture-cursor" hidden></div>','<div class="gesture-cursor" id="gesture-cursor" hidden><span id="gesture-cursor-label"></span></div><div class="gesture-feedback ui" id="gesture-feedback" hidden aria-live="off"></div>');
html=html.replace('<div class="theme-label">','<label class="setting-range" for="hand-sensitivity"><span>手势灵敏度<span id="hand-sensitivity-value">100%</span></span><input type="range" min="50" max="150" value="100" id="hand-sensitivity" /></label>\n      <div class="theme-label">');
html=html.replace('在星河里选一张照片，放大回忆。','食指移到照片旁，出现亮框后捏合打开。');
html=html.replace('打开摄像头，把手放在镜头前，保持片刻。','打开摄像头，伸出手掌；手势保持一小会儿即可识别。');
html=html.replace('也可以使用底部按钮。拖动旋转、滚轮缩放；空格切换聚散，H 隐藏界面。','张开手掌移动，可以转动视角；两手拉开放大、靠拢缩小。查看照片时，张掌左右轻挥可切换，握拳关闭。也可以拖动旋转、滚轮缩放，按空格切换聚散，H 隐藏界面。');
await writeFile('index.html',html);
