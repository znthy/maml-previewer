import { Engine } from './engine.js';

import { toNum, clamp } from './utils.js';

import { evaluate } from './expr.js';

export function parseElementAnimations(el) {
  const out = [];
  const specs = [ [ 'PositionAnimation', 'position' ], [ 'SizeAnimation', 'size' ], [ 'AlphaAnimation', 'alpha' ], [ 'RotationAnimation', 'rotation' ], [ 'SourcesAnimation', 'sources' ] ];
  for (const [tag, kind] of specs) {
    const a = Array.from(el.children).find(c => c.tagName === tag);
    if (!a) continue;
    const frames = Array.from(a.children).filter(c => c.tagName === 'Position' || c.tagName === 'Size' || c.tagName === 'Alpha' || c.tagName === 'Rotation' || c.tagName === 'Source').map(f => ({
      time: parseFloat(f.getAttribute('time')) || 0,
      node: f
    }));
    if (!frames.length) continue;
    out.push({
      kind: kind,
      frames: frames,
      loop: a.getAttribute('loop') !== 'false',
      initPause: a.getAttribute('initPause') === 'true',
      id: (el.getAttribute('name') || 'anon') + '@' + tag
    });
  }
  return out;
}

export function getElementAnim(el) {
  let anims = Engine.elementAnims.get(el);
  if (anims === undefined) {
    anims = parseElementAnimations(el);
    Engine.elementAnims.set(el, anims);
  }
  return anims;
}

export function elementAnimState(anim) {
  let st = Engine.elementAnimState.get(anim.id);
  if (!st) {
    st = {
      started: !anim.initPause,
      startTime: anim.initPause ? null : Engine.simNow(),
      frozen: null
    };
    Engine.elementAnimState.set(anim.id, st);
  }
  return st;
}

export function startElementAnim(name) {
  let found = false;
  for (const [el, anims] of Engine.elementAnims) {
    if (el.getAttribute('name') !== name) continue;
    for (const a of anims) {
      Engine.elementAnimState.set(a.id, {
        started: true,
        startTime: Engine.simNow(),
        frozen: null
      });
      found = true;
    }
  }
  return found;
}

export function stopElementAnim(name) {
  let found = false;
  for (const [el, anims] of Engine.elementAnims) {
    if (el.getAttribute('name') !== name) continue;
    for (const a of anims) {
      const st = elementAnimState(a);
      st.frozen = elementAnimValue(el, a, Engine.simNow());
      st.started = true;
      found = true;
    }
  }
  return found;
}

export function elementAnimValue(el, anim, now) {
  const st = elementAnimState(anim);
  if (!st.started) {
    const n = anim.frames[0].node;
    return anim.kind === 'sources' ? n.getAttribute('src') || '' : null;
  }
  if (st.frozen != null) return st.frozen;
  const last = anim.frames[anim.frames.length - 1].time;
  let elapsed = now - st.startTime;
  if (anim.loop === false) elapsed = Math.min(Math.max(elapsed, 0), last); else elapsed = last > 0 ? (elapsed % last + last) % last : 0;
  let f0 = anim.frames[0], f1 = anim.frames[anim.frames.length - 1];
  for (let k = 0; k < anim.frames.length - 1; k++) {
    if (elapsed >= anim.frames[k].time && elapsed <= anim.frames[k + 1].time) {
      f0 = anim.frames[k];
      f1 = anim.frames[k + 1];
      break;
    }
  }
  if (anim.kind === 'sources') {
    return elapsed < f1.time ? f0.node.getAttribute('src') || '' : f1.node.getAttribute('src') || '';
  }
  const attrs = anim.kind === 'position' ? [ 'x', 'y' ] : anim.kind === 'size' ? [ 'w', 'h' ] : anim.kind === 'alpha' ? [ 'a' ] : [ 'angle' ];
  const vals = {};
  const span = f1.time - f0.time || 1, t = clamp((elapsed - f0.time) / span, 0, 1);
  for (const attr of attrs) {
    const a0 = f0.node.getAttribute(attr), a1 = f1.node.getAttribute(attr);
    const v0 = toNum(evaluate(a0 == null ? '0' : a0)), v1 = toNum(evaluate(a1 == null ? a0 == null ? '0' : a0 : a1));
    vals[attr] = v0 + (v1 - v0) * t;
  }
  return vals;
}

export function getElementAnimProps(el) {
  const props = {};
  for (const a of getElementAnim(el)) {
    const v = elementAnimValue(el, a, Engine.simNow());
    if (v == null) continue;
    if (a.kind === 'sources' && v) props.src = v; else if (a.kind === 'position') Object.assign(props, {
      x: v.x,
      y: v.y
    }); else if (a.kind === 'size') Object.assign(props, {
      w: v.w,
      h: v.h
    }); else if (a.kind === 'alpha') props.alpha = v.a; else if (a.kind === 'rotation') props.rotation = v.angle;
  }
  return props;
}

Engine.resolveProp = function(name, prop) {
  const er = this.elementRefs.get(name);
  if (!er) return 0;
  switch (prop) {
   case 'bmp_width':
    return er.bmpWidth || 0;

   case 'bmp_height':
    return er.bmpHeight || 0;

   case 'actual_w':
    return er.actualW || er.bmpWidth || 0;

   case 'actual_h':
    return er.actualH || er.bmpHeight || 0;

   case 'text_width':
    return er.textWidth || 0;

   case 'text_height':
    return er.textHeight || 0;

   case 'move_x':
    return er.moveX || 0;

   case 'move_y':
    return er.moveY || 0;

   case 'move_dist':
    return Math.hypot(er.moveX || 0, er.moveY || 0);

   case 'state':
    return er.state || 0;

   default:
    return 0;
  }
};
