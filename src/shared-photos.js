import { assetUrl } from './assets.js';
const KEY = 'starlit-shared-photo-owner';
let configuration, owner, pending;
export async function sharedConfig() {
  if (!configuration) configuration = fetch(assetUrl('shared-config.json'), { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('共享相册配置加载失败，请刷新重试。');
    return response.json();
  }).catch(error => { configuration = null; throw error; });
  return configuration;
}
async function identity() {
  if (owner) return owner;
  let secret;
  try {
    secret = localStorage.getItem(KEY);
    if (!/^[a-f0-9]{64}$/.test(secret || '')) {
      secret = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY, secret);
    }
  } catch { throw new Error('请允许浏览器保存照片记录后重试。'); }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))].map(n => n.toString(16).padStart(2, '0')).join('');
  return owner = { secret, hash };
}
export function sharedEntries(manifest, config, hash = '') {
  if (!Array.isArray(manifest?.photos)) throw new Error('共享相册格式异常。');
  return manifest.photos.filter(p => /^[a-f0-9-]{36}$/i.test(p.id) && p.path === `photos/${p.id}.jpg`).map(p => ({
    id: `shared-${p.id}`, sharedId: p.id,
    src: `https://raw.githubusercontent.com/${config.repository}/${config.branch}/${p.path}`,
    caption: typeof p.caption === 'string' ? p.caption.slice(0, 50) : '一个圣诞瞬间', isDefault: false, isShared: true, canRemove: Boolean(hash) && hash === p.ownerHash
  }));
}
export async function loadSharedPhotos() {
  const config = await sharedConfig();
  const url = `https://raw.githubusercontent.com/${config.repository}/${config.branch}/photos.json?t=${Math.floor(Date.now() / 30000)}`;
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('共享相册连接不上，稍后会自动重试。');
  let hash = ''; try { hash = (await identity()).hash; } catch {}
  return sharedEntries(await response.json(), config, hash);
}
async function mutate(path, method, input) {
  const config = await sharedConfig();
  if (!config.apiUrl) throw new Error('共享上传尚未开通，目前只能挂在自己的浏览器里。');
  const { secret } = await identity();
  const response = await fetch(config.apiUrl.replace(/\/$/, '') + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-Photo-Owner': secret },
    body: input ? JSON.stringify(input) : undefined, signal: AbortSignal.timeout(60000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '照片没有上传成功，请重试。');
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
    // Display the selected image immediately while GitHub's image cache updates.
    return { ...shared, src: photo.src, remoteSrc: shared.src };
  });
  pending = job; try { return await job; } finally { if (pending === job) pending = null; }
}
export function removeSharedPhoto(photo) { return mutate(`/photos/${photo.sharedId}`, 'DELETE'); }
