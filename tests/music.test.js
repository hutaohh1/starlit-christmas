import test from 'node:test';
import assert from 'node:assert/strict';
import {ChristmasMusic} from '../src/music.js';
const fixture=()=>{let plays=0;return {loop:false,volume:1,addEventListener(){},pause(){},async play(){plays++;},get plays(){return plays;}};};
test('native local audio loops automatically and retains volume through pause/resume',async()=>{
  const audio=fixture(),states=[];const music=new ChristmasMusic({createAudio:()=>audio,onState:s=>states.push(s)});
  music.attach('/music/taylor-swift-last-christmas.mp3','Taylor Swift — Last Christmas');music.setVolume(48);
  await music.start();assert.equal(audio.loop,true);assert.equal(audio.volume,.48);assert.equal(music.playing,true);
  music.stop();assert.equal(music.playing,false);await music.start();assert.equal(audio.loop,true);assert.equal(audio.plays,2);assert.equal(states.at(-1),'playing');
});
test('stopping a pending local load cannot unexpectedly start music later',async()=>{
  let finish;const audio=fixture(),music=new ChristmasMusic();music.ensureAudio=()=>new Promise(resolve=>finish=resolve);
  const pending=music.start();music.stop();finish(audio);await pending;assert.equal(audio.plays,0);assert.equal(music.pending,false);
});
test('missing audio does not report playback or substitute another song',async()=>{
  const music=new ChristmasMusic({readStored:async()=>null,sources:[]});
  await assert.rejects(()=>music.start(),/Taylor Swift/);assert.equal(music.playing,false);assert.equal(music.pending,false);
});
test('browser autoplay rejection leaves a usable paused player',async()=>{
  const audio=fixture();audio.play=async()=>{const error=new Error('blocked');error.name='NotAllowedError';throw error;};
  const music=new ChristmasMusic({createAudio:()=>audio});music.attach('/music/track.mp3','track');
  await assert.rejects(()=>music.start(),/点击播放/);assert.equal(music.playing,false);assert.equal(music.pending,false);
});
