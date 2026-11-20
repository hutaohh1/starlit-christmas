import { cp, mkdir, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
await mkdir('public/vision/wasm',{recursive:true});
await cp('node_modules/@mediapipe/tasks-vision/wasm','public/vision/wasm',{recursive:true});
const target='public/vision/hand_landmarker.task';
if (!(await stat(target).catch(()=>null))?.size) {
  const response=await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
  if(!response.ok)throw new Error(`Model download failed: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body),createWriteStream(target));
}
console.log('手势模型与 WASM 已准备好，运行时无需访问外网。');
