import { assetUrl } from './assets.js';
// Native, local-only playback. No iframe, streaming URL, or repeat toggle.
export const CHRISTMAS_TRACK={id:'user-video-c9a87e-loop-v1',title:'Last Christmas',artist:'Taylor Swift',sources:['/music/taylor-swift-last-christmas.ogg','/music/taylor-swift-last-christmas.mp3','/music/taylor-swift-last-christmas.m4a'].map(path=>assetUrl(path))};
const missingTrack='尚未放入 Taylor Swift《Last Christmas》本地音频，请选择这首歌的 MP3 或 M4A 文件。';
let database;
async function musicDb(){
  if(database)return database;
  database=await new Promise((resolve,reject)=>{const request=indexedDB.open('starlit-christmas-music',1);request.onupgradeneeded=()=>request.result.createObjectStore('tracks');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return database;
}
async function storedTrack(){
  try{const db=await musicDb();return await new Promise((resolve,reject)=>{const request=db.transaction('tracks').objectStore('tracks').get('background');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}catch{return null;}
}
async function saveTrack(file){const db=await musicDb();await new Promise((resolve,reject)=>{const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').put({blob:file,name:file.name,trackId:CHRISTMAS_TRACK.id},'background');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
export class ChristmasMusic{
  constructor({onState=()=>{},onError=()=>{},onTrack=()=>{},createAudio=src=>new Audio(src),readStored=storedTrack,persistTrack=saveTrack,sources=CHRISTMAS_TRACK.sources}={}){Object.assign(this,{onState,onError,onTrack,createAudio,readStored,persistTrack,sources});this.volume=35;this.playing=false;this.pending=false;this.request=0;}
  attach(src,name){
    this.audio?.pause();this.audio=this.createAudio(src);this.audio.loop=true;this.audio.preload='metadata';this.audio.volume=this.volume/100;
    this.audio.addEventListener('playing',()=>{this.playing=true;this.pending=false;this.onState('playing');});
    this.audio.addEventListener('pause',()=>{if(!this.pending){this.playing=false;this.onState('paused');}});
    this.audio.addEventListener('error',()=>{this.playing=false;this.pending=false;this.onState('error');});
    this.onTrack(name);return this.audio;
  }
  async ensureAudio(){
    if(this.audio)return this.audio;
    if(this.sourcePromise)return this.sourcePromise;
    this.sourcePromise=(async()=>{
      const saved=await this.readStored();
      if(this.audio)return this.audio;
      if(saved?.blob&&saved.trackId===CHRISTMAS_TRACK.id){this.localUrl=URL.createObjectURL(saved.blob);return this.attach(this.localUrl,saved.name);}
      for(const src of this.sources){
        try{
          if(src.endsWith('.ogg')){const probe=this.createAudio('');if(probe.canPlayType&&!probe.canPlayType('audio/ogg; codecs=vorbis'))continue;}
          const response=await fetch(src,{method:'HEAD'});
          if(this.audio)return this.audio;
          if(response.ok&&/^(audio\/|application\/octet-stream)/i.test(response.headers.get('content-type')||''))return this.attach(src,'Taylor Swift — Last Christmas');
        }catch{}
      }
      throw new Error(missingTrack);
    })();
    try{return await this.sourcePromise;}finally{this.sourcePromise=null;}
  }
  async start(){
    const request=++this.request;this.pending=true;this.onState('loading');
    try{const audio=await this.ensureAudio();if(request!==this.request)return;audio.loop=true;audio.volume=this.volume/100;await audio.play();if(request!==this.request){audio.pause();return;}this.playing=true;this.pending=false;this.onState('playing');}
    catch(error){if(request!==this.request)return;this.playing=false;this.pending=false;this.onState('error');throw new Error(error.name==='NotAllowedError'?'点击播放，即可开始本地循环配乐。':error.message||'本地音频无法播放，请选择 MP3 或 M4A 文件。');}
  }
  stop(){this.request++;this.pending=false;this.playing=false;this.audio?.pause();this.onState('paused');}
  setVolume(value){this.volume=Math.max(0,Math.min(100,value));if(this.audio)this.audio.volume=this.volume/100;}
  async useLocalFile(file){
    if(file.size>60*1024*1024)throw new Error('请选择小于 60 MB 的音频文件。');
    if(!file.type?.startsWith('audio/')&&!/\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(file.name))throw new Error('请选择音频文件，例如 MP3 或 M4A。');
    this.stop();const previousUrl=this.localUrl;this.localUrl=URL.createObjectURL(file);this.attach(this.localUrl,file.name);if(previousUrl)URL.revokeObjectURL(previousUrl);
    await this.start();
    try{await this.persistTrack(file);}catch{this.onError(new Error('音频已播放，但未能保存到浏览器；下次打开需重新选择。'));}
    return file.name;
  }
}
