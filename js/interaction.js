import { Engine } from './engine.js';

import { getNum, drawTree, frameButtons, frameSliders } from './render.js';

import { canvas, ctx } from './stage.js';

import { log } from './log.js';

import { runCommandsIn, flashEdge } from './commands.js';

export function rectFromLocal(x, y, w, h) {
  const m = ctx.getTransform();
  const pts = [ [ x, y ], [ x + w, y ], [ x, y + h ], [ x + w, y + h ] ].map(([px, py]) => m.transformPoint(new DOMPoint(px, py)));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

export function handleButton(el) {
  const x = getNum(el, 'x', 0), y = getNum(el, 'y', 0), w = getNum(el, 'w', 0), h = getNum(el, 'h', 0);
  if (w > 0 && h > 0) {
    const rect = rectFromLocal(x, y, w, h);
    frameButtons.push({
      el: el,
      rect: rect
    });
    if (document.getElementById('showHitboxes').checked) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = el === Engine.pressedButtonEl ? 'rgba(124,217,146,.9)' : 'rgba(90,169,255,.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rect.minX, rect.minY, rect.maxX - rect.minX, rect.maxY - rect.minY);
      ctx.restore();
    }
  }
  const state = el === Engine.pressedButtonEl ? 'Pressed' : 'Normal';
  const stateEl = Array.from(el.children).find(c => c.tagName === state) || Array.from(el.children).find(c => c.tagName === 'Normal');
  if (stateEl) {
    for (const c of Array.from(stateEl.children)) drawTree(c);
  }
}

export function registerSliderHitbox(el) {
  const sp = Array.from(el.children).find(c => c.tagName === 'StartPoint');
  const ep = Array.from(el.children).find(c => c.tagName === 'EndPoint');
  if (!sp) return;
  const sx = getNum(sp, 'x', 0), sy = getNum(sp, 'y', 0), sw = getNum(sp, 'w', 0), sh = getNum(sp, 'h', 0);
  const ex = ep ? getNum(ep, 'x', 0) : sx, ey = ep ? getNum(ep, 'y', 0) : sy, ew = ep ? getNum(ep, 'w', 0) : sw, eh = ep ? getNum(ep, 'h', 0) : sh;
  if (sw <= 0 || sh <= 0) return;
  const startRect = rectFromLocal(sx, sy, sw, sh);
  const endRect = rectFromLocal(ex, ey, ew, eh);
  const state = Engine.sliderState.get(el.getAttribute('name') || el) || {
    moveX: 0,
    moveY: 0,
    state: 0,
    reached: false
  };
  const active = Engine.activeSliderEl === el;
  if (active) {
    state.moveX = Engine.touch.x - Engine.touch.beginX;
    state.moveY = Engine.touch.y - Engine.touch.beginY;
    state.state = 1;
    const moved = {
      minX: startRect.minX + state.moveX,
      maxX: startRect.maxX + state.moveX,
      minY: startRect.minY + state.moveY,
      maxY: startRect.maxY + state.moveY
    };
    state.reached = moved.minX <= endRect.maxX && moved.maxX >= endRect.minX && moved.minY <= endRect.maxY && moved.maxY >= endRect.minY;
    if (state.reached) state.state = 2;
  } else if (!Engine.touch.active) {
    state.moveX = 0;
    state.moveY = 0;
    state.state = 0;
    state.reached = false;
  }
  Engine.sliderState.set(el.getAttribute('name') || el, state);
  if (el.getAttribute('name')) Engine.elementRefs.set(el.getAttribute('name'), {
    moveX: state.moveX,
    moveY: state.moveY,
    state: state.state
  });
  frameSliders.push({
    el: el,
    startRect: startRect,
    endRect: endRect
  });
  if (document.getElementById('showHitboxes').checked) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = active ? 'rgba(124,217,146,.9)' : 'rgba(224,166,60,.7)';
    ctx.setLineDash([ 4, 3 ]);
    ctx.strokeRect(startRect.minX + state.moveX, startRect.minY + state.moveY, startRect.maxX - startRect.minX, startRect.maxY - startRect.minY);
    ctx.strokeStyle = 'rgba(90,169,255,.45)';
    ctx.strokeRect(endRect.minX, endRect.minY, endRect.maxX - endRect.minX, endRect.maxY - endRect.minY);
    ctx.restore();
  }
}

export function findTrigger(el, action) {
  const direct = Array.from(el.children).filter(c => c.tagName === 'Trigger');
  const trs = Array.from(el.children).find(c => c.tagName === 'Triggers');
  const wrapped = trs ? Array.from(trs.children).filter(c => c.tagName === 'Trigger') : [];
  return [ ...direct, ...wrapped ].find(c => c.getAttribute('action') === action) || null;
}

export function canvasPoint(evt) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  return {
    x: (evt.clientX - r.left) * sx,
    y: (evt.clientY - r.top) * sy
  };
}

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  const p = canvasPoint(e);
  Engine.touch.active = true;
  Engine.touch.x = p.x;
  Engine.touch.y = p.y;
  Engine.touch.beginX = p.x;
  Engine.touch.beginY = p.y;
  let hit = null;
  for (let i = Engine.latestButtons.length - 1; i >= 0; i--) {
    const b = Engine.latestButtons[i];
    if (p.x >= b.rect.minX && p.x <= b.rect.maxX && p.y >= b.rect.minY && p.y <= b.rect.maxY) {
      hit = b;
      break;
    }
  }
  Engine.activeButtonEl = hit ? hit.el : null;
  Engine.pressedButtonEl = hit ? hit.el : null;
  Engine.activeSliderEl = null;
  for (let i = Engine.latestSliders.length - 1; i >= 0; i--) {
    const q = Engine.latestSliders[i], r = q.startRect;
    if (p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY) {
      Engine.activeSliderEl = q.el;
      break;
    }
  }
  if (hit) {
    const tr = findTrigger(hit.el, 'down');
    if (tr) runCommandsIn(tr);
  }
});

canvas.addEventListener('pointermove', e => {
  if (!Engine.touch.active) return;
  const p = canvasPoint(e);
  Engine.touch.x = p.x;
  Engine.touch.y = p.y;
});

canvas.addEventListener('pointerup', e => {
  const p = canvasPoint(e);
  Engine.touch.x = p.x;
  Engine.touch.y = p.y;
  let reachedUnlock = false;
  if (Engine.activeSliderEl) {
    const nm = Engine.activeSliderEl.getAttribute('name');
    const st = Engine.sliderState.get(nm || Engine.activeSliderEl);
    reachedUnlock = Engine.activeSliderEl.tagName === 'Unlocker' && !!(st && st.reached);
    const tr = findTrigger(Engine.activeSliderEl, 'up');
    if (tr) runCommandsIn(tr);
  }
  if (Engine.activeButtonEl) {
    const tr = findTrigger(Engine.activeButtonEl, 'up');
    if (tr) runCommandsIn(tr);
  }
  if (reachedUnlock) {
    Engine.unlockReached = true;
    log('🔓 Unlocker reached EndPoint — unlock gesture accepted.', 'act');
    flashEdge('#7cd992');
  }
  Engine.activeButtonEl = null;
  Engine.pressedButtonEl = null;
  Engine.activeSliderEl = null;
  Engine.touch.active = false;
});

canvas.addEventListener('pointercancel', () => {
  Engine.activeButtonEl = null;
  Engine.pressedButtonEl = null;
  Engine.activeSliderEl = null;
  Engine.touch.active = false;
});
