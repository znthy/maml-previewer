import { Engine } from './engine.js';

import { NULLV } from './utils.js';

import { log } from './log.js';

import { loadZip, parseManifest } from './app.js';

import { confirmDiscardEdits } from './editor.js';

import { canvas } from './stage.js';

document.getElementById('zipInput').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f && confirmDiscardEdits('Opening a new project')) loadZip(f);
  e.target.value = '';
});

[ 'dragover' ].forEach(evt => document.getElementById('stageWrap').addEventListener(evt, e => e.preventDefault()));

document.getElementById('stageWrap').addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && /\.zip$/i.test(f.name) && confirmDiscardEdits('Opening a new project')) loadZip(f);
});

document.getElementById('reloadBtn').addEventListener('click', () => {
  if (!Engine.zip) return;
  if (!confirmDiscardEdits('Resetting')) return;
  const picker = document.getElementById('manifestPick');
  const path = picker.style.display !== 'none' ? picker.value : null;
  const entry = path ? Engine.fileIndex.find(f => f.path === path) : Engine.fileIndex.find(f => /manifest\.xml$|config\.xml$/i.test(f.path));
  Engine.overrides.clear();
  Engine.animState.clear();
  Engine.visOverrides.clear();
  if (entry) parseManifest(entry);
});

document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('hidden');
  fitStage();
});

document.getElementById('statusToggle').addEventListener('click', () => {
  document.getElementById('statusBar').classList.toggle('hidden');
  fitStage();
});

document.getElementById('fullscreenBtn').addEventListener('click', () => {
  const col = document.getElementById('stageCol');
  if (!document.fullscreenElement) col.requestFullscreen().catch(() => {}); else document.exitFullscreen();
});

document.addEventListener('fullscreenchange', fitStage);

window.addEventListener('resize', fitStage);

export function fitStage() {
  const wrap = document.getElementById('stageWrap');
  const availW = wrap.clientWidth - 20, availH = wrap.clientHeight - 20;
  const scale = Math.min(availW / canvas.width, availH / canvas.height, 1.6);
  canvas.style.width = Math.round(canvas.width * scale) + 'px';
  canvas.style.height = Math.round(canvas.height * scale) + 'px';
}

setTimeout(fitStage, 50);

document.getElementById('clearLog').addEventListener('click', () => {
  document.getElementById('log').innerHTML = '';
});

function bindRange(id, valId, fmt, setter) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    document.getElementById(valId).textContent = fmt(el.value);
    setter(el.value);
  });
}

bindRange('battLevel', 'battLevelVal', v => v + '%', v => Engine.sim.battLevel = parseFloat(v));

bindRange('volLevel', 'volLevelVal', v => v + '%', v => Engine.sim.volLevel = parseFloat(v));

document.getElementById('battState').addEventListener('change', e => Engine.sim.battState = parseInt(e.target.value));

document.getElementById('ringMode').addEventListener('change', e => Engine.sim.ringMode = parseInt(e.target.value));

document.getElementById('missedCalls').addEventListener('input', e => Engine.sim.missedCalls = parseInt(e.target.value) || 0);

document.getElementById('unreadSms').addEventListener('input', e => Engine.sim.unreadSms = parseInt(e.target.value) || 0);

document.getElementById('tiltX').addEventListener('input', e => Engine.sim.tiltX = parseFloat(e.target.value));

document.getElementById('tiltY').addEventListener('input', e => Engine.sim.tiltY = parseFloat(e.target.value));

document.getElementById('timeFormat24').addEventListener('change', e => Engine.sim.timeFormat24 = e.target.checked);

let watches = [];

document.getElementById('watchAdd').addEventListener('click', addWatchFromInput);

document.getElementById('watchNew').addEventListener('keydown', e => {
  if (e.key === 'Enter') addWatchFromInput();
});

function addWatchFromInput() {
  const inp = document.getElementById('watchNew');
  const name = inp.value.trim().replace(/^[#@]/, '');
  if (!name) return;
  watches.push(name);
  inp.value = '';
  renderWatchList();
}

function renderWatchList() {
  const list = document.getElementById('watchList');
  list.innerHTML = '';
  watches.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'watchRow';
    const label = document.createElement('input');
    label.value = name;
    label.readOnly = true;
    const val = document.createElement('span');
    val.className = 'wval';
    val.id = 'wval_' + i;
    const rm = document.createElement('button');
    rm.textContent = '✕';
    rm.onclick = () => {
      watches.splice(i, 1);
      renderWatchList();
    };
    row.append(label, val, rm);
    list.appendChild(row);
  });
  document.getElementById('watchCount').textContent = watches.length;
}

export function updateWatchPanel() {
  watches.forEach((name, i) => {
    const el = document.getElementById('wval_' + i);
    if (!el) return;
    if (!Engine.loaded) {
      el.textContent = '—';
      return;
    }
    Engine.frameVarCache.delete(name);
    const v = Engine.resolveVar(name);
    el.textContent = v === NULLV ? 'null' : typeof v === 'number' ? Math.round(v * 1e3) / 1e3 : v;
  });
}

log('Ready. Open a theme .zip to begin — drag & drop also works.');
