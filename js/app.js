import { Engine } from './engine.js';

import { log } from './log.js';

import { collectDecls, runCommandsIn } from './commands.js';

import { collectDigitSources } from './image.js';

import { getImage, registerFonts, resetMissingCount } from './assets.js';

import { canvas } from './stage.js';

import { resetEditor, syncEditorToOriginal, confirmDiscardEdits } from './editor.js';

import { fitStage } from './ui.js';

export async function loadZip(file) {
  resetEngine();
  document.getElementById('stProject').textContent = file.name;
  log('Reading ' + file.name + ' …');
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (e) {
    log('Could not open zip: ' + e.message, 'warn');
    return;
  }
  Engine.zip = zip;
  Engine.fileIndex = Object.keys(zip.files).filter(p => !zip.files[p].dir).map(p => ({
    path: p,
    lower: p.toLowerCase(),
    file: zip.files[p]
  }));
  log('Found ' + Engine.fileIndex.length + ' files in archive.');
  await registerFonts();
  if (Engine.fontFamilies.size) log('Loaded ' + Engine.fontFamilies.size + ' embedded font(s).');
  const manifestFiles = Engine.fileIndex.filter(f => /manifest\.xml$|config\.xml$/i.test(f.path));
  const picker = document.getElementById('manifestPick');
  picker.innerHTML = '';
  picker.style.display = 'none';
  if (!manifestFiles.length) {
    log('No manifest.xml or config.xml found in this archive.', 'warn');
    return;
  }
  let chosen;
  if (manifestFiles.length === 1) chosen = manifestFiles[0]; else {
    manifestFiles.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    chosen = manifestFiles[0];
    picker.style.display = 'inline-block';
    for (const f of manifestFiles) {
      const opt = document.createElement('option');
      opt.value = f.path;
      opt.textContent = f.path;
      picker.appendChild(opt);
    }
    picker.value = chosen.path;
    picker.onchange = () => {
      const f = manifestFiles.find(m => m.path === picker.value);
      if (!f) return;
      if (!confirmDiscardEdits('Switching files')) {
        picker.value = Engine.originalManifestPath;
        return;
      }
      parseManifest(f);
    };
    log(manifestFiles.length + ' manifest candidates found — pick one from the dropdown.');
  }
  await parseManifest(chosen);
}

function resetManifestState() {
  Engine.varDecls.clear();
  Engine.thresholdVars.length = 0;
  Engine.contentProviderVarColumn.clear();
  Engine.overrides.clear();
  Engine.visOverrides.clear();
  Engine.animState.clear();
  Engine.elementAnimState.clear();
  Engine.elementAnims.clear();
  Engine.sliderState.clear();
  Engine.latestSliders = [];
  Engine.activeSliderEl = null;
  Engine.unlockReached = false;
  Engine.elementRefs.clear();
  Engine.declCounter = 0;
  Engine.resumeTrigger = null;
  Engine.pauseTrigger = null;
  Engine.needsMissingLog.clear();
}

function guessScreenHeight(screenW, path) {
  const p = (path || '').toLowerCase();
  if (/19\.3[_-]?9/.test(p)) return screenW * (19.3 / 9);
  if (/20[_-]?9/.test(p)) return screenW * (20 / 9);
  if (/19[_-]?9/.test(p)) return screenW * (19 / 9);
  if (/18[_-]?9/.test(p)) return screenW * (18 / 9);
  return screenW * (16 / 9);
}

function detectWallpaper() {
  const wallCandidates = Engine.fileIndex.filter(f => /wall(paper)?[^\/]*\.(jpg|jpeg|png)$/i.test(f.path));
  Engine.wallpaperPath = wallCandidates.length ? wallCandidates.sort((a, b) => a.path.length - b.path.length)[0].path : null;
}

