import { assetUrl } from './assets.js';
const KEY = 'starlit-shared-photo-owner';
let configuration, owner, pending;
async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
const apiPath = (config, path) => config.apiUrl.replace(/\/$/, '') + path;
const rawPath = (config, path) => `https://raw.githubusercontent.com/${config.repository}/${config.branch}/${path}`;
export async function sharedConfig() {
  if (!configuration) configuration = fetchWithTimeout(assetUrl('shared-config.json'), { cache: 'no-store' }, 8000).then(async response => {
    if (!response.ok) throw new Error('共享相册配置加载失败，请刷新重试。');
    return response.json();
  }).catch(error => { configuration = null; throw error; });
  return configuration;
}
function identity() {
  if (!owner) owner = loadIdentity().catch(error => { owner = null; throw error; });
  return owner;
}
async function loadIdentity() {
  let secret;
  try { secret = localStorage.getItem(KEY); } catch {}
  if (!/^[a-f0-9]{64}$/.test(secret || '')) {
    secret = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(KEY, secret); } catch {}
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const hash = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
  return { secret, hash };
}
export function sharedEntries(manifest, config, hash = '') {
  if (!Array.isArray(manifest?.photos)) throw new Error('共享相册格式异常。');
  return manifest.photos.filter(p => p && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(p.id) && p.path === `photos/${p.id}.jpg`).map(p => ({
    id: `shared-${p.id}`, sharedId: p.id,
    src: config.apiUrl ? apiPath(config, '/photos/' + p.id) : rawPath(config, p.path),
    fallbackSrc: config.apiUrl ? rawPath(config, p.path) : undefined,
    caption: typeof p.caption === 'string' ? p.caption.slice(0, 50) : '一个圣诞瞬间', isDefault: false, isShared: true, canRemove: Boolean(hash) && hash === p.ownerHash
  }));
}
export async function loadSharedPhotos() {
  const config = await sharedConfig();
  const candidates = [config.apiUrl && apiPath(config, '/photos'), rawPath(config, 'photos.json')].filter(Boolean);
  let hash = '';
  try { hash = (await identity()).hash; } catch {}
  for (const url of candidates) {
    try {
      const response = await fetchWithTimeout(url, { cache: 'no-store' }, 6000);
      if (response.ok) return sharedEntries(await response.json(), config, hash);
    } catch {}
  }
  throw new Error('共享相册暂时连不上，稍后会自动重试。');
}
async function mutate(path, method, input) {
  const config = await sharedConfig();
  if (!config.apiUrl) throw new Error('共享上传尚未开通，目前只能挂在自己的浏览器里。');
  const { secret } = await identity();
  let response;
  try {
    response = await fetchWithTimeout(apiPath(config, path), {
      method,
      // A simple POST lets browsers send the upload without a separate CORS preflight.
      headers: input ? { 'Content-Type': 'text/plain;charset=UTF-8' } : { 'X-Photo-Owner': secret },
      body: input ? JSON.stringify({ ...input, owner: secret }) : undefined
    }, 45000);
  } catch {
    throw new Error('连接不上共享上传服务。请换个网络后重试。');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !Object.keys(result).length) throw new Error(result.error || '共享上传服务暂时不可用，请稍后重试。');
  return result;
}
export async function uploadSharedPhoto(photo) {
  // Writes are serialized on this device; the server also handles simultaneous visitors.
  const previous = pending || Promise.resolve();
  const job = previous.catch(() => {}).then(async () => {
    if (photo.src.length > 1400000) throw new Error('这张照片压缩后仍然太大，请换一张照片。');
    const result = await mutate('/photos', 'POST', { src: photo.src, caption: photo.caption });
    const config = await sharedConfig(), own = await identity();
    const shared = sharedEntries({ photos: [result.photo] }, config, own.hash)[0];
    if (!shared) throw new Error('照片已提交，但返回记录不完整，请刷新查看。');
    // Show the chosen image immediately while other visitors fetch the new entry.
    return { ...shared, src: photo.src };
  });
  pending = job; try { return await job; } finally { if (pending === job) pending = null; }
}
export function removeSharedPhoto(photo) { return mutate(`/photos/${photo.sharedId}`, 'DELETE'); }
