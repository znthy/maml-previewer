import { Engine } from './engine.js';

import { applyManifestXML } from './app.js';

import { fitStage } from './ui.js';

export const xmlEditor = document.getElementById('xmlEditor');

const editorGutter = document.getElementById('editorGutter');

const editorErrorEl = document.getElementById('editorError');

let liveApplyTimer = null;

export function confirmDiscardEdits(actionLabel) {
  if (!Engine.originalManifestText) return true;
  if (xmlEditor.value === Engine.originalManifestText) return true;
  return confirm(actionLabel + ' will discard unsaved edits in the XML editor. Continue?');
}

export function syncEditorToOriginal() {
  xmlEditor.value = Engine.originalManifestText;
  document.getElementById('editFileName').textContent = Engine.originalManifestPath || '—';
  hideEditorError();
  updateGutter();
}

export function updateGutter() {
  const lines = xmlEditor.value.split('\n').length;
  if (editorGutter.dataset.lines != lines) {
    editorGutter.dataset.lines = lines;
    let s = '';
    for (let i = 1; i <= lines; i++) s += i + '\n';
    editorGutter.textContent = s;
  }
  editorGutter.scrollTop = xmlEditor.scrollTop;
}

export function showEditorError(msg) {
  editorErrorEl.textContent = '⚠ ' + msg + '  (last valid version is still showing in the preview)';
  editorErrorEl.classList.add('show');
}

export function hideEditorError() {
  editorErrorEl.classList.remove('show');
  editorErrorEl.textContent = '';
}

function jumpToEditorLine(n) {
  const lines = xmlEditor.value.split('\n');
  let offset = 0;
  for (let i = 0; i < n - 1 && i < lines.length; i++) offset += lines[i].length + 1;
  xmlEditor.focus();
  xmlEditor.setSelectionRange(offset, offset + (lines[n - 1] || '').length);
}

editorErrorEl.addEventListener('click', () => {
  const m = /^⚠ Line (\d+):/.exec(editorErrorEl.textContent);
  if (m) jumpToEditorLine(parseInt(m[1]));
});

function doApplyEdited() {
  const text = xmlEditor.value;
  applyManifestXML(text, {
    skipDigitWait: true,
    quiet: true
  }).then(() => {
    hideEditorError();
  }).catch(err => {
    showEditorError(err.message);
  });
}

function scheduleLiveApply() {
  clearTimeout(liveApplyTimer);
  if (!document.getElementById('liveApply').checked) return;
  liveApplyTimer = setTimeout(doApplyEdited, 450);
}

xmlEditor.addEventListener('input', () => {
  updateGutter();
  scheduleLiveApply();
});

xmlEditor.addEventListener('scroll', () => {
  editorGutter.scrollTop = xmlEditor.scrollTop;
});

xmlEditor.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    clearTimeout(liveApplyTimer);
    doApplyEdited();
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = xmlEditor.selectionStart, en = xmlEditor.selectionEnd;
    xmlEditor.value = xmlEditor.value.slice(0, s) + '  ' + xmlEditor.value.slice(en);
    xmlEditor.selectionStart = xmlEditor.selectionEnd = s + 2;
    updateGutter();
    scheduleLiveApply();
  }
});

document.getElementById('applyXmlBtn').addEventListener('click', () => {
  clearTimeout(liveApplyTimer);
  doApplyEdited();
});

document.getElementById('revertXmlBtn').addEventListener('click', () => {
  if (xmlEditor.value === Engine.originalManifestText) return;
  if (!confirm('Discard all edits and reload this file from the .zip?')) return;
  syncEditorToOriginal();
  applyManifestXML(Engine.originalManifestText, {
    quiet: true
  }).catch(err => showEditorError(err.message));
});

document.getElementById('downloadXmlBtn').addEventListener('click', () => {
  const blob = new Blob([ xmlEditor.value ], {
    type: 'application/xml'
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = Engine.originalManifestPath ? Engine.originalManifestPath.split('/').pop() : 'manifest.xml';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2e3);
});

document.getElementById('editToggle').addEventListener('click', () => {
  document.getElementById('editorCol').classList.toggle('hidden');
  updateGutter();
  fitStage();
});

document.getElementById('wrapToggleBtn').addEventListener('click', () => {
  xmlEditor.classList.toggle('wrap');
});

export function resetEditor() {
  clearTimeout(liveApplyTimer);
  hideEditorError();
  xmlEditor.value = '';
  updateGutter();
}
