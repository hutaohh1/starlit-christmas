import { PhotoFocus } from './gestures.js';
import { getEdition } from './editions.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createParticleData, createRibbonData, seededRandom, treeRadius, TREE_BOTTOM, TREE_HEIGHT } from './particles.js';

const vertexShader=`
attribute vec3 aScatter; attribute float aSize; attribute float aPhase;
uniform float uTime; uniform float uSpread; uniform float uPixelRatio; uniform float uMotion; uniform float uCinematic;
varying vec3 vColor; varying float vShimmer; varying float vSparkle;
void main(){
  vec3 pos=mix(position,aScatter,uSpread);
  pos.x+=sin(uTime*.5+aPhase+position.y)*.025*uMotion;
  pos.y+=sin(uTime*.65+aPhase)*(.018+uSpread*.12)*uMotion;
  vec4 mv=modelViewMatrix*vec4(pos,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp(aSize*(270./max(1.,-mv.z))*uPixelRatio,1.,35.);
  float side=dot(normalize(vec3(position.x,.35,position.z)),normalize(vec3(-.4,.6,1.))); float lit=.48+.52*max(0.,side); vColor=color*mix(1.,lit,uCinematic); vColor+=vec3(.1,.23,.32)*pow(max(0.,-side),2.)*uCinematic; vSparkle=step(.987,fract(aPhase*13.));
  vShimmer=.72+.28*sin(uTime*1.4+aPhase*4.);
}`;
const fragmentShader=`
uniform float uBrightness; uniform vec3 uTint;
varying vec3 vColor; varying float vShimmer; varying float vSparkle;
void main(){
  float r=length(gl_PointCoord-.5)*2.; if(r>1.)discard;
  float halo=exp(-r*r*5.5), core=exp(-r*r*38.); vec2 p=abs(gl_PointCoord-.5)*2.; float ray=(exp(-p.x*50.)*exp(-p.y*4.)+exp(-p.y*50.)*exp(-p.x*4.))*vSparkle*.22; halo+=ray; core+=ray;
  gl_FragColor=vec4(vColor*uTint*uBrightness*(.72+core*1.8)*vShimmer,halo*.82);
}`;
function softTexture(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#fff8da');g.addColorStop(.1,'#ffe9a9dd');g.addColorStop(.3,'#e8ba6555');g.addColorStop(1,'#e8ba6500');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
export class ChristmasScene{
  constructor(container,{onReady,onPhoto,onError,edition=3}){
    Object.assign(this,{container,onReady,onPhoto,onError});this.edition=getEdition(edition);const style=this.edition;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.autoRotate=!this.reduced;this.snowEnabled=!this.reduced;this.mode='tree';this.spread=1;this.targetSpread=0;this.photos=[];this.photoGroups=[];this.particleMaterials=[];this.ornaments=[];this.elapsed=0;this.handTracked=false;this.handCameraY=0;this.handSensitivity=1;this.hoverIndex=null;this.random=seededRandom(88);this.pointer=new THREE.Vector2();this.raycaster=new THREE.Raycaster();this.tmp=new THREE.Vector3();
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#070d15');this.scene.fog=new THREE.FogExp2('#070d15',.024);
    this.camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,.1,90);
    this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.setSize(innerWidth,innerHeight);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=style.exposure;
    this.renderer.domElement.setAttribute('aria-label','拖动旋转圣诞树，滚轮缩放，点击相框查看照片');container.appendChild(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.06;this.controls.enablePan=false;this.controls.minDistance=8;this.controls.maxDistance=22;this.controls.minPolarAngle=Math.PI*.31;this.controls.maxPolarAngle=Math.PI*.55;this.controls.rotateSpeed=.55;this.controls.zoomSpeed=.6;this.controls.target.set(0,.45,0);this.controls.addEventListener('start',()=>this.isInteracting=true);this.controls.addEventListener('end',()=>this.isInteracting=false);
    this.tree=new THREE.Group();this.scene.add(this.tree);
    this.scene.add(new THREE.AmbientLight('#9aafb8',style.ambient));const hemi=new THREE.HemisphereLight('#e5edff','#142028',style.hemisphere);this.scene.add(hemi);
    const key=new THREE.DirectionalLight('#ffdf9c',style.key);key.position.set(3,6,5);this.scene.add(key);const fill=new THREE.PointLight('#f2c175',style.fill,15,2);fill.position.set(0,1,3);this.scene.add(fill);const rim=new THREE.PointLight('#91b9d3',25,20,2);rim.position.set(-5,3,-4);this.scene.add(rim);
    this.buildGround();this.buildParticles();this.buildStar();if(style.rays)this.buildStarRays();if(style.stardust)this.buildStardust();this.buildOrnaments();this.buildGifts();this.buildSnow();this.buildStars();if(style.cinematic)this.buildCinematicLighting(key);
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),style.bloom,style.bloomRadius,style.bloomThreshold);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    this.resize();this.boundResize=()=>this.resize();addEventListener('resize',this.boundResize);
    this.renderer.domElement.addEventListener('pointerdown',e=>this.down={x:e.clientX,y:e.clientY});this.renderer.domElement.addEventListener('pointerup',e=>{if(this.down&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)<8)this.pickPhoto(e.clientX/innerWidth,e.clientY/innerHeight,true);});
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(this.frame);this.onError(new Error('画面连接中断，请刷新网页恢复。'));});
    this.last=performance.now();this.animate();setTimeout(()=>onReady(),650);
  }
  makeParticles(data){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geo.setAttribute('aScatter',new THREE.BufferAttribute(data.scatter,3));geo.setAttribute('color',new THREE.BufferAttribute(data.colors,3));geo.setAttribute('aSize',new THREE.BufferAttribute(data.sizes,1));geo.setAttribute('aPhase',new THREE.BufferAttribute(data.phases,1));const mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uSpread:{value:1},uPixelRatio:{value:this.renderer.getPixelRatio()},uBrightness:{value:this.edition.cinematic?1.05:1.2},uTint:{value:new THREE.Vector3(1,1,1)},uMotion:{value:this.reduced?0:1},uCinematic:{value:this.edition.cinematic?1:0}},vertexShader,fragmentShader,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});this.particleMaterials.push(mat);const points=new THREE.Points(geo,mat);points.frustumCulled=false;this.tree.add(points);return points;}
  buildParticles(){this.particles=this.makeParticles(createParticleData(innerWidth<760?this.edition.mobileCount:this.edition.count,1225,this.edition.cinematic));this.ribbon=this.makeParticles(createRibbonData(3400));const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.16,.24,.7,12),new THREE.MeshStandardMaterial({color:'#5e4128',roughness:.9}));trunk.position.y=-2.78;this.tree.add(trunk);}
  buildGround(){const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#1b2931',roughness:1,metalness:.1}));ground.rotation.x=-Math.PI/2;ground.position.y=-3.13;this.scene.add(ground);this.ground=ground;const snow=new THREE.Mesh(new THREE.CylinderGeometry(3.55,3.65,.09,100),new THREE.MeshStandardMaterial({color:this.edition.snowColor,roughness:.96,metalness:.05}));snow.position.y=-3.075;this.scene.add(snow);this.snowPlatform=snow;const glow=new THREE.Mesh(new THREE.PlaneGeometry(9,9),new THREE.MeshBasicMaterial({map:softTexture(),transparent:true,opacity:this.edition.groundGlow,depthWrite:false,blending:THREE.AdditiveBlending}));glow.rotation.x=-Math.PI/2;glow.position.y=-3.01;this.scene.add(glow);const ring=new THREE.Mesh(new THREE.RingGeometry(3.54,3.56,128),new THREE.MeshBasicMaterial({color:'#d4bf88',transparent:true,opacity:.16,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-3.016;this.scene.add(ring);const contact=new THREE.Mesh(new THREE.PlaneGeometry(4,4),new THREE.MeshBasicMaterial({map:softTexture(),color:'#101815',transparent:true,opacity:.8,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-3.008;this.scene.add(contact);}
  buildCinematicLighting(key){
    // Warm key and cool rim separate the gold canopy from the night.
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    key.position.set(-3.5,7,5);key.castShadow=true;const shadowSize=innerWidth<760?1024:2048;key.shadow.mapSize.set(shadowSize,shadowSize);
    Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.1,far:24});
    key.shadow.bias=-.001;key.shadow.normalBias=.035;key.shadow.radius=5;
    this.ground.receiveShadow=true;this.snowPlatform.receiveShadow=true;
    this.tree.traverse(object=>{if(object.isMesh&&object.material.isMeshStandardMaterial){object.castShadow=true;object.receiveShadow=true;}});
    const rim=new THREE.DirectionalLight('#8dbfee',1.8);rim.position.set(4,4,-5);this.scene.add(rim);
    const warm=new THREE.SpotLight('#ffdc9e',75,23,.58,.9,1.6);warm.position.set(-3,7,3);warm.target.position.set(0,-2.8,0);this.scene.add(warm,warm.target);
    const groundTexture=document.createElement('canvas');groundTexture.width=groundTexture.height=512;
    const ctx=groundTexture.getContext('2d'),gradient=ctx.createRadialGradient(205,190,0,256,256,310);
    gradient.addColorStop(0,'#d5d6cb');gradient.addColorStop(.35,'#bec8c8');gradient.addColorStop(.75,'#7a94a2');gradient.addColorStop(1,'#3f5a6c');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,512,512);
    for(let i=0;i<14000;i++){const g=Math.round(this.random()*90+150);ctx.fillStyle=`rgba(${g},${g},${g},.065)`;ctx.fillRect(this.random()*512,this.random()*512,1.3,1.3);}
    const surface=new THREE.CanvasTexture(groundTexture);surface.colorSpace=THREE.SRGBColorSpace;
    this.snowPlatform.material.map=surface;this.snowPlatform.material.color.set('#a8b2b5');this.snowPlatform.material.roughness=.67;this.snowPlatform.material.metalness=.16;this.snowPlatform.material.needsUpdate=true;
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
    const shadowCtx=shadowCanvas.getContext('2d'),shadowGradient=shadowCtx.createRadialGradient(64,64,4,64,64,64);
    shadowGradient.addColorStop(0,'#000000b8');shadowGradient.addColorStop(.45,'#00000070');shadowGradient.addColorStop(1,'#00000000');shadowCtx.fillStyle=shadowGradient;shadowCtx.fillRect(0,0,128,128);
    const contact=new THREE.Mesh(new THREE.PlaneGeometry(3.4,3.4),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false,opacity:.7}));contact.rotation.x=-Math.PI/2;contact.position.set(0,-2.998,0);this.scene.add(contact);
    // Low-opacity atmosphere catches light without washing out the particles.
    const atmosphereTexture=document.createElement('canvas');atmosphereTexture.width=atmosphereTexture.height=256;
    const ac=atmosphereTexture.getContext('2d'),ag=ac.createRadialGradient(128,128,0,128,128,128);ag.addColorStop(0,'#ffffff66');ag.addColorStop(.35,'#ffffff27');ag.addColorStop(1,'#ffffff00');ac.fillStyle=ag;ac.fillRect(0,0,256,256);
    const atmosphereMap=new THREE.CanvasTexture(atmosphereTexture);
    const addHalo=(color,position,scale,opacity)=>{const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:atmosphereMap,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));sprite.position.set(...position);sprite.scale.set(...scale);this.scene.add(sprite);};
    addHalo('#dfae61',[.1,1.3,-2.5],[9,11,1],.17);addHalo('#427db2',[-4,1,-4],[9,10,1],.24);addHalo('#abc4df',[4,-1,-4],[8,5,1],.09);
    const reflection=new THREE.Mesh(new THREE.PlaneGeometry(3,6),new THREE.MeshBasicMaterial({map:atmosphereMap,color:'#f5d49b',transparent:true,opacity:.19,depthWrite:false,blending:THREE.AdditiveBlending}));reflection.rotation.x=-Math.PI/2;reflection.position.set(0,-2.994,1);this.scene.add(reflection);
    const dustPositions=[];for(let i=0;i<450;i++){const angle=this.random()*Math.PI*2,r=Math.sqrt(this.random())*3.4;dustPositions.push(Math.cos(angle)*r,-2.99+this.random()*.015,Math.sin(angle)*r);}
    const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dustPositions,3));const floorDust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:'#d5c493',size:.017,map:softTexture(),transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));this.scene.add(floorDust);
  }
  buildStar(){const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.135:.3,x=Math.cos(a)*r,y=Math.sin(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.02});this.star=new THREE.Group();const body=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:'#ffe4a0',emissive:'#e4ac40',emissiveIntensity:this.edition.starEmission,metalness:.65,roughness:.2}));this.star.add(body);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:softTexture(),transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false}));sprite.scale.set(this.edition.starSize,this.edition.starSize,1);this.star.add(sprite);this.star.position.y=4.03;this.tree.add(this.star);const starLight=new THREE.PointLight('#ffda81',12,5,2);starLight.position.y=3.9;this.tree.add(starLight);this.starGlow=sprite;}
  buildStarRays(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.translate(128,128);
    for(let i=0;i<4;i++){
      ctx.save();ctx.rotate(i*Math.PI/2);
      const gradient=ctx.createLinearGradient(0,0,0,112);
      gradient.addColorStop(0,'#fff4cebb');gradient.addColorStop(.2,'#ffe7ad55');gradient.addColorStop(1,'#ffe7ad00');
      ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(0,115);ctx.lineTo(3,0);ctx.fill();ctx.restore();
    }
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));
    sprite.scale.set(2,2,1);this.star.add(sprite);
  }
  buildStardust(){
    const count=800,positions=new Float32Array(count*3),scatter=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),phases=new Float32Array(count);
    for(let i=0;i<count;i++){
      const t=this.random(),angle=this.random()*Math.PI*2,r=treeRadius(t)+.2+Math.pow(this.random(),2)*1.1;
      positions.set([Math.cos(angle)*r,TREE_BOTTOM+t*TREE_HEIGHT,Math.sin(angle)*r],i*3);
      scatter.set([(this.random()-.5)*15,(this.random()-.5)*9,(this.random()-.5)*9],i*3);
      colors.set([1.1,.84,.43],i*3);sizes[i]=.025+Math.pow(this.random(),5)*.21;phases[i]=this.random()*6.28;
    }
    this.makeParticles({positions,scatter,colors,sizes,phases});
  }
  buildOrnaments(){const random=this.random;const mats=['#bd9b56','#843336','#718c74','#d4bd84'].map(color=>new THREE.MeshStandardMaterial({color,metalness:.78,roughness:.22}));const sphere=new THREE.SphereGeometry(1,12,10),cube=new THREE.BoxGeometry(1,1,1);for(let i=0;i<this.edition.ornaments;i++){const t=.05+random()*.84,a=random()*Math.PI*2,r=treeRadius(t)*1.025;const mesh=new THREE.Mesh(i%5? sphere:cube,mats[i%4]);const size=.035+random()*.063;mesh.scale.setScalar(size);const origin=new THREE.Vector3(Math.cos(a)*r,TREE_BOTTOM+t*TREE_HEIGHT,Math.sin(a)*r);const scatter=new THREE.Vector3((random()-.5)*12,(random()-.5)*7+.5,(random()-.5)*8);mesh.position.copy(origin);this.tree.add(mesh);this.ornaments.push({mesh,origin,scatter,phase:random()*6});}}
  buildGifts(){const random=this.random;const mats=['#6d2932','#c2a574','#23483f','#b3b0a1'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.2}));const ribbonMat=new THREE.MeshStandardMaterial({color:'#e9d1a0',metalness:.55,roughness:.3});for(let i=0;i<14;i++){const group=new THREE.Group(),w=.25+random()*.3,h=.2+random()*.32,d=.25+random()*.27;const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[i%4]);box.position.y=h/2;group.add(box);for(const dims of [[w+.015,h+.018,.045],[.045,h+.018,d+.015]]){const ribbon=new THREE.Mesh(new THREE.BoxGeometry(...dims),ribbonMat);ribbon.position.y=h/2;group.add(ribbon);}const bow=new THREE.Mesh(new THREE.TorusGeometry(.055,.013,5,12),ribbonMat);bow.position.set(-.04,h+.035,0);bow.rotation.x=Math.PI/2;bow.scale.x=1.3;group.add(bow);const bow2=bow.clone();bow2.position.x=.04;group.add(bow2);const a=i/14*Math.PI*2,r=1.75+random()*.95;group.position.set(Math.cos(a)*r,-3.01,Math.sin(a)*r);group.rotation.y=random()*Math.PI;this.tree.add(group);}}
  buildSnow(){const count=900,positions=new Float32Array(count*3),sizes=new Float32Array(count);for(let i=0;i<count;i++){positions.set([(this.random()-.5)*32,this.random()*18-6,(this.random()-.5)*28],i*3);sizes[i]=.02+this.random()*.03;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));const tex=softTexture();this.snow=new THREE.Points(geo,new THREE.PointsMaterial({color:'#b8d0df',size:.037,map:tex,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending}));this.snow.frustumCulled=false;this.scene.add(this.snow);this.snowPositions=positions;}
  buildStars(){const positions=[];for(let i=0;i<420;i++){positions.push((this.random()-.5)*70,this.random()*32-4,-12-this.random()*25);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const stars=new THREE.Points(geo,new THREE.PointsMaterial({color:'#b3c9d7',size:.035,transparent:true,opacity:.65,map:softTexture(),depthWrite:false}));this.scene.add(stars);}
  async setPhotos(photos){
    this.resetPhotoFocus();
    for(const g of this.photoGroups){this.tree.remove(g);g.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});}
    this.photos=photos;this.photoGroups=[];
    const textureLoader=new THREE.TextureLoader();
    const materials=await Promise.all(photos.map(async photo=>{const texture=await textureLoader.loadAsync(photo.src);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;const aspect=texture.image.width/texture.image.height,target=.76/.91;if(aspect>target){texture.repeat.x=target/aspect;texture.offset.x=(1-texture.repeat.x)/2;}else{texture.repeat.y=aspect/target;texture.offset.y=(1-texture.repeat.y)/2;}return new THREE.MeshBasicMaterial({map:texture,toneMapped:false});}));
    for(let i=0;i<photos.length;i++){const photo=photos[i],group=new THREE.Group();const frame=new THREE.Mesh(new THREE.BoxGeometry(.93,1.16,.07),new THREE.MeshStandardMaterial({color:this.edition.frameColor,metalness:.65,roughness:.3}));group.add(frame);const backing=new THREE.Mesh(new THREE.PlaneGeometry(.85,1.08),new THREE.MeshBasicMaterial({color:this.edition.paperColor}));backing.position.z=.038;group.add(backing);const image=new THREE.Mesh(new THREE.PlaneGeometry(.76,.91),materials[i]);image.position.set(0,.035,.043);image.userData.photoIndex=i;group.add(image);const a=i/photos.length*Math.PI*2+.45,t=.15+(i%5)/5*.7,r=treeRadius(t)+.18;group.userData={index:i,tree:new THREE.Vector3(Math.cos(a)*r,TREE_BOTTOM+t*TREE_HEIGHT,Math.sin(a)*r),scatter:new THREE.Vector3(Math.cos(a)* (3.2+(i%3)*.7),-.8+(i%4)*1.23,Math.sin(a)*2.4+1),phase:i*.9};group.scale.setScalar(this.edition.frameScale);this.photoGroups.push(group);this.tree.add(group);}
  }
  setMode(mode){this.resetPhotoFocus();this.mode=mode;this.targetSpread=mode==='tree'?0:1;}
  setTheme(theme){const tint=({gold:[1,1,1],ice:[.43,.94,1.65],rose:[1.3,.66,.79]})[theme]||[1,1,1];this.particleMaterials.forEach(m=>m.uniforms.uTint.value.set(...tint));this.starGlow.material.color.setRGB(...tint);}
  setGlow(value){this.bloom.strength=.17+value*.5;this.particleMaterials.forEach(m=>m.uniforms.uBrightness.value=.55+value*.9);}
  applyHandFrame(frame){
    this.handTracked=!!frame.tracked;
    if(!frame.tracked){this.resetPhotoFocus();return;}
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
  resetPhotoFocus(){this.photoFocus?.reset();this.hoverIndex=null;}
  hoverPhotoAt(frame){
    this.photoFocus??=new PhotoFocus();
    if(!frame.point){this.resetPhotoFocus();return null;}
    this.tree.updateWorldMatrix(true,true);this.camera.updateMatrixWorld();
    const candidates=this.photoGroups.map(group=>{
      const projected=group.getWorldPosition(new THREE.Vector3()).project(this.camera);
      const corners=[[-.465,-.58],[.465,-.58],[.465,.58],[-.465,.58]].map(([x,y])=>new THREE.Vector3(x,y,.04).applyMatrix4(group.matrixWorld).project(this.camera));
      const xs=corners.map(p=>(p.x+1)/2),ys=corners.map(p=>(1-p.y)/2);
      return {index:group.userData.index,x:(projected.x+1)/2,y:(1-projected.y)/2,visible:projected.z>-1&&projected.z<1,bounds:{left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)}};
    });
    const target=this.photoFocus.update(frame,candidates,innerWidth,innerHeight,performance.now());
    this.hoverIndex=target?.index??null;return target;
  }
  pickPhoto(x=.5,y=.5,requireHit=false){if(!this.photoGroups.length)return null;this.pointer.set(x*2-1,-y*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const intersections=this.raycaster.intersectObjects(this.photoGroups,true);let index;if(intersections.length){let obj=intersections[0].object;while(obj.parent&&obj.userData.index===undefined)obj=obj.parent;index=obj.userData.index;}else if(!requireHit){let closest=Infinity;for(const group of this.photoGroups){group.getWorldPosition(this.tmp);this.tmp.project(this.camera);if(this.tmp.z>1||this.tmp.z< -1)continue;const d=Math.hypot(this.tmp.x-this.pointer.x,this.tmp.y-this.pointer.y);if(d<closest){closest=d;index=group.userData.index;}}}if(index!==undefined){this.onPhoto(index);return index;}return null;}
  resize(){const w=innerWidth,h=innerHeight,mobile=w<760;this.camera.aspect=w/h;this.camera.clearViewOffset();this.controls.target.set(0,mobile?1.1:.45,0);this.camera.position.set(0,mobile?2:1.1,mobile?Math.max(14.8,14.8*(.56/(w/h))):12.7);if(!mobile)this.camera.setViewOffset(w,h,-w*.115,0,w,h);this.camera.updateProjectionMatrix();this.controls.update();this.renderer.setSize(w,h);this.composer?.setSize(w,h);}
  animate=()=>{this.frame=requestAnimationFrame(this.animate);const now=performance.now(),dt=Math.min((now-this.last)/1000,.05);this.last=now;if(document.hidden)return;this.elapsed+=dt;const t=this.elapsed;this.spread=THREE.MathUtils.damp(this.spread,this.targetSpread,2.9,dt);if(this.autoRotate&&!this.handTracked&&!this.isInteracting&&!this.reduced)this.tree.rotation.y+=dt*(.085+this.spread*.025);this.controls.update();for(const mat of this.particleMaterials){mat.uniforms.uTime.value=this.reduced?0:t;mat.uniforms.uSpread.value=this.spread;}for(const {mesh,origin,scatter,phase}of this.ornaments){mesh.position.lerpVectors(origin,scatter,this.spread);if(!this.reduced){mesh.rotation.x=t*.17+phase;mesh.rotation.z=t*.12+phase;}}this.star.lookAt(this.camera.position);this.star.rotateY(this.reduced?0:Math.sin(t*.5)*.18);this.starGlow.material.opacity=this.edition.starGlow+(this.reduced?0:Math.sin(t*1.1)*.045);for(const group of this.photoGroups){const d=group.userData;group.position.lerpVectors(d.tree,d.scatter,this.spread);if(!this.reduced)group.position.y+=Math.sin(t*.6+d.phase)*.06*this.spread;const baseScale=THREE.MathUtils.lerp(this.edition.frameScale,this.mode==='memories'?1.05:.8,this.spread);const focusScale=1;group.scale.setScalar(THREE.MathUtils.damp(group.scale.x,baseScale*focusScale,9,dt));const frameMaterial=group.children[0].material;frameMaterial.emissive.set(this.hoverIndex===d.index?'#b78d39':'#000000');frameMaterial.emissiveIntensity=this.hoverIndex===d.index?.45:0;group.lookAt(this.camera.position);group.rotateZ(Math.sin(d.phase)*.12*this.spread);}this.snow.visible=this.snowEnabled;if(this.snowEnabled&&!this.reduced){for(let i=0;i<this.snowPositions.length;i+=3){this.snowPositions[i]+=(Math.sin(t*.25+i)*.04+.035)*dt;this.snowPositions[i+1]-=(.16+(i%9)*.019)*dt;if(this.snowPositions[i+1]< -4)this.snowPositions[i+1]=11;}this.snow.geometry.attributes.position.needsUpdate=true;}this.composer.render();};
}






