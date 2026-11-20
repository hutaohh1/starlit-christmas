import { assetUrl } from './assets.js';
const distance = (a, b) => Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const palmCenter = hand => [0,5,9,13,17].reduce((p,i)=>({x:p.x+hand[i].x/5,y:p.y+hand[i].y/5}),{x:0,y:0});

export function classifyHand(landmarks,wasPinching=false) {
  if(!landmarks||landmarks.length!==21||landmarks.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return {gesture:'none',pinch:false,extended:0,pinchRatio:1};
  const palm=Math.max(distance(landmarks[5],landmarks[17]),.02);
  let extended=0;
  for(const [mcp,pip,tip]of [[5,6,8],[9,10,12],[13,14,16],[17,18,20]]){
    if(distance(landmarks[tip],landmarks[0])>distance(landmarks[pip],landmarks[0])*1.1&&distance(landmarks[tip],landmarks[mcp])>distance(landmarks[pip],landmarks[mcp])*1.35)extended++;
  }
  const pinchRatio=distance(landmarks[4],landmarks[8])/palm;
  // A curled fist often brings thumb and index together. Require the index to reach away from its knuckle.
  const indexReach=distance(landmarks[8],landmarks[5])/palm;
  const pinch=pinchRatio<(wasPinching?.47:.31)&&(indexReach>.5||extended>=2);
  return {gesture:pinch?'pinch':extended>=3?'palm':extended===0?'fist':extended===1?'point':'none',pinch,extended,pinchRatio,palmSize:palm};
}

export class GestureStabilizer {
  constructor(holdMs=180){this.holdMs=holdMs;this.reset();}
  duration(gesture){return typeof this.holdMs==='number'?this.holdMs:(this.holdMs[gesture]??220);}
  update(gesture,timestamp){
    if(gesture!==this.candidate){this.candidate=gesture;this.since=timestamp;}
    if(timestamp-this.since>=this.duration(gesture)&&this.current!==gesture){this.current=gesture;return gesture;}
    return null;
  }
  progress(timestamp){return this.candidate==='none'||this.candidate==='point'?0:clamp((timestamp-this.since)/this.duration(this.candidate),0,1);}
  reset(){this.candidate='none';this.current='none';this.since=0;}
}

// A speed-adaptive low pass keeps a resting hand quiet while letting deliberate motion catch up quickly.
export class AdaptivePointFilter {
  constructor(){this.reset();}
  reset(){this.point=null;this.timestamp=null;}
  update(point,timestamp){
    if(!this.point||timestamp-this.timestamp>300){this.point={...point};this.timestamp=timestamp;return {...point};}
    const dt=clamp((timestamp-this.timestamp)/1000,.008,.15),speed=Math.hypot(point.x-this.point.x,point.y-this.point.y)/dt;
    const cutoff=1.4+Math.min(10,speed*9),alpha=1-Math.exp(-Math.PI*2*cutoff*dt);
    this.point={x:this.point.x+(point.x-this.point.x)*alpha,y:this.point.y+(point.y-this.point.y)*alpha};this.timestamp=timestamp;return {...this.point};
  }
}

export class HandInteraction {
  constructor(){this.pointerFilter=new AdaptivePointFilter();this.palmFilter=new AdaptivePointFilter();this.stabilizer=new GestureStabilizer({palm:260,fist:320,pinch:130,point:150,none:220});this.reset();}
  reset(){this.pointerFilter.reset();this.palmFilter.reset();this.stabilizer.reset();this.anchor=null;this.lastSeen=null;this.lastCenter=null;this.zoomDistance=null;this.lastPinch=false;this.pinchArmed=false;this.releaseSince=null;this.reacquiredAt=null;this.wasTwoHands=false;this.pinchSince=null;}
  process(hands,timestamp){
    const valid=hands.filter(hand=>hand?.length===21&&hand.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    if(!valid.length){
      if(this.lastSeen!==null&&timestamp-this.lastSeen>280){this.anchor=null;this.lastCenter=null;this.zoomDistance=null;this.lastPinch=false;this.pinchArmed=false;this.releaseSince=null;this.stabilizer.reset();this.pointerFilter.reset();this.palmFilter.reset();this.reacquiredAt=null;}
      return {tracked:false,gesture:'none',rotationDelta:0,verticalDelta:0,zoomFactor:1,progress:0,point:null,lostFor:this.lastSeen===null?Infinity:timestamp-this.lastSeen};
    }
    let primary=valid[0];
    if(this.lastCenter&&valid.length>1){primary=[...valid].sort((a,b)=>{const ca=palmCenter(a),cb=palmCenter(b);return Math.hypot(ca.x-this.lastCenter.x,ca.y-this.lastCenter.y)-Math.hypot(cb.x-this.lastCenter.x,cb.y-this.lastCenter.y);})[0];}
    const center=palmCenter(primary),gap=this.lastSeen===null?Infinity:timestamp-this.lastSeen;
    if(gap>280||(this.lastCenter&&Math.hypot(center.x-this.lastCenter.x,center.y-this.lastCenter.y)>.25)){
      this.anchor=null;this.zoomDistance=null;this.stabilizer.reset();this.pointerFilter.reset();this.palmFilter.reset();this.pinchArmed=false;this.releaseSince=null;this.reacquiredAt=timestamp;this.lastPinch=false;this.pinchSince=null;
    }
    this.lastSeen=timestamp;this.lastCenter=center;
    const pose=classifyHand(primary,this.lastPinch);this.lastPinch=pose.pinch;
    if(pose.palmSize<.045){this.anchor=null;this.zoomDistance=null;this.stabilizer.reset();return {tracked:false,tooFar:true,rotationDelta:0,verticalDelta:0,zoomFactor:1,progress:0,point:null};}
    const rawPoint=primary[8];
    const mapped={x:clamp((1-rawPoint.x-.12)/.76,0,1),y:clamp((rawPoint.y-.1)/.78,0,1)};
    const point=this.pointerFilter.update(mapped,timestamp),palm=this.palmFilter.update({x:1-center.x,y:center.y},timestamp);
    const frame={tracked:true,point,palm,gesture:pose.gesture,pinching:pose.pinch,pinchRatio:pose.pinchRatio,rotationDelta:0,verticalDelta:0,zoomFactor:1,progress:0,twoHands:false,primary};
    const other=valid.find(h=>h!==primary);
    if(other&&pose.extended>=3&&classifyHand(other).extended>=3){
      const otherCenter=palmCenter(other),span=Math.hypot(center.x-otherCenter.x,center.y-otherCenter.y);
      if(span>.16){frame.twoHands=true;if(this.zoomDistance!==null)frame.zoomFactor=clamp(Math.pow(this.zoomDistance/span,.85),.94,1.06);this.zoomDistance=span;this.anchor=null;this.stabilizer.reset();this.wasTwoHands=true;this.pinchArmed=false;this.releaseSince=null;return frame;}
    }
    this.zoomDistance=null;
    if(this.wasTwoHands){this.anchor=null;this.reacquiredAt=timestamp;this.wasTwoHands=false;this.stabilizer.reset();}
    if(!pose.pinch){this.pinchSince=null;if(this.releaseSince===null)this.releaseSince=timestamp;if(timestamp-this.releaseSince>=180)this.pinchArmed=true;}else{this.releaseSince=null;if(this.pinchSince===null)this.pinchSince=timestamp;}
    if(timestamp-this.reacquiredAt<220){this.anchor={...palm};return frame;}
    const gesture=pose.pinch&&!this.pinchArmed?'none':pose.gesture;
    const change=this.stabilizer.update(gesture,timestamp);frame.progress=this.stabilizer.progress(timestamp);
    if(change&&change!=='none'&&change!=='point'&&change!=='pinch')frame.intent=change;
    // Pinch is an independent one-shot action, rearmed by a full release.
    if(pose.pinch&&this.pinchArmed){frame.progress=clamp((timestamp-this.pinchSince)/130,0,1);if(frame.progress>=1){frame.intent='pinch';this.pinchArmed=false;}}
    if(!this.anchor)this.anchor={...palm};
    // Pointing selects a photo. An open palm steers the scene relative to its current angle.
    if(gesture==='palm'&&!pose.pinch){
      const dx=palm.x-this.anchor.x,dy=palm.y-this.anchor.y;
      if(Math.abs(dx)>.0035){frame.rotationDelta=clamp(dx-Math.sign(dx)*.0035,-.045,.045)*5.4;this.anchor.x=palm.x;}
      if(Math.abs(dy)>.005){frame.verticalDelta=clamp(dy-Math.sign(dy)*.005,-.03,.03)*1.4;this.anchor.y=palm.y;}
    }else this.anchor={...palm};
    return frame;
  }
}

// Hit-test the actual projected frame, without changing its visible size.
export function nearestPhotoTarget(point,candidates,width,height,maxDistance=0){
  if(!point)return null;
  let nearest=null,best=Infinity;
  for(const target of candidates){
    if(!target.visible)continue;
    const bounds=target.bounds||{left:target.x,right:target.x,top:target.y,bottom:target.y};
    if(bounds.right<0||bounds.left>1||bounds.bottom<0||bounds.top>1)continue;
    const dx=Math.max(bounds.left-point.x,0,point.x-bounds.right)*width;
    const dy=Math.max(bounds.top-point.y,0,point.y-bounds.bottom)*height;
    const distance=Math.hypot(dx,dy);
    const score=distance+Math.hypot((target.x-point.x)*width,(target.y-point.y)*height)*.001;
    if(distance<=maxDistance&&score<best){best=score;nearest={...target,distance};}
  }
  return nearest;
}

// Retain the highlighted photo while the fingers close, instead of chasing the moving fingertip.
export class PhotoFocus {
  constructor(){this.reset();}
  reset(){this.target=null;this.lastHover=-Infinity;this.wasPinching=false;this.locked=null;this.pinchStarted=0;}
  update(frame,candidates,width,height,timestamp){
    if(!frame.tracked||frame.twoHands||frame.gesture==='fist'){this.reset();return null;}
    if(frame.pinching){
      if(!this.wasPinching){
        this.locked=timestamp-this.lastHover<=450?this.target:null;
        this.pinchStarted=timestamp;
      }
      this.wasPinching=true;
      if(timestamp-this.pinchStarted>1500)return null;
      return candidates.find(target=>target.visible&&target.index===this.locked?.index)||null;
    }
    this.wasPinching=false;this.locked=null;
    const hit=nearestPhotoTarget(frame.point,candidates,width,height);
    if(hit){this.target=hit;this.lastHover=timestamp;return hit;}
    // Short tracking jitter can leave the frame just before the pinch begins.
    if(timestamp-this.lastHover<=180)return candidates.find(target=>target.visible&&target.index===this.target?.index)||null;
    this.target=null;return null;
  }
}

const connections=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
export class HandController {
  constructor({video,canvas,onFrame,onStatus,onError}){Object.assign(this,{video,canvas,onFrame,onStatus,onError});this.active=false;this.session=0;this.interaction=new HandInteraction();this.lastTime=-1;this.lastInference=0;this.status='';}
  report(message){if(this.status!==message){this.status=message;this.onStatus(message);}}
  async start(){
    if(this.active)return;
    const session=++this.session;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('请用 localhost 或 HTTPS 打开网页，才能使用摄像头。');
    this.report('正在准备手势魔法…');
    const {HandLandmarker,FilesetResolver}=await import('@mediapipe/tasks-vision');
    const fileset=await FilesetResolver.forVisionTasks(assetUrl('vision/wasm'));
    const landmarker=await HandLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:assetUrl('vision/hand_landmarker.task'),delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55});
    if(session!==this.session){landmarker.close();return;}
    this.landmarker=landmarker;this.report('等待摄像头授权…');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user',frameRate:{ideal:24,max:30}},audio:false});
      if(session!==this.session){stream.getTracks().forEach(t=>t.stop());landmarker.close();return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();if(session!==this.session)return;
      this.active=true;this.lastTime=-1;this.interaction.reset();this.report('伸出一只手，轻轻张开');this.loop();
    }catch(error){this.stop();throw error;}
  }
  loop=()=>{
    if(!this.active)return;
    this.frame=requestAnimationFrame(this.loop);const now=performance.now();
    if(document.hidden){if(!this.suspended){this.interaction.reset();this.onFrame({tracked:false,point:null});this.suspended=true;}return;}this.suspended=false;
    if(this.video.readyState<2||this.video.currentTime===this.lastTime||now-this.lastInference<45)return;
    this.lastTime=this.video.currentTime;this.lastInference=now;
    try{
      const result=this.landmarker.detectForVideo(this.video,now),frame=this.interaction.process(result.landmarks||[],now);
      this.draw(result.landmarks,frame.primary);this.onFrame(frame);
      if(!frame.tracked){this.report(frame.tooFar?'手再靠近一点，就能看清啦':'把手放进镜头 · 画面已停稳');return;}
      const messages={palm:'张掌散开 · 移动手掌转动',fist:'握拳聚拢 · 稍停片刻',pinch:'捏住照片 · 松开后再次选择',point:'食指选照片 · 捏合打开',none:'张掌、握拳，或用食指选照片'};
      this.report(frame.twoHands?'双手拉开放大 · 靠拢缩小':messages[frame.gesture]);
    }catch(error){this.stop();this.onError(error);}
  };
  draw(hands=[],primary){
    const {canvas}=this,w=this.video.videoWidth,h=this.video.videoHeight;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);
    for(const hand of hands){ctx.strokeStyle=hand===primary?'#e4c98ebb':'#9acbe3aa';ctx.lineWidth=2;for(const[a,b]of connections){ctx.beginPath();ctx.moveTo(hand[a].x*w,hand[a].y*h);ctx.lineTo(hand[b].x*w,hand[b].y*h);ctx.stroke();}ctx.fillStyle='#fff0ca';for(const p of hand){ctx.beginPath();ctx.arc(p.x*w,p.y*h,2.5,0,Math.PI*2);ctx.fill();}}
  }
  stop(){this.session++;this.active=false;cancelAnimationFrame(this.frame);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.srcObject=null;this.landmarker?.close();this.landmarker=null;this.interaction.reset();this.onFrame({tracked:false,point:null});}
}
