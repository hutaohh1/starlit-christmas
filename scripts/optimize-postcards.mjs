import {stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
for(const name of ['winter-cabin','christmas-lane','aurora-wishes','midnight-express','fireside-moments','starlit-christmas']){
  if(!(await stat(`artwork/originals/${name}.png`).catch(()=>null))?.size)continue;
  const result=await new Promise(resolve=>{const child=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`artwork/originals/${name}.png`,'-vf','scale=800:1200','-c:v','libwebp','-quality','88',`public/postcards/${name}.webp`],{windowsHide:true});child.on('error',e=>{console.error(e.message);resolve(1);});child.on('exit',resolve);});
  console.log(`${result===0?'OPTIMIZED':'FAILED'} ${name}`);
}
