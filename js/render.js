import { Engine } from './engine.js';

import { toNum, clamp } from './utils.js';

import { evaluate } from './expr.js';

import { getElementAnim, getElementAnimProps } from './animation.js';

import { imageNumberInfo, resolveImagePath, drawImageEl, drawWallpaperEl } from './image.js';

import { computeTextString, drawTextEl } from './text.js';

import { formatDate, drawDateTimeEl, drawTimeEl } from './clock.js';

import { handleButton, registerSliderHitbox } from './interaction.js';

import { drawVideoPlaceholder } from './media.js';

import { fontFamilyFor, getImage } from './assets.js';

import { updateWatchPanel } from './ui.js';

import { runCommandsIn } from './commands.js';

import { canvas, ctx } from './stage.js';

import { logOnce } from './log.js';

export const SKIP_TAGS = new Set([ 'Var', 'VarArray', 'ExternalCommands', 'VariableBinders', 'FramerateController', 'Triggers', 'Trigger', 'NormalState', 'PressedState', 'ReachedState', 'StartPoint', 'EndPoint', 'Path', 'Position', 'PositionAnimation', 'SizeAnimation', 'AlphaAnimation', 'RotationAnimation', 'SourcesAnimation', 'VariableAnimation', 'AniFrame', 'Mask', 'Normal', 'Pressed' ]);

let alphaStack = [ 1 ];

export let frameButtons = [];

export let frameSliders = [];

export function getVis(el) {
  const name = el.getAttribute('name');
  if (name && Engine.visOverrides.has(name)) return Engine.visOverrides.get(name);
  if (!el.hasAttribute('visibility')) return 1;
  return toNum(evaluate(el.getAttribute('visibility')));
}

export function getAlpha(el) {
  if (!el.hasAttribute('alpha')) return 255;
  return toNum(evaluate(el.getAttribute('alpha')));
}

export const ATTR_ALIASES = {
  w: 'width',
  h: 'height',
  width: 'w',
  height: 'h',
  rotation: 'angle',
  angle: 'rotation',
  pivotX: 'centerX',
  centerX: 'pivotX',
  pivotY: 'centerY',
  centerY: 'pivotY'
};

export function hasAttr(el, attr) {
  return el.hasAttribute(attr) || ATTR_ALIASES[attr] != null && el.hasAttribute(ATTR_ALIASES[attr]);
}

export function rawAttr(el, attr) {
  if (el.hasAttribute(attr)) return el.getAttribute(attr);
  const alt = ATTR_ALIASES[attr];
  if (alt != null && el.hasAttribute(alt)) return el.getAttribute(alt);
  return null;
}

export function getNum(el, attr, def) {
  const v = rawAttr(el, attr);
  if (v == null) return def;
  return toNum(evaluate(v));
}

export function prepass(el) {
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return;
  const name = el.getAttribute('name');
  if ((tag === 'Image' || tag === 'ImageNumber') && name) {
    getElementAnim(el);
    if (tag === 'ImageNumber') {
      const info = imageNumberInfo(el);
      Engine.elementRefs.set(name, {
        bmpWidth: info.totalW,
        bmpHeight: info.height,
        actualW: getNum(el, 'w', 0),
        actualH: getNum(el, 'h', 0)
      });
    } else {
      const path = resolveImagePath(el);
      const img = path ? getImage(path) : null;
      const ap = getElementAnimProps(el);
      Engine.elementRefs.set(name, {
        bmpWidth: img && img.naturalWidth || 0,
        bmpHeight: img && img.naturalHeight || 0,
        actualW: getNum(el, 'w', 0),
        actualH: getNum(el, 'h', 0),
        ...ap
      });
    }
  } else if ((tag === 'Text' || tag === 'DateTime') && name) {
    try {
      const str = tag === 'Text' ? computeTextString(el) : formatDate(new Date(Engine.simNow()), el.getAttribute('format') || '');
      const size = getNum(el, 'size', 30);
      ctx.font = `${el.getAttribute('bold') === 'true' ? 'bold ' : ''}${size}px "${fontFamilyFor(el.getAttribute('typeface'))}"`;
      const w = ctx.measureText(str).width;
      Engine.elementRefs.set(name, {
        textWidth: w,
        textHeight: size
      });
    } catch (e) {}
  } else if ((tag === 'Slider' || tag === 'Unlocker') && name) {
    Engine.elementRefs.set(name, {
      moveX: Engine.touch.active ? Engine.touch.x - Engine.touch.beginX : 0,
      moveY: Engine.touch.active ? Engine.touch.y - Engine.touch.beginY : 0,
      state: Engine.touch.active ? 1 : 0
    });
  } else if (tag === 'Time' && name) {
    Engine.elementRefs.set(name, {
      bmpWidth: 0,
      bmpHeight: 0
    });
  }
  for (const c of Array.from(el.children)) prepass(c);
}

