import { Engine } from './engine.js';

import { logOnce } from './log.js';

export function normalizeAssetPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

export function joinPath(a, b) {
  if (!a) return b;
  return a.replace(/\/$/, '') + '/' + b;
}

export function splitExt(path) {
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.slice(0, slash + 1) : '';
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf('.');
  const name = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  return {
    dir: dir,
    name: name,
    ext: ext
  };
}

export function insertSuffix(path, val) {
  const {dir: dir, name: name, ext: ext} = splitExt(normalizeAssetPath(path));
  return `${dir}${name}_${val}${ext}`;
}

export function insertDotSuffix(path) {
  const {dir: dir, name: name, ext: ext} = splitExt(normalizeAssetPath(path));
  return `${dir}${name}_dot${ext}`;
}

export function findZipEntry(key) {
  const lower = key.toLowerCase();
  const tryDir = Engine.manifestDir ? joinPath(Engine.manifestDir, key) : null;
  const candidates = [];
  if (tryDir) candidates.push(tryDir.toLowerCase());
  candidates.push(lower);
  for (const cand of candidates) {
    const hit = Engine.fileIndex.find(f => f.lower === cand);
    if (hit) return hit;
  }
  const suffix = '/' + lower;
  let hit = Engine.fileIndex.find(f => f.lower.endsWith(suffix));
  if (hit) return hit;
  const base = lower.split('/').pop();
  hit = Engine.fileIndex.find(f => f.lower.split('/').pop() === base);
  return hit || null;
}

export function resolveAssetBlobURL(key) {
  if (Engine.blobPromiseCache.has(key)) return Engine.blobPromiseCache.get(key);
  const p = (async () => {
    const entry = findZipEntry(key);
    if (!entry) return null;
    try {
      const blob = await entry.file.async('blob');
      const url = URL.createObjectURL(blob);
      updateAssetCount();
      return url;
    } catch (e) {
      return null;
    }
  })();
  Engine.blobPromiseCache.set(key, p);
  return p;
}

let needsRedraw = true;

let missingCount = 0;

export function getMissingCount() {
  return missingCount;
}

export function resetMissingCount() {
  missingCount = 0;
  document.getElementById('stMissing').textContent = '0';
}

export function getImage(path) {
  if (!path) return null;
  const key = normalizeAssetPath(path);
  let entry = Engine.imageCache.get(key);
  if (entry) return entry.img;
  const img = new Image;
  entry = {
    img: img,
    status: 'loading'
  };
  Engine.imageCache.set(key, entry);
  resolveAssetBlobURL(key).then(url => {
    if (!url) {
      entry.status = 'missing';
      missingCount++;
      document.getElementById('stMissing').textContent = missingCount;
      logOnce('missing:' + key, 'Missing asset: ' + path);
      return;
    }
    img.onload = () => {
      needsRedraw = true;
    };
    img.src = url;
  });
  return img;
}

export function preloadImage(path) {
  const img = getImage(path);
  if (!img) return Promise.resolve();
  if (img.complete && img.naturalWidth) return Promise.resolve();
  return new Promise(res => {
    img.addEventListener('load', res, {
      once: true
    });
    img.addEventListener('error', res, {
      once: true
    });
  });
}

export function updateAssetCount() {
  const n = [ ...Engine.blobPromiseCache.keys() ].length;
  document.getElementById('stAssets').textContent = n;
}

export function fontFamilyFor(typeface) {
  if (!typeface) return 'sans-serif';
  const stem = typeface.replace(/\.(ttf|otf|ttc)$/i, '').toLowerCase();
  return Engine.fontFamilies.get(stem) || 'sans-serif';
}

export async function registerFonts() {
  const fontFiles = Engine.fileIndex.filter(f => /\.(ttf|otf|ttc)$/i.test(f.path));
  for (const f of fontFiles) {
    try {
      const buf = await f.file.async('arraybuffer');
      const stem = splitExt(f.path).name.toLowerCase();
      const family = 'mamlfont_' + stem.replace(/[^a-z0-9]/g, '') + '_' + Engine.fontFamilies.size;
      const face = new FontFace(family, buf);
      await face.load();
      document.fonts.add(face);
      Engine.fontFamilies.set(stem, family);
    } catch (e) {}
  }
}
