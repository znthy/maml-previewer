import { Engine } from './engine.js';

import { getNum, hasAttr, curAlpha, applyAlign } from './render.js';

import { ctx } from './stage.js';

import { resolveColor } from './color.js';

import { fontFamilyFor, getImage, insertSuffix, insertDotSuffix } from './assets.js';

export const WEEKDAY_LONG = [ 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ];

export const WEEKDAY_SHORT = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];

export const MONTH_LONG = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];

export const MONTH_SHORT = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];

export function formatDate(d, fmt) {
  const y = d.getFullYear(), Mo = d.getMonth(), da = d.getDate(), wd = d.getDay();
  let h24 = d.getHours();
  let h12 = h24 % 12;
  h12 = h12 ? h12 : 12;
  const mi = d.getMinutes(), se = d.getSeconds();
  const tokenRe = /yyyy|yyy|yy|y|MMMM|MMM|MM|M|dd|d|EEEE|EEE|EE|E|NNNN|HH|H|kk|k|KK|K|hh|h|mm|m|ss|s|a|A|z+/g;
  return String(fmt).replace(tokenRe, tok => {
    switch (tok) {
     case 'yyyy':
     case 'yyy':
      return String(y);

     case 'yy':
      return String(y).slice(-2);

     case 'y':
      return String(y);

     case 'MMMM':
      return MONTH_LONG[Mo];

     case 'MMM':
      return MONTH_SHORT[Mo];

     case 'MM':
      return String(Mo + 1).padStart(2, '0');

     case 'M':
      return String(Mo + 1);

     case 'dd':
      return String(da).padStart(2, '0');

     case 'd':
      return String(da);

     case 'EEEE':
      return WEEKDAY_LONG[wd];

     case 'EEE':
     case 'EE':
      return WEEKDAY_SHORT[wd];

     case 'E':
      return WEEKDAY_SHORT[wd][0];

     case 'NNNN':
      return '(lunar)';

     case 'HH':
      return String(h24).padStart(2, '0');

     case 'H':
      return String(h24);

     case 'kk':
      return String(h24 === 0 ? 24 : h24).padStart(2, '0');

     case 'k':
      return String(h24 === 0 ? 24 : h24);

     case 'KK':
      return String(h24 % 12).padStart(2, '0');

     case 'K':
      return String(h24 % 12);

     case 'hh':
      return String(h12).padStart(2, '0');

     case 'h':
      return String(h12);

     case 'mm':
      return String(mi).padStart(2, '0');

     case 'm':
      return String(mi);

     case 'ss':
      return String(se).padStart(2, '0');

     case 's':
      return String(se);

     case 'a':
      return h24 < 12 ? 'am' : 'pm';

     case 'A':
      return h24 < 12 ? 'AM' : 'PM';

     default:
      return tok.startsWith('z') ? 'GMT' : tok;
    }
  });
}

export function drawDateTimeEl(el, ownAlpha) {
  const a = curAlpha(ownAlpha);
  const name = el.getAttribute('name');
  const str = formatDate(new Date(Engine.simNow()), el.getAttribute('format') || 'yyyy-MM-dd');
  const size = getNum(el, 'size', 30);
  const bold = el.getAttribute('bold') === 'true';
  const family = fontFamilyFor(el.getAttribute('typeface'));
  ctx.font = `${bold ? 'bold ' : ''}${size}px "${family}"`;
  const w = ctx.measureText(str).width;
  if (name) Engine.elementRefs.set(name, {
    textWidth: w,
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
  ctx.fillText(str, tx, ty);
}

export function drawTimeEl(el, ownAlpha) {
  const src = el.getAttribute('src');
  if (!src) return;
  const use24 = Engine.sim.timeFormat24;
  const hh = use24 ? new Date(Engine.simNow()).getHours() : (() => {
    let h = new Date(Engine.simNow()).getHours() % 12;
    return h ? h : 12;
  })();
  const mm = new Date(Engine.simNow()).getMinutes();
  const digits = [ Math.floor(hh / 10), hh % 10, 'dot', Math.floor(mm / 10), mm % 10 ];
  const imgs = digits.map(d => d === 'dot' ? getImage(insertDotSuffix(src)) : getImage(insertSuffix(src, d)));
  const widths = imgs.map(im => im && im.naturalWidth || 40);
  const heightMax = Math.max(1, ...imgs.map(im => im && im.naturalHeight || 60));
  const totalW = widths.reduce((a, b) => a + b, 0);
  const x = getNum(el, 'x', 0), y = getNum(el, 'y', 0);
  const align = el.getAttribute('align') || 'left';
  const alignV = el.getAttribute('alignV') || 'top';
  const [dx, dy] = applyAlign(x, y, totalW, heightMax, align, alignV);
  const name = el.getAttribute('name');
  if (name) Engine.elementRefs.set(name, {
    bmpWidth: totalW,
    bmpHeight: heightMax
  });
  const a = curAlpha(ownAlpha);
  if (a <= .003) return;
  ctx.save();
  ctx.globalAlpha = a;
  let cursor = dx;
  for (let i = 0; i < imgs.length; i++) {
    const im = imgs[i];
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, cursor, dy);
    cursor += widths[i];
  }
  ctx.restore();
}

const clockDateInput = document.getElementById('clockDate');

(function initDate() {
  const d = new Date;
  clockDateInput.value = d.toISOString().slice(0, 10);
})();

function applyClockOverride() {
  const on = document.getElementById('clockOverride').checked;
  Engine.clock.override = on;
  if (on) {
    const [hh, mm, ss] = document.getElementById('clockTime').value.split(':').map(Number);
    const [Y, M, D] = clockDateInput.value.split('-').map(Number);
    const d = new Date(Y, M - 1, D, hh || 0, mm || 0, ss || 0);
    Engine.clock.base = d.getTime();
    Engine.clock.setAt = Date.now();
  }
}

document.getElementById('clockOverride').addEventListener('change', applyClockOverride);

document.getElementById('clockTime').addEventListener('change', applyClockOverride);

document.getElementById('clockDate').addEventListener('change', applyClockOverride);

document.getElementById('clockSpeed').addEventListener('input', e => {
  const speeds = [ 0, 1, 5, 30, 120 ];
  const idx = parseInt(e.target.value);
  Engine.clock.speed = speeds[idx];
  document.getElementById('clockSpeedVal').textContent = idx === 0 ? 'paused' : speeds[idx] + '×';
  if (Engine.clock.override) {
    applyClockOverride();
  }
});
