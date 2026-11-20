import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSharedPhotos } from '../src/shared-photos.js';
test('shared visitors use the fresh API manifest instead of GitHub raw branch cache',async()=>{
  const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;const requests=[];
  const id='22222222-2222-4222-8222-222222222222';
  globalThis.localStorage={getItem:()=> 'ab'.repeat(32)};
  globalThis.fetch=async url=>{requests.push(url);return Response.json(url.endsWith('shared-config.json')?{apiUrl:'https://album.example/',repository:'a/b',branch:'album'}:{photos:[{id,path:`photos/${id}.jpg`,caption:'最新照片'}]});};
  try{const photos=await loadSharedPhotos();assert.equal(requests[1],'https://album.example/photos');assert.equal(photos[0].caption,'最新照片');}
  finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;}
});