export function drawTree(el) {
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return;
  const vis = getVis(el);
  if (vis <= 0) return;
  const ownAlpha = clamp(getAlpha(el), 0, 255) / 255;
  if (tag === 'Group' || tag === 'MusicControl') {
    const anim = getElementAnimProps(el);
    const x = anim.x != null ? anim.x : getNum(el, 'x', 0), y = anim.y != null ? anim.y : getNum(el, 'y', 0);
    const rot = anim.rotation != null ? anim.rotation : getNum(el, 'rotation', getNum(el, 'angle', 0));
    const scale = getNum(el, 'scale', 1);
    const pivotX = getNum(el, 'pivotX', getNum(el, 'centerX', 0));
    const pivotY = getNum(el, 'pivotY', getNum(el, 'centerY', 0));
    const groupAlpha = anim.alpha != null ? clamp(anim.alpha, 0, 255) : getAlpha(el);
    ctx.save();
    ctx.translate(x, y);
    if (rot || scale !== 1) {
      ctx.translate(pivotX, pivotY);
      ctx.rotate(rot * Math.PI / 180);
      ctx.scale(scale, scale);
      ctx.translate(-pivotX, -pivotY);
    }
    alphaStack.push((alphaStack[alphaStack.length - 1] || 1) * (groupAlpha / 255));
    for (const c of Array.from(el.children)) drawTree(c);
    alphaStack.pop();
    ctx.restore();
    return;
  }
  if (tag === 'Image' || tag === 'ImageNumber') {
    drawImageEl(el, ownAlpha);
    return;
  }
  if (tag === 'Wallpaper') {
    drawWallpaperEl(el, ownAlpha);
    return;
  }
  if (tag === 'Text') {
    drawTextEl(el, ownAlpha);
    return;
  }
  if (tag === 'DateTime') {
    drawDateTimeEl(el, ownAlpha);
    return;
  }
  if (tag === 'Time') {
    drawTimeEl(el, ownAlpha);
    return;
  }
  if (tag === 'Button') {
    handleButton(el);
    return;
  }
  if (tag === 'Slider' || tag === 'Unlocker') {
    registerSliderHitbox(el);
    return;
  }
  if (tag === 'Video') {
    drawVideoPlaceholder(el, ownAlpha);
    return;
  }
}

export function curAlpha(own) {
  return (alphaStack[alphaStack.length - 1] || 1) * own;
}

export function applyAlign(x, y, w, h, align, alignV) {
  let dx = x, dy = y;
  if (align === 'center') dx -= w / 2; else if (align === 'right') dx -= w;
  if (alignV === 'center') dy -= h / 2; else if (alignV === 'bottom') dy -= h;
  return [ dx, dy ];
}

export function frameTick() {
  Engine.frameVarCache.clear();
  Engine.resolvingSet.clear();
  frameButtons = [];
  frameSliders = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  alphaStack = [ 1 ];
  if (Engine.loaded && Engine.manifestRoot) {
    ctx.save();
    try {
      for (const t of Engine.thresholdVars) {
        const val = Engine.resolveVar(t.name);
        if (t.last != null && Math.abs(val - t.last) >= t.threshold) runCommandsIn(t.triggerEl);
        t.last = val;
      }
      Engine.elementRefs.clear();
      prepass(Engine.manifestRoot);
      for (const c of Array.from(Engine.manifestRoot.children)) drawTree(c);
    } catch (e) {
      logOnce('frameTick-error', 'Render error: ' + e.message + ' (frame skipped, preview may look blank until fixed)', 'warn');
    } finally {
      ctx.restore();
    }
  }
  Engine.latestButtons = frameButtons;
  Engine.latestSliders = frameSliders;
  updateWatchPanel();
  requestAnimationFrame(frameTick);
}

requestAnimationFrame(frameTick);
