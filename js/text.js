import { evaluate } from './expr.js';

import { toStr, splitTopLevel, sprintf } from './utils.js';

import { getNum, hasAttr, curAlpha } from './render.js';

import { ctx } from './stage.js';

import { resolveColor } from './color.js';

import { fontFamilyFor } from './assets.js';

import { Engine } from './engine.js';

export function computeTextString(el) {
  if (el.hasAttribute('textExp')) return toStr(evaluate(el.getAttribute('textExp')));
  if (el.hasAttribute('format')) {
    const paras = el.getAttribute('paras') || '';
    const parts = splitTopLevel(paras, ',');
    const vals = parts.map(p => evaluate(p));
    return sprintf(el.getAttribute('format'), vals);
  }
  if (el.hasAttribute('text')) {
    const raw = el.getAttribute('text');
    const t = raw.trim();
    if (/^[#@][A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(t)) return toStr(evaluate(t));
    return raw;
  }
  return '';
}

export function drawTextEl(el, ownAlpha) {
  const a = curAlpha(ownAlpha);
  const name = el.getAttribute('name');
  const str = computeTextString(el);
  const size = getNum(el, 'size', 30);
  const bold = el.getAttribute('bold') === 'true';
  const family = fontFamilyFor(el.getAttribute('typeface'));
  ctx.font = `${bold ? 'bold ' : ''}${size}px "${family}"`;
  const measuredW = ctx.measureText(str).width;
  if (name) Engine.elementRefs.set(name, {
    textWidth: measuredW,
    textHeight: size
  });
  if (a <= .003) return;
  const x = getNum(el, 'x', 0), y = getNum(el, 'y', 0);
  const boxW = hasAttr(el, 'w') ? getNum(el, 'w', 0) : 0;
  const boxH = hasAttr(el, 'h') ? getNum(el, 'h', 0) : 0;
  const align = el.getAttribute('align') || 'left';
  const alignV = el.getAttribute('alignV') || 'top';
  const tx = boxW > 0 ? align === 'center' ? x + boxW / 2 : align === 'right' ? x + boxW : x : x;
  const ty = boxH > 0 ? alignV === 'center' ? y + boxH / 2 : alignV === 'bottom' ? y + boxH : y : y;
  ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
  ctx.textBaseline = alignV === 'center' ? 'middle' : alignV === 'bottom' ? 'bottom' : 'top';
  ctx.globalAlpha = a;
  ctx.fillStyle = resolveColor(el.getAttribute('color'));
  if (el.getAttribute('multiLine') === 'true' && boxW > 0) {
    const words = str.split(/\s+/), lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= boxW || !line) line = test; else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    const lineH = size * 1.12;
    let firstY = ty;
    if (alignV === 'center') firstY = ty - (lines.length - 1) * lineH / 2; else if (alignV === 'bottom') firstY = ty - (lines.length - 1) * lineH;
    ctx.textBaseline = 'top';
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], tx, firstY + i * lineH);
  } else {
    ctx.fillText(str, tx, ty);
  }
}
