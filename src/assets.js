// Resolve bundled assets under both localhost and GitHub Pages project URLs.
export function assetUrl(path, base = import.meta.env?.BASE_URL || '/') {
  return base.replace(/\/?$/, '/') + path.replace(/^\/+/, '');
}
