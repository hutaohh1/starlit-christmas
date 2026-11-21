import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker, GitHubAlbum, ownerHash, validatePhoto } from '../backend/worker.js';
import { sharedEntries } from '../src/shared-photos.js';
const secret='ab'.repeat(32), other='cd'.repeat(32);
const jpeg=Buffer.alloc(150);jpeg[0]=255;jpeg[1]=216;jpeg[2]=255;
const photo={src:'data:image/jpeg;base64,'+jpeg.toString('base64'),caption:'雪夜回忆'};
class MemoryAlbum extends GitHubAlbum {
  constructor(){super({GITHUB_REPOSITORY:'a/b',GITHUB_TOKEN:'test'});this.head='c0';this.trees=new Map([['t0',{'photos.json':JSON.stringify({version:1,photos:[]})}]]);this.commits=new Map([['c0',{tree:{sha:'t0'}}]]);this.next=0;this.conflicts=0;}
  async api(path,method='GET',body){
    if(path==='git/ref/heads/album')return {object:{sha:this.head}};
    if(path.startsWith('git/commits/'))return this.commits.get(path.split('/').at(-1));
    if(path.startsWith('contents/photos.json?ref=')){const ref=path.split('=').at(-1);const commit=this.commits.get(ref==='album'?this.head:ref);return {content:Buffer.from(this.trees.get(commit.tree.sha)['photos.json']).toString('base64')};}
    if(path==='git/blobs')return {sha:'b'+(++this.next)};
    if(path==='git/trees'){
      const files={...this.trees.get(body.base_tree)};
      for(const entry of body.tree){if(entry.sha===null)delete files[entry.path];else files[entry.path]=entry.content||entry.sha;}
      const sha='t'+(++this.next);this.trees.set(sha,files);return {sha};
    }
    if(path==='git/commits'){const sha='c'+(++this.next);this.commits.set(sha,{tree:{sha:body.tree},parent:body.parents[0]});return {sha};}
    if(path==='git/refs/heads/album'&&method==='PATCH'){
      if(this.commits.get(body.sha).parent!==this.head){this.conflicts++;const error=new Error('conflict');error.status=422;throw error;}
      this.head=body.sha;return {object:{sha:this.head}};
    }
    throw Error('Unexpected GitHub API '+path);
  }
}
test('concurrent visitors both keep their images and manifest entries',async()=>{
  const album=new MemoryAlbum(),originalSnapshot=album.snapshot.bind(album);let arrivals=0,release;
  const bothReading=new Promise(resolve=>release=resolve);
  album.snapshot=async()=>{const snapshot=await originalSnapshot();const order=++arrivals;if(order===2)release();if(order<=2)await bothReading;return snapshot;};
  const results=await Promise.all([album.add(photo,secret),album.add({...photo,caption:'另一份回忆'},other)]);
  const snapshot=await album.snapshot();assert.equal(snapshot.manifest.photos.length,2);assert.ok(album.conflicts>0);
  const files=album.trees.get(snapshot.tree);for(const result of results)assert.ok(files[result.photo.path]);
});
test('only the uploader can remove an image; image and manifest change together',async()=>{
  const album=new MemoryAlbum();const {photo:entry}=await album.add(photo,secret);
  await assert.rejects(()=>album.remove(entry.id,other),error=>error.status===403);
  assert.equal((await album.snapshot()).manifest.photos.length,1);
  await album.remove(entry.id,secret);const snapshot=await album.snapshot();assert.equal(snapshot.manifest.photos.length,0);assert.equal(album.trees.get(snapshot.tree)[entry.path],undefined);
});
test('invalid and oversized uploads never become GitHub image records',()=>{
  assert.throws(()=>validatePhoto({src:'data:text/html;base64,aGVsbG8='}));
  assert.throws(()=>validatePhoto({src:'data:image/jpeg;base64,'+'a'.repeat(1500000)}));
  assert.throws(()=>validatePhoto({src:'data:image/jpeg;base64,aGVsbG8='}));
  assert.equal(validatePhoto(photo).caption,'雪夜回忆');
});
test('public album entries expose only safe GitHub image paths and own-photo controls',async()=>{
  const hash=await ownerHash(secret),id='11111111-1111-4111-8111-111111111111';
  const records={photos:[{id,path:`photos/${id}.jpg`,caption:'回忆',ownerHash:hash},{id,path:'../../secret',ownerHash:hash}]};
  const entries=sharedEntries(records,{repository:'a/b',branch:'album'},hash);assert.equal(entries.length,1);assert.equal(entries[0].canRemove,true);assert.equal(entries[0].src,`https://raw.githubusercontent.com/a/b/album/photos/${id}.jpg`);
  assert.equal(sharedEntries(records,{repository:'a/b',branch:'album'},'someone-else')[0].canRemove,false);
});
const env={ALLOWED_ORIGINS:'https://tree.example',GITHUB_REPOSITORY:'a/b',GITHUB_TOKEN:'not-a-real-token',UPLOAD_LIMITER:{limit:async()=>({success:true})}};
const req=(origin='https://tree.example',body=photo)=>new Request('https://api.example/photos',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Photo-Owner':secret},body:JSON.stringify(body)});
test('upload API rejects other origins, bad JSON, rate limits and missing server secrets',async()=>{
  const worker=createWorker(()=>{throw Error('must not reach storage');});
  assert.equal((await worker.fetch(req('https://other.example'),env)).status,403);
  assert.equal((await worker.fetch(req(),{...env,GITHUB_TOKEN:''})).status,503);
  assert.equal((await worker.fetch(req(),{...env,UPLOAD_LIMITER:{limit:async()=>({success:false})}})).status,429);
  const invalid=new Request('https://api.example/photos',{method:'POST',headers:{Origin:'https://tree.example','Content-Type':'application/json'},body:'{'});
  const response=await createWorker(()=>({})).fetch(invalid,env);assert.equal(response.status,400);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://tree.example');
});
test('a second visitor reads a photo uploaded by the first; failures cannot fake success',async()=>{
  const album=new MemoryAlbum(),worker=createWorker(()=>album);
  const upload=await worker.fetch(req(),env);assert.equal(upload.status,201);
  const data=await upload.json();assert.equal(data.photo.caption,'雪夜回忆');
  const read=await worker.fetch(new Request('https://api.example/photos',{headers:{Origin:'https://tree.example'}}),env);assert.equal((await read.json()).photos[0].id,data.photo.id);
  const blocked=createWorker(()=>({add:async()=>{throw Error('offline');}}));const result=await blocked.fetch(req(),env);assert.equal(result.status,503);assert.ok((await result.json()).error);
});

const imageId = '11111111-1111-4111-8111-111111111111';
const imagePath = `photos/${imageId}.jpg`;
const imageRequest = () => new Request(`https://api.example/photos/${imageId}`, { headers: { Origin: 'https://tree.example' } });

test('the Worker decodes GitHub Contents JSON into a cross-origin JPEG', async () => {
  const album = new GitHubAlbum(env, async url => {
    assert.equal(new URL(url).pathname, `/repos/${env.GITHUB_REPOSITORY}/contents/${imagePath}`);
    return Response.json({ encoding: 'base64', content: jpeg.toString('base64') });
  });
  const response = await createWorker(() => album).fetch(imageRequest(), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://tree.example');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), jpeg);
});

test('image lookup uses the server-side public fallback on an upstream failure, but honors deletion', async () => {
  let status = 502;
  let fallbackCalls = 0;
  const album = new GitHubAlbum(env, async (url, options) => {
    if (new URL(url).hostname === 'api.github.com') return new Response(null, { status });
    fallbackCalls++;
    assert.equal(url, `https://raw.githubusercontent.com/${env.GITHUB_REPOSITORY}/album/${imagePath}`);
    assert.equal(new Headers(options.headers).has('Authorization'), false);
    return new Response(jpeg);
  });
  const worker = createWorker(() => album);
  const result = await worker.fetch(imageRequest(), env);
  assert.equal(fallbackCalls, 1);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), jpeg);
  status = 404;
  assert.equal((await worker.fetch(imageRequest(), env)).status, 404);
  assert.equal(fallbackCalls, 1);
});
