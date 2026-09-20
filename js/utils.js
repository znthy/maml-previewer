export const NULLV = Symbol('null');

export function toNum(v) {
  if (v === NULLV || v == null) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function toStr(v) {
  if (v === NULLV || v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function splitTopLevel(str, sep) {
  const out = [];
  let depth = 0, cur = '', inStr = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      cur += c;
      if (c === "'" && str[i - 1] !== '\\') inStr = false;
      continue;
    }
    if (c === "'") {
      inStr = true;
      cur += c;
      continue;
    }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === sep && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim().length || out.length) out.push(cur);
  return out.map(s => s.trim()).filter(s => s.length);
}

export function sprintf(fmt, args) {
  let i = 0;
  return String(fmt).replace(/%(-?\d+)?(?:\.(\d+))?([dsf%])/g, (m, width, prec, type) => {
    if (type === '%') return '%';
    const val = args[i++];
    if (type === 'd') return String(Math.trunc(toNum(val)));
    if (type === 'f') return toNum(val).toFixed(prec ? parseInt(prec) : 2);
    return toStr(val);
  });
}
