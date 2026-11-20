import test from 'node:test';
import assert from 'node:assert/strict';
import { assetUrl } from '../src/assets.js';
import { makePostcard } from '../src/photos.js';
import { CHRISTMAS_TRACK } from '../src/music.js';
test('assets work on the site root and GitHub Pages project paths',()=>{
  for(const base of ['/', './', '/starlit-christmas/']){
    for(const path of ['postcards/winter-cabin.webp','music/taylor-swift-last-christmas.ogg','vision/wasm','vision/hand_landmarker.task']){
      assert.equal(assetUrl('/'+path,base),base+path);
      assert.equal(assetUrl(path,base),base+path);
    }
  }
});
test('default images and music resolve through the same bundled asset base',()=>{
  assert.equal(makePostcard(0).src,assetUrl('postcards/winter-cabin.webp'));
  assert.equal(CHRISTMAS_TRACK.sources[0],assetUrl('music/taylor-swift-last-christmas.ogg'));
});
