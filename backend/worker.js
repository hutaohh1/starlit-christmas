const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_PHOTOS = 64;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export async function ownerHash(secret) {
  if (!/^[a-f0-9]{64}$/i.test(secret || '')) throw new HttpError(400, '照片凭证无效，请刷新网页重试。');
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function validatePhoto(input) {
  if (typeof input?.src !== 'string' || !input.src.startsWith('data:image/jpeg;base64,')) throw new HttpError(400, '请选择有效照片。');
  const encoded = input.src.slice(23);
  if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) throw new HttpError(413, '压缩后的照片仍过大，请换一张照片。');
  let bytes;
  try { bytes = atob(encoded); } catch { throw new HttpError(400, '照片内容无效。'); }
  if (bytes.length < 100 || bytes.length > MAX_IMAGE_BYTES || bytes.charCodeAt(0) !== 255 || bytes.charCodeAt(1) !== 216 || bytes.charCodeAt(2) !== 255) throw new HttpError(400, '照片内容无效。');
  const caption = typeof input.caption === 'string' ? input.caption.trim().slice(0, 50) : '';
  return { encoded, caption: caption || '一个圣诞瞬间' };
}
export class GitHubAlbum {
  constructor(env, fetcher = (...args) => fetch(...args)) { this.env = env; this.fetcher = fetcher; }
  async api(path, method = 'GET', body) {
    const response = await this.fetcher(`https://api.github.com/repos/${this.env.GITHUB_REPOSITORY}/${path}`, {
      method, headers: { Authorization: `Bearer ${this.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Starlit-Christmas-Album', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) { console.warn('GitHub album request failed', method, path.split('?')[0], response.status); const error = new Error('共享相册暂时无法写入，请稍后重试。'); error.status = response.status; throw error; }
    return response.json();
  }
  async manifest(ref = this.env.ALBUM_BRANCH || 'album') {
    const file = await this.api(`contents/photos.json?ref=${ref}`);
    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0));
    const manifest = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(manifest.photos)) throw new Error('共享相册数据格式异常。');
    return manifest;
  }
  async image(id) {
    if (!UUID.test(id)) throw new HttpError(404, '找不到这张照片。');
    const branch = this.env.ALBUM_BRANCH || 'album';
    const file = await this.fetcher(`https://api.github.com/repos/${this.env.GITHUB_REPOSITORY}/contents/photos/${id}.jpg?ref=${branch}`, {
      headers: { Authorization: `Bearer ${this.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.raw+json', 'User-Agent': 'Starlit-Christmas-Album' },
      redirect: 'error', signal: AbortSignal.timeout(10000)
    });
    if (file.status === 404) throw new HttpError(404, '找不到这张照片。');
    if (!file.ok || !file.body) throw new Error('共享照片加载失败。');
    return new Response(file.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=300' } });
  }
  async snapshot() {
    const branch = this.env.ALBUM_BRANCH || 'album';
    const ref = await this.api(`git/ref/heads/${branch}`);
    const commit = await this.api(`git/commits/${ref.object.sha}`);
    const manifest = await this.manifest(ref.object.sha);
    return { head: ref.object.sha, tree: commit.tree.sha, manifest };
  }
  async update(transform, image) {
    let blob;
    if (image) blob = await this.api('git/blobs', 'POST', { content: image.encoded, encoding: 'base64' });
    for (let attempt = 0; attempt < 4; attempt++) {
      const snapshot = await this.snapshot();
      const result = transform(snapshot.manifest.photos);
      const tree = [{ path: 'photos.json', mode: '100644', type: 'blob', content: JSON.stringify({ version: 1, photos: result.photos }, null, 2) + '\n' }];
      if (image) tree.push({ path: image.path, mode: '100644', type: 'blob', sha: blob.sha });
      if (result.deletedPath) tree.push({ path: result.deletedPath, mode: '100644', type: 'blob', sha: null });
      const nextTree = await this.api('git/trees', 'POST', { base_tree: snapshot.tree, tree });
      const nextCommit = await this.api('git/commits', 'POST', { message: result.message, tree: nextTree.sha, parents: [snapshot.head] });
      try {
        await this.api(`git/refs/heads/${this.env.ALBUM_BRANCH || 'album'}`, 'PATCH', { sha: nextCommit.sha, force: false });
        return { photo: result.photo, revision: nextCommit.sha };
      } catch (error) {
        if (![409, 422].includes(error.status) || attempt === 3) throw error;
      }
    }
  }
  async add(input, secret) {
    const validated = validatePhoto(input), hash = await ownerHash(secret), id = crypto.randomUUID();
    const photo = { id, path: `photos/${id}.jpg`, caption: validated.caption, ownerHash: hash, createdAt: new Date().toISOString() };
    return this.update(photos => {
      if (photos.length >= MAX_PHOTOS) throw new HttpError(409, '共享树已经挂满 64 张照片，请先摘下一张再试。');
      return { photos: [photo, ...photos], photo, message: 'Hang a Christmas memory' };
    }, { path: photo.path, encoded: validated.encoded });
  }
  async remove(id, secret, admin = false) {
    if (!UUID.test(id)) throw new HttpError(400, '照片编号无效。');
    const hash = admin ? null : await ownerHash(secret);
    return this.update(photos => {
      const photo = photos.find(p => p.id === id);
      if (!photo) throw new HttpError(404, '这张照片已经摘下。');
      if (!admin && photo.ownerHash !== hash) throw new HttpError(403, '只能摘下自己上传的照片。');
      return { photos: photos.filter(p => p.id !== id), deletedPath: photo.path, message: 'Take down a Christmas memory' };
    });
  }
}
export function createWorker(albumFactory = env => new GitHubAlbum(env)) {
  return { async fetch(request, env) {
    const url = new URL(request.url);
    if (env.ASSETS && url.pathname === '/') return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
    if (env.ASSETS && !/^\/(?:photos(?:\/|$)|health$)/.test(url.pathname)) return env.ASSETS.fetch(request);
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (origin && !allowed.includes(origin)) return json({ error: '当前网站不允许访问共享相册。' }, 403);
    const headers = { 'Access-Control-Allow-Origin': origin || allowed[0] || '', Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Photo-Owner,Authorization', 'X-Content-Type-Options': 'nosniff' };
    let response;
    try {
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
      else {
        const path = url.pathname;
        if (path === '/health' && request.method === 'GET') response = json({ ready: Boolean(env.GITHUB_TOKEN), repository: env.GITHUB_REPOSITORY });
        else if (request.method === 'GET' && path === '/photos') response = json(await albumFactory(env).manifest());
        else if (request.method === 'GET' && path.startsWith('/photos/')) response = await albumFactory(env).image(path.slice('/photos/'.length));
        else if ((request.method === 'POST' && path === '/photos') || (request.method === 'DELETE' && path.startsWith('/photos/'))) {
          if (!origin) throw new HttpError(403, '请在圣诞树网页中操作。');
          if (!env.GITHUB_TOKEN) throw new HttpError(503, '共享上传尚未开通，请联系网站主人。');
          if (!env.UPLOAD_LIMITER) throw new HttpError(503, '共享相册保护尚未配置。');
          const limit = await env.UPLOAD_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
          if (!limit.success) throw new HttpError(429, '挂照片太快啦，请一分钟后再试。');
          const album = albumFactory(env);
          if (request.method === 'POST') {
            if (!/^(?:application\/json|text\/plain)(?:;|$)/i.test(request.headers.get('Content-Type') || '')) throw new HttpError(415, '请通过网页选择照片。');
            if (Number(request.headers.get('Content-Length') || 0) > 1500000) throw new HttpError(413, '照片过大。');
            const body = await request.text();
            if (body.length > 1500000) throw new HttpError(413, '照片过大。');
            let input; try { input = JSON.parse(body); } catch { throw new HttpError(400, '照片内容无效。'); }
            response = json(await album.add(input, request.headers.get('X-Photo-Owner') || input?.owner), 201);
          } else {
            const admin = Boolean(env.ADMIN_KEY) && request.headers.get('Authorization') === `Bearer ${env.ADMIN_KEY}`;
            await album.remove(path.slice('/photos/'.length), request.headers.get('X-Photo-Owner'), admin);
            response = json({ removed: true });
          }
        } else response = json({ error: '接口不存在。' }, 404);
      }
    } catch (error) { if (!(error instanceof HttpError)) console.warn('Album request error', error.name, error.message); response = json({ error: error instanceof HttpError ? error.message : '共享相册暂时连接不上，请稍后重试。' }, error instanceof HttpError ? error.status : 503); }
    for (const [key, value] of Object.entries(headers)) if (value) response.headers.set(key, value);
    return response;
  } };
}
export default createWorker();