function refineScreenHeightFromWallpaper() {
  if (!Engine.wallpaperPath) return;
  const img = getImage(Engine.wallpaperPath);
  const apply = () => {
    if (!(img.complete && img.naturalWidth)) return;
    if (Math.abs(img.naturalWidth - Engine.screenW) <= 2 && img.naturalHeight > 0) {
      if (Math.abs(img.naturalHeight - Engine.screenH) > 4) {
        Engine.screenH = img.naturalHeight;
        canvas.height = Math.round(Engine.screenH);
        fitStage();
        document.getElementById('stScreen').textContent = Engine.screenW + ' × ' + Math.round(Engine.screenH);
        log('Refined screen height to ' + Math.round(Engine.screenH) + 'px from full-bleed wallpaper ' + Engine.wallpaperPath + ' (its native width matches screenWidth 1:1).');
      }
    }
  };
  if (img.complete) apply(); else img.addEventListener('load', apply, {
    once: true
  });
}

export async function applyManifestXML(text, opts) {
  opts = opts || {};
  let doc;
  try {
    doc = (new DOMParser).parseFromString(text, 'application/xml');
  } catch (e) {
    throw new Error('XML parse threw: ' + e.message);
  }
  const perr = doc.querySelector('parsererror');
  if (perr) throw new Error(describeParserError(perr.textContent));
  const root = doc.documentElement;
  if (!root || root.tagName !== 'Lockscreen') {
    log('Root element is <' + (root && root.tagName || '?') + '>, expected <Lockscreen> — attempting best-effort render anyway.', 'warn');
  }
  resetManifestState();
  Engine.manifestRoot = root;
  Engine.screenW = parseFloat(root.getAttribute('screenWidth')) || 1080;
  Engine.screenH = guessScreenHeight(Engine.screenW, Engine.originalManifestPath);
  canvas.width = Engine.screenW;
  canvas.height = Math.round(Engine.screenH);
  collectDecls(root);
  if (!opts.quiet) log('Parsed manifest: ' + Engine.varDecls.size + ' variables, ' + Engine.thresholdVars.length + ' threshold triggers.');
  const digitWaits = [];
  collectDigitSources(root, digitWaits);
  if (digitWaits.length && !opts.skipDigitWait) {
    await Promise.race([ Promise.all(digitWaits), new Promise(res => setTimeout(res, 1500)) ]);
  }
  if (!opts.skipWallpaperScan) {
    detectWallpaper();
    refineScreenHeightFromWallpaper();
  }
  document.getElementById('stScreen').textContent = Engine.screenW + ' × ' + Math.round(Engine.screenH);
  document.getElementById('emptyHint').style.display = 'none';
  Engine.loaded = true;
  if (Engine.resumeTrigger) {
    runCommandsIn(Engine.resumeTrigger);
    if (!opts.quiet) log('Simulated screen "resume" event.');
  }
  fitStage();
}

function describeParserError(raw) {
  const m = /line(?:\s*number)?[:\s]+(\d+)/i.exec(raw || '');
  const line = m ? m[1] : null;
  const firstLine = (raw || 'XML is not well-formed').split('\n').find(l => l.trim().length) || 'XML is not well-formed';
  return line ? 'Line ' + line + ': ' + firstLine.trim() : firstLine.trim();
}

export async function parseManifest(entry) {
  const slash = entry.path.lastIndexOf('/');
  Engine.manifestDir = slash >= 0 ? entry.path.slice(0, slash) : '';
  const text = await entry.file.async('string');
  Engine.originalManifestText = text;
  Engine.originalManifestPath = entry.path;
  document.getElementById('stManifest').textContent = entry.path;
  syncEditorToOriginal();
  try {
    await applyManifestXML(text);
  } catch (e) {
    log('XML parse error in ' + entry.path + ' — ' + e.message, 'warn');
  }
}

export function resetEngine() {
  Engine.loaded = false;
  Engine.manifestRoot = null;
  Engine.elementAnimState.clear();
  Engine.elementAnims.clear();
  Engine.sliderState.clear();
  Engine.latestSliders = [];
  Engine.activeSliderEl = null;
  Engine.unlockReached = false;
  for (const {img: img} of Engine.imageCache.values()) {
    try {
      URL.revokeObjectURL(img.src);
    } catch (e) {}
  }
  Engine.imageCache.clear();
  Engine.blobPromiseCache.clear();
  Engine.originalManifestText = '';
  Engine.originalManifestPath = '';
  document.getElementById('stAssets').textContent = '0';
  resetMissingCount();
  document.getElementById('emptyHint').style.display = 'flex';
  document.getElementById('editFileName').textContent = '—';
  resetEditor();
}
