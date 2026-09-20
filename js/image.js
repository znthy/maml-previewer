import { Engine } from './engine.js';

import { toNum, toStr, clamp } from './utils.js';

import { evaluate } from './expr.js';

import { SKIP_TAGS, getNum, getAlpha, hasAttr, rawAttr, curAlpha, applyAlign } from './render.js';

import { ctx } from './stage.js';

import { getElementAnimProps } from './animation.js';

import { getImage, preloadImage, insertSuffix, insertDotSuffix } from './assets.js';

export function imageNumberInfo(el) {
  const srcExp = el.getAttribute('srcExp');
  const src = srcExp ? toStr(evaluate(srcExp)) : el.getAttribute('src') || '';
  const raw = el.getAttribute('number');
  let n = Math.trunc(toNum(raw == null ? '0' : evaluate(raw)));
  if (!Number.isFinite(n)) n = 0;
  const text = String(Math.abs(n));
  const gap = el.hasAttribute('space') ? getNum(el, 'space', 0) : 0;
  const imgs = text.split('').map(d => getImage(insertSuffix(src, Number(d))));
  const widths = imgs.map(im => im && im.naturalWidth || 40);
  const heights = imgs.map(im => im && im.naturalHeight || 60);
  return {
    src: src,
    text: text,
    gap: gap,
    imgs: imgs,
    widths: widths,
    height: Math.max(1, ...heights),
    totalW: widths.reduce((a, b) => a + b, 0) + Math.max(0, widths.length - 1) * gap
  };
}

export function resolveImagePath(el) {
  let src = null;
  const srcExp = el.getAttribute('srcExp');
  if (srcExp != null) src = toStr(evaluate(srcExp)); else if (el.hasAttribute('src')) src = el.getAttribute('src');
  if (!src) return null;
  const idAttr = el.tagName === 'ImageNumber' ? el.getAttribute('number') : el.getAttribute('srcid');
  if (idAttr != null && String(idAttr).trim() !== '') {
    const idv = Math.trunc(toNum(evaluate(idAttr)));
    return insertSuffix(src, idv);
  }
  return src;
}

export function drawImageEl(el, ownAlpha) {
  const anim = getElementAnimProps(el);
  const isNum = el.tagName === 'ImageNumber';
  const numberInfo = isNum ? imageNumberInfo(el) : null;
  const path = anim.src || (isNum ? numberInfo.src : resolveImagePath(el));
  const name = el.getAttribute('name');
  if (!path) return;
  const x = anim.x != null ? anim.x : getNum(el, 'x', 0), y = anim.y != null ? anim.y : getNum(el, 'y', 0);
  const hasW = hasAttr(el, 'w') || anim.w != null, hasH = hasAttr(el, 'h') || anim.h != null;
  const baseImg = !isNum ? getImage(path) : null;
  const natW = baseImg && baseImg.naturalWidth || 0, natH = baseImg && baseImg.naturalHeight || 0;
  const w = anim.w != null ? anim.w : hasW ? getNum(el, 'w', 0) : natW;
  const h = anim.h != null ? anim.h : hasH ? getNum(el, 'h', 0) : natH;
  const align = el.getAttribute('align') || 'left', alignV = el.getAttribute('alignV') || 'top';
  const drawW = isNum ? numberInfo.totalW : w, drawH = isNum ? numberInfo.height : h;
  const [dx, dy] = applyAlign(x, y, drawW, drawH, align, alignV);
  const rot = anim.rotation != null ? anim.rotation : getNum(el, 'rotation', getNum(el, 'angle', 0));
  const scale = getNum(el, 'scale', 1);
  const pivotX = getNum(el, 'pivotX', getNum(el, 'centerX', 0)), pivotY = getNum(el, 'pivotY', getNum(el, 'centerY', 0));
  const a = curAlpha((anim.alpha != null ? clamp(anim.alpha, 0, 255) : getAlpha(el)) / 255);
  if (name) {
    Engine.elementRefs.set(name, {
      bmpWidth: drawW,
      bmpHeight: drawH,
      actualW: w,
      actualH: h
    });
  }
  if (a <= .003) return;
  ctx.save();
  ctx.globalAlpha = a;
  if (rot || scale !== 1) {
    ctx.translate(dx + pivotX, dy + pivotY);
    ctx.rotate(rot * Math.PI / 180);
    ctx.scale(scale, scale);
    ctx.translate(-(dx + pivotX), -(dy + pivotY));
  }
  if (isNum) {
    let cursor = dx;
    for (let i = 0; i < numberInfo.imgs.length; i++) {
      const im = numberInfo.imgs[i], iw = numberInfo.widths[i];
      if (im && im.complete && im.naturalWidth) ctx.drawImage(im, cursor, dy, iw, numberInfo.height); else if (document.getElementById('showPlaceholders').checked) {
        ctx.strokeStyle = 'rgba(255,80,220,.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cursor + .5, dy + .5, iw - 1, numberInfo.height - 1);
      }
      cursor += iw + (i < numberInfo.imgs.length - 1 ? numberInfo.gap : 0);
    }
  } else if (baseImg && baseImg.complete && natW > 0) {
    ctx.drawImage(baseImg, dx, dy, w || natW, h || natH);
  } else if (document.getElementById('showPlaceholders').checked) {
    ctx.strokeStyle = 'rgba(255,80,220,.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dx + .5, dy + .5, (w || 40) - 1, (h || 40) - 1);
  }
  ctx.restore();
}

export function collectDigitSources(el, out) {
  if (SKIP_TAGS.has(el.tagName)) return;
  if (el.tagName === 'Time' && el.hasAttribute('src') && !el.hasAttribute('srcExp')) {
    const base = el.getAttribute('src');
    for (let d = 0; d < 10; d++) out.push(preloadImage(insertSuffix(base, d)));
    out.push(preloadImage(insertDotSuffix(base)));
  } else if (el.tagName === 'ImageNumber' && hasAttr(el, 'src') && !el.hasAttribute('srcExp')) {
    const base = rawAttr(el, 'src');
    for (let d = 0; d < 10; d++) out.push(preloadImage(insertSuffix(base, d)));
  }
  for (const c of Array.from(el.children)) collectDigitSources(c, out);
}

export function drawWallpaperEl(el, ownAlpha) {
  const a = curAlpha(ownAlpha);
  const x = getNum(el, 'x', 0), y = getNum(el, 'y', 0);
  const w = getNum(el, 'w', Engine.screenW), h = getNum(el, 'h', Engine.screenH);
  ctx.save();
  ctx.globalAlpha = a;
  if (Engine.wallpaperPath) {
    const img = getImage(Engine.wallpaperPath);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      return;
    }
  }
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#2b3040');
  g.addColorStop(1, '#0e1016');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
