export const warnedOnce = new Set;

export function log(msg, cls) {
  const el = document.getElementById('log');
  const d = document.createElement('div');
  if (cls) d.className = cls;
  const t = (new Date).toLocaleTimeString();
  d.textContent = `[${t}] ${msg}`;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 300) el.removeChild(el.firstChild);
}

export function logOnce(key, msg, cls) {
  if (warnedOnce.has(key)) return;
  warnedOnce.add(key);
  log(msg, cls || 'warn');
}
