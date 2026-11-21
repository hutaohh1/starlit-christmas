import { assetUrl } from './assets.js';
export const DEFAULT_POSTCARDS=[
  {
    "id": "winter-cabin",
    "caption": "雪夜归家"
  },
  {
    "id": "christmas-lane",
    "caption": "灯火与初雪"
  },
  {
    "id": "aurora-wishes",
    "caption": "极光下的愿望"
  },
  {
    "id": "midnight-express",
    "caption": "驶向圣诞的列车"
  },
  {
    "id": "fireside-moments",
    "caption": "炉火旁的时光"
  },
  {
    "id": "starlit-christmas",
    "caption": "把星光送给你"
  }
];
export function makePostcard(index){const photo=DEFAULT_POSTCARDS[index%DEFAULT_POSTCARDS.length];return {id:'default-'+index,src:assetUrl('postcards/'+photo.id+'.webp'),caption:photo.caption,isDefault:true};}
let database;
async function db(){if(database)return database;database=await new Promise((resolve,reject)=>{const request=indexedDB.open('starlit-christmas',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return database;}
export async function loadPhotos(){try{const store=(await db()).transaction('photos').objectStore('photos');return await new Promise((resolve,reject)=>{const req=store.getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}catch{return [];}}
export async function savePhoto(photo){const database=await db();await new Promise((resolve,reject)=>{const tx=database.transaction('photos','readwrite');tx.objectStore('photos').put(photo);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
export async function deletePhoto(id){
  const database=await db();
  await new Promise((resolve,reject)=>{const tx=database.transaction('photos','readwrite');tx.objectStore('photos').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('照片移除失败，请重试。'));});
}
async function decodePhoto(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch {}
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    return image;
  } catch {
    throw new Error('浏览器打不开这张照片，请试试 JPG 或 PNG。');
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function readPhoto(file) {
  const supportedType = /^image\/(?:jpeg|png|webp|avif)$/i.test(file.type);
  const supportedName = /\.(?:jpe?g|png|webp|avif)$/i.test(file.name);
  if (!supportedType && !supportedName) throw new Error('请选择 JPG、PNG、WebP 或 AVIF 照片。');
  if (file.size > 20 * 1024 * 1024) throw new Error('单张照片请小于 20 MB。');
  const image = await decodePhoto(file);
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('浏览器无法转换照片，请试试 Chrome 或 Edge。');
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let src = canvas.toDataURL('image/jpeg', .78);
    if (src.length > 1398100) src = canvas.toDataURL('image/jpeg', .62);
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return { id, src, caption: file.name.replace(/\.[^.]+$/, '').slice(0, 50), isDefault: false };
  } finally {
    image.close?.();
  }
}
