import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const jobs=JSON.parse((await readFile('artwork/postcards.json','utf8')).replace(/^\uFEFF/,''));
const helper='C:/Users/Lenovo/.codex/skills/game-creator/asset-gen.mjs';
await mkdir('artwork/originals',{recursive:true});
const results=[];
async function generate(job){
  const target=`artwork/originals/${job.id}.png`;
  if((await stat(target).catch(()=>null))?.size){console.log(`EXISTS ${job.id}`);return;}
  console.log(`START ${job.id}`);
  const result=await new Promise(resolve=>{const child=spawn(process.execPath,[helper,'image',job.prompt,target,'1024x1536'],{cwd:process.cwd(),windowsHide:true});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.on('error',e=>resolve({id:job.id,ok:false,error:e.message}));child.on('exit',code=>resolve({id:job.id,ok:code===0,output:output.trim()}));});
  results.push(result);console.log(`${result.ok?'SAVED':'FAILED'} ${job.id} ${result.output||result.error}`);
  await writeFile('artwork/generation-results.json',JSON.stringify(results,null,2));
}
const queue=[...jobs];async function worker(){while(queue.length)await generate(queue.shift());}
await Promise.allSettled([worker(),worker(),worker()]);
console.log(`Finished: ${results.filter(x=>x.ok).length} succeeded, ${results.filter(x=>!x.ok).length} failed.`);
if(results.some(x=>!x.ok))process.exitCode=1;
