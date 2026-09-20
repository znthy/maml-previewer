import { Engine } from './engine.js';

import { evaluate } from './expr.js';

import { toStr } from './utils.js';

export function resolveColor(raw) {
  if (!raw) return '#ffffff';
  raw = raw.trim();
  if (raw.startsWith('@') || raw.startsWith('#') && Engine.varDecls.has(raw.slice(1))) {
    const v = toStr(evaluate(raw.startsWith('@') ? raw : '@' + raw.slice(1)));
    return normalizeHex(v);
  }
  return normalizeHex(raw);
}

export function normalizeHex(v) {
  if (!v) return '#ffffff';
  v = String(v).trim();
  if (!v.startsWith('#')) v = '#' + v;
  const hex = v.slice(1);
  if (hex.length === 8 && /^[0-9a-fA-F]{8}$/.test(hex)) {
    const a = parseInt(hex.slice(0, 2), 16) / 255;
    const r = parseInt(hex.slice(2, 4), 16);
    const g = parseInt(hex.slice(4, 6), 16);
    const b = parseInt(hex.slice(6, 8), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (hex.length === 3 && /^[0-9a-fA-F]{3}$/.test(hex)) {
    return '#' + [ ...hex ].map(c => c + c).join('');
  }
  if (hex.length === 6) return v;
  return hex.length > 6 ? v.slice(0, 7) : v;
}
