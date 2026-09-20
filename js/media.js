import { Engine } from './engine.js';

import { getNum, curAlpha } from './render.js';

import { ctx } from './stage.js';

export function drawVideoPlaceholder(el, ownAlpha) {
  const a = curAlpha(ownAlpha);
  if (a <= .003) return;
  const x = getNum(el, 'x', 0), y = getNum(el, 'y', 0);
  const w = getNum(el, 'w', Engine.screenW), h = getNum(el, 'h', 400);
  ctx.save();
  ctx.globalAlpha = a * .5;
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▶ ' + (el.getAttribute('src') || 'video'), x + w / 2, y + h / 2);
  ctx.restore();
}
