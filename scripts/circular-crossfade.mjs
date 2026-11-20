// Circular equal-power crossfade; input is normalized mono float32 PCM at 44100 Hz.
import fs from 'node:fs';
const data=fs.readFileSync(process.argv[2]),input=new Float32Array(data.buffer,data.byteOffset,data.byteLength/4),n=input.length;
// Keep the circular boundary close to 0.9s, at a quiet waveform point to prevent a click.
let fade=39690,best=Infinity;
for(let i=36162;i<43218;i++){const score=Math.abs(input[i])+4*Math.abs(input[i]-input[i-1])+Math.abs(i-39690)*.0000001;if(score<best){best=score;fade=i;}}
const loop=new Float32Array(n-fade);loop.set(input.subarray(fade,n-fade));
for(let i=0;i<fade;i++){const t=i/(fade-1)*Math.PI/2;loop[n-2*fade+i]=input[n-fade+i]*Math.cos(t)+input[i]*Math.sin(t);}
fs.writeFileSync(process.argv[3],Buffer.from(loop.buffer));
console.log(JSON.stringify({crossfadeSeconds:fade/44100,crossfadeSamples:fade,inputSamples:n,outputSeconds:loop.length/44100,seamJump:Math.abs(loop[0]-loop.at(-1))},null,2));
