import { execFileSync } from 'node:child_process';
const repo='hutaohh1/starlit-christmas';
const api=(path,body)=>JSON.parse(execFileSync('gh',['api',`repos/${repo}/${path}`,...(body?['--method','POST','--input','-']:[])],{encoding:'utf8',input:body?JSON.stringify(body):undefined,windowsHide:true}));
try { api('git/ref/heads/album'); console.log('Shared album branch already exists.'); }
catch {
  const tree=api('git/trees',{tree:[{path:'photos.json',mode:'100644',type:'blob',content:JSON.stringify({version:1,photos:[]},null,2)+'\n'}]});
  const commit=api('git/commits',{message:'Initialize shared Christmas photo album',tree:tree.sha,parents:[]});
  api('git/refs',{ref:'refs/heads/album',sha:commit.sha});console.log('Initialized GitHub album branch.');
}
