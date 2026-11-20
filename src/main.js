import './style.css';
import { ChristmasScene } from './scene.js';
import { HandController } from './gestures.js';
import { makePostcard, loadPhotos, readPhoto, savePhoto, deletePhoto } from './photos.js';
import { ChristmasMusic } from './music.js';

const $=id=>document.getElementById(id);
const paths={star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',sound:'<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',mute:'<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="m16 9 6 6m0-6-6 6"/>',settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="#070d15"/><circle cx="15" cy="17" r="2" fill="#070d15"/>',fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',palm:'<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 5-3 7-7 7-3 0-5-2-7-5l-3-4c-1.5-2 1-4 2.5-2L8 14"/>',fist:'<path d="M6 13V8a1.5 1.5 0 0 1 3 0v3-5a1.5 1.5 0 0 1 3 0v5-5a1.5 1.5 0 0 1 3 0v5-4a1.5 1.5 0 0 1 3 0v5c2-1 3 0 3 2l-1 4c-.5 3-3 4-7 4s-6-2-7-5l-2-3c-1-2 1-4 3-2l3 3"/>',pinch:'<path d="M11 11 8 5c-1-2-4-1-3 1l4 9-3-1c-3-1-4 2-2 3l7 4c4 2 8 0 9-3l1-6c0-3-3-3-3 0v2-4c0-2-3-2-3 0v3-4c0-2-3-2-3 0v3"/>',tree:'<path d="m12 2-5 7h3l-6 7h5l-3 4h12l-3-4h5l-6-7h3Z"/><path d="M12 20v2"/>',scatter:'<path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6Z"/><path d="m20 16 .7 2.3L23 19l-2.3.7L20 22l-.7-2.3L17 19l2.3-.7ZM3 3v4M1 5h4"/>',photo:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
for(const [id,name]of Object.entries({'sound-button':'mute','settings-button':'settings','fullscreen-button':'fullscreen','close-settings':'close','gesture-icon':'palm','fist-icon':'fist','palm-icon':'palm','pinch-icon':'pinch','tree-icon':'tree','scatter-icon':'scatter','memories-icon':'photo','upload-icon':'upload'}))$(id).innerHTML=icon(name);
let scene,mode='tree',photos=[],focusedIndex=0,toastTimeout,cameraBusy=false,cameraRequest=0,lastPinch=-Infinity,photoTarget=null,swipeAnchor=null,lastSwipe=0;
function musicState(state){
  const active=state==='playing';
  $('sound-button').innerHTML=icon(active?'sound':'mute');
  $('sound-button').setAttribute('aria-label',active?'暂停音乐':'播放本地音乐');
  $('sound-button').setAttribute('aria-pressed',String(active));
  $('sound-button').title=active?'暂停 Last Christmas':'播放 Last Christmas';
  $('music-play-pause').textContent=state==='loading'?'连接中…':active?'暂停':'播放';
  $('music-play-pause').disabled=state==='loading';
  const messages={loading:'正在读取本地音频…',playing:'本地播放中 · 结束后自动从头循环',paused:'已暂停 · 点击播放继续',error:'请放入 Taylor Swift《Last Christmas》的本地 MP3 / M4A，或点击下方选择文件。'};
  $('music-status').textContent=messages[state]||'';
}
const music=new ChristmasMusic({onTrack:name=>{$('music-file-name').textContent=name;},onState:musicState,onError:error=>toast(error.message,6500)});
const edition=Number(document.body.dataset.edition||3);
for(const link of document.querySelectorAll('[data-edition-link]')){if(Number(link.dataset.editionLink)===edition){link.classList.add('active');link.setAttribute('aria-current','page');}}
function toast(message,duration=3600){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),duration);}
function setMode(next,notify=false){mode=next;scene?.setMode(next);document.body.dataset.mode=next;document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});$('scene-status').textContent=({tree:'星光已为你点亮',scatter:'让回忆散落星河',memories:'好时光，正在闪烁'})[next];$('interaction-tip').textContent=next==='tree'?'拖动旋转 · 滚轮缩放 · 按空格散开':'点击相框查看回忆 · 拖动旋转 · 空格重聚';}
function openPhoto(index){if(!photos.length)return;scene?.resetPhotoFocus();photoTarget=null;focusedIndex=(index+photos.length)%photos.length;const photo=photos[focusedIndex];$('focused-photo').src=photo.src;$('focused-photo').alt=photo.caption;$('focused-caption').textContent=photo.caption;$('remove-photo').hidden=photo.isDefault;$('remove-photo').disabled=false;$('photo-position').textContent=`${focusedIndex+1} / ${photos.length}`;if(!$('photo-dialog').open)$('photo-dialog').showModal();}
function closePhoto(){$('photo-dialog').close();scene?.resetPhotoFocus();photoTarget=null;swipeAnchor=null;}
function updateCameraUI(enabled){$('gesture-button').classList.toggle('enabled',enabled);$('gesture-button-label').textContent=enabled?'手势魔法已开启':'开启手势魔法';$('gesture-button').setAttribute('aria-pressed',enabled);$('camera-panel').hidden=!enabled;$('privacy-note').textContent=enabled?'识别只在本机进行 · 点击按钮可关闭':'允许摄像头，试试隔空点亮圣诞';}
function stopCamera(){cameraRequest++;cameraBusy=false;hand.stop();updateCameraUI(false);$('gesture-button').disabled=false;}
function cameraError(error){stopCamera();const messages={NotAllowedError:'摄像头未获授权。请在浏览器地址栏允许摄像头，或使用底部按钮体验。',NotFoundError:'没有找到摄像头。你仍可以用鼠标、触屏和底部按钮体验。',NotReadableError:'摄像头正被其他程序占用，关闭占用程序后再试。'};toast(messages[error.name]||'手势模型加载失败，请刷新后重试。你仍可用底部按钮操作。',6500);console.warn('Hand tracking:',error);}
const hand=new HandController({
  video:$('camera-video'),canvas:$('hand-overlay'),onStatus:message=>{$('camera-status').textContent=message;},onError:cameraError,
  onFrame:frame=>{
    const cursor=$('gesture-cursor');
    cursor.hidden=!frame.tracked||$('guide-dialog').open||$('photo-dialog').open;
    if(!frame.tracked){scene?.applyHandFrame(frame);photoTarget=null;swipeAnchor=null;return;}
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
    photoTarget=frame.twoHands?null:scene?.hoverPhotoAt(frame);
    if(frame.twoHands)scene?.resetPhotoFocus();
    cursor.classList.toggle('targeting',!!photoTarget);cursor.classList.toggle('pinching',frame.pinching);
    $('gesture-cursor-label').textContent=photoTarget?(frame.pinching?'已锁定 · ':'捏合打开 · ')+photos[photoTarget.index]?.caption:frame.gesture==='point'?'靠近一张照片':'';
    if(frame.intent==='fist'){setMode('tree');return;}
    if(frame.intent==='palm'&&mode==='tree'){setMode('scatter');return;}
    if(frame.intent==='pinch'&&performance.now()-lastPinch>650){
      lastPinch=performance.now();
      if(photoTarget){openPhoto(photoTarget.index);swipeAnchor=null;}
      else if(mode==='tree'){setMode('memories');}

    }
  }
});
$('gesture-button').addEventListener('click',async()=>{if(hand.active){stopCamera();return;}if(cameraBusy)return;cameraBusy=true;const request=++cameraRequest;$('gesture-button').disabled=true;$('gesture-button-label').textContent='正在唤醒手势魔法…';$('privacy-note').textContent='首次开启需要加载本地识别模型';try{await hand.start();if(request!==cameraRequest)return;updateCameraUI(true);}catch(error){cameraError(error);}finally{if(request===cameraRequest){cameraBusy=false;$('gesture-button').disabled=false;}}});
$('close-camera').addEventListener('click',stopCamera);
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{closePhoto();setMode(button.dataset.mode,true);});
$('guide-button').addEventListener('click',()=>$('guide-dialog').showModal());$('close-guide').addEventListener('click',()=>$('guide-dialog').close());$('guide-done').addEventListener('click',()=>$('guide-dialog').close());$('close-photo').addEventListener('click',closePhoto);
let removingPhoto=false;
$('remove-photo').addEventListener('click',async()=>{
  const photo=photos[focusedIndex];if(removingPhoto||!photo||photo.isDefault)return;
  removingPhoto=true;$('remove-photo').disabled=true;
  try{
    await deletePhoto(photo.id);
    photos=photos.filter(item=>item.id!==photo.id);
    closePhoto();$('photo-count').textContent=photos.length;
    await scene?.setPhotos(photos);toast('这张照片已摘下。');
  }catch(error){console.warn('Remove photo:',error);toast('照片暂时无法摘下，请重试。');}
  finally{removingPhoto=false;$('remove-photo').disabled=false;}
});
$('next-photo').addEventListener('click',()=>openPhoto(focusedIndex+1));$('previous-photo').addEventListener('click',()=>openPhoto(focusedIndex-1));
for(const dialog of [$('guide-dialog'),$('photo-dialog')])dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
function toggleSettings(force){const show=force??$('settings-panel').hidden;if(show)$('music-panel').hidden=true;$('settings-panel').hidden=!show;$('settings-button').setAttribute('aria-expanded',show);}
$('settings-button').addEventListener('click',()=>toggleSettings());$('close-settings').addEventListener('click',()=>toggleSettings(false));
$('hand-sensitivity').addEventListener('input',e=>{if(scene)scene.handSensitivity=Number(e.target.value)/100;$('hand-sensitivity-value').textContent=e.target.value+'%';});
$('snow-toggle').addEventListener('change',e=>{if(scene)scene.snowEnabled=e.target.checked;});$('rotate-toggle').addEventListener('change',e=>{if(scene)scene.autoRotate=e.target.checked;});
$('glow-range').addEventListener('input',e=>{$('glow-value').textContent=`${e.target.value}%`;scene?.setGlow(Number(e.target.value)/100);});
for(const button of document.querySelectorAll('[data-theme]'))button.addEventListener('click',()=>{scene?.setTheme(button.dataset.theme);document.querySelectorAll('[data-theme]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});});
function toggleUI(force){const hide=force??!document.body.classList.contains('ui-hidden');document.body.classList.toggle('ui-hidden',hide);$('show-ui-button').hidden=!hide;}
$('hide-ui-button').addEventListener('click',()=>{toggleSettings(false);toggleUI(true);});$('show-ui-button').addEventListener('click',()=>toggleUI(false));
$('fullscreen-button').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器不支持全屏，可以按 H 隐藏界面赏树。');}});
document.addEventListener('fullscreenchange',()=>{const label=document.fullscreenElement?'退出全屏':'进入全屏';$('fullscreen-button').setAttribute('aria-label',label);$('fullscreen-button').title=label;});
async function toggleMusic(){
  $('music-panel').hidden=false;toggleSettings(false);
  try{if(music.playing||music.pending)music.stop();else await music.start();}catch(error){toast(error.message,6500);}
}
$('sound-button').addEventListener('click',toggleMusic);
$('music-play-pause').addEventListener('click',toggleMusic);
$('close-music-panel').addEventListener('click',()=>{$('music-panel').hidden=true;});
$('music-volume').addEventListener('input',e=>music.setVolume(Number(e.target.value)));
$('local-music-button').addEventListener('click',()=>$('local-music-input').click());
$('local-music-input').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const name=await music.useLocalFile(file);$('music-status').textContent=name+' · 已在本机播放，默认循环';toast('歌曲已开始循环播放。');}catch(error){toast(error.message||'音频无法播放，请尝试 MP3 或 M4A 格式。');}e.target.value='';});
$('upload-button').addEventListener('click',()=>$('photo-input').click());
$('photo-input').addEventListener('change',async e=>{const files=[...e.target.files];if(!files.length)return;const userPhotos=photos.filter(p=>!p.isDefault);const remaining=Math.max(0,24-userPhotos.length);if(!remaining){toast('已经挂上 24 张照片啦，本次先欣赏这些回忆吧。');e.target.value='';return;}$('upload-button').disabled=true;let added=0,notSaved=false,lastError;for(const file of files.slice(0,remaining)){try{const photo=await readPhoto(file);userPhotos.push(photo);added++;try{await savePhoto(photo);}catch{notSaved=true;}}catch(error){lastError=error;}}if(added){photos=[...userPhotos,...photos.filter(p=>p.isDefault)];try{await scene?.setPhotos(photos);$('photo-count').textContent=photos.length;setMode('memories');toast(`已把 ${added} 个瞬间挂上星河。${notSaved?'浏览器存储空间不足，部分照片仅在本次保留。':'照片已保存在此浏览器。'}`,5500);}catch{toast('照片展示失败，请刷新网页重试。');}}else if(lastError)toast(lastError.message,5000);if(files.length>remaining)setTimeout(()=>toast('最多保留 24 张自己的照片，本次只添加可容纳的部分。'),5600);$('upload-button').disabled=false;e.target.value='';});
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName))return;if($('photo-dialog').open){if(e.key==='ArrowRight')openPhoto(focusedIndex+1);if(e.key==='ArrowLeft')openPhoto(focusedIndex-1);return;}if($('guide-dialog').open)return;if(e.code==='Space'){e.preventDefault();setMode(mode==='tree'?'scatter':'tree');}if(e.key.toLowerCase()==='h')toggleUI();if(e.key==='Escape')toggleSettings(false);});
addEventListener('pagehide',()=>{hand.stop();music.stop();});
async function init(){try{photos=[...await loadPhotos(),...Array.from({length:6},(_,i)=>makePostcard(i))];$('photo-count').textContent=photos.length;scene=new ChristmasScene($('scene'),{edition,onReady:()=>{$('loading-screen').classList.add('loaded');setMode('tree');},onPhoto:openPhoto,onError:error=>toast(error.message,8000)});await scene.setPhotos(photos);if(scene.reduced){$('snow-toggle').checked=false;$('rotate-toggle').checked=false;}$('scene-status').textContent='星光已为你点亮';}catch(error){console.error(error);$('loading-screen').classList.add('failed');$('loading-screen').replaceChildren();const star=document.createElement('span');star.className='loading-star';star.textContent='✦';const text=document.createElement('span');text.textContent='星光暂时无法点亮。请使用支持 WebGL 的 Chrome 或 Edge，并开启硬件加速后刷新。';$('loading-screen').append(star,text);}}
init();

