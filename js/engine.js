import { toNum, toStr, clamp } from './utils.js';

import { logOnce } from './log.js';

import { evaluate } from './expr.js';

export const Engine = {
  zip: null,
  fileIndex: [],
  manifestDir: '',
  manifestRoot: null,
  varDecls: new Map,
  thresholdVars: [],
  contentProviderVarColumn: new Map,
  overrides: new Map,
  visOverrides: new Map,
  animState: new Map,
  imageCache: new Map,
  blobPromiseCache: new Map,
  fontFamilies: new Map,
  elementRefs: new Map,
  frameVarCache: new Map,
  resolvingSet: new Set,
  elementAnimState: new Map,
  elementAnims: new Map,
  declCounter: 0,
  loaded: false,
  wallpaperPath: null,
  originalManifestText: '',
  originalManifestPath: '',
  touch: {
    active: false,
    x: 0,
    y: 0,
    beginX: 0,
    beginY: 0
  },
  screenW: 1080,
  screenH: 1920,
  resumeTrigger: null,
  pauseTrigger: null,
  latestButtons: [],
  activeButtonEl: null,
  pressedButtonEl: null,
  latestSliders: [],
  activeSliderEl: null,
  sliderState: new Map,
  unlockReached: false,
  clock: {
    override: false,
    base: Date.now(),
    setAt: Date.now(),
    speed: 1
  },
  sim: {
    battLevel: 82,
    battState: 0,
    ringMode: 2,
    volLevel: 60,
    missedCalls: 0,
    unreadSms: 0,
    tiltX: 0,
    tiltY: 0,
    timeFormat24: 0,
    weatherSim: true,
    wCity: 'San Francisco',
    wCond: 'Sunny',
    wTemp: 21,
    wHigh: 24,
    wLow: 14
  },
  needsMissingLog: new Set
};

Engine.simNow = function() {
  if (this.clock.override) return this.clock.base + (Date.now() - this.clock.setAt) * this.clock.speed;
  return Date.now();
};

Engine.resolveVar = function(name) {
  if (this.frameVarCache.has(name)) return this.frameVarCache.get(name);
  if (this.resolvingSet.has(name)) return 0;
  this.resolvingSet.add(name);
  let val;
  if (this.contentProviderVarColumn.has(name)) {
    val = this.weatherValueFor(name);
  } else if (this.varDecls.has(name)) {
    val = this.resolveDecl(this.varDecls.get(name));
  } else if (BUILTINS.hasOwnProperty(name)) {
    val = BUILTINS[name]();
  } else {
    val = 0;
    if (!this.needsMissingLog.has(name)) {
      this.needsMissingLog.add(name);
      logOnce('var:' + name, 'Unresolved variable: #' + name + ' / @' + name + ' (defaulting to 0)');
    }
  }
  this.resolvingSet.delete(name);
  this.frameVarCache.set(name, val);
  return val;
};

Engine.resolveDecl = function(decl) {
  if (decl.kind === 'vararray') {
    let idx = Math.floor(toNum(evaluate(decl.indexExpr)));
    if (!decl.items.length) return decl.type === 'string' ? '' : 0;
    idx = clamp(idx, 0, decl.items.length - 1);
    const item = decl.items[idx];
    return decl.type === 'string' ? item : parseFloat(item) || 0;
  }
  if (decl.hasAnimation) return this.computeAnim(decl);
  if (this.overrides.has(decl.name)) return this.overrides.get(decl.name);
  const v = evaluate(decl.expression);
  return decl.type === 'string' ? toStr(v) : toNum(v);
};

Engine.computeAnim = function(decl) {
  let st = this.animState.get(decl.nodeId);
  if (!st) {
    st = {
      started: !decl.initPause,
      startTime: decl.initPause ? null : this.simNow(),
      frozen: null
    };
    this.animState.set(decl.nodeId, st);
  }
  if (!st.started) return evaluate(decl.frames[0].value);
  if (st.frozen != null) return st.frozen;
  const last = decl.frames[decl.frames.length - 1].time;
  let elapsed = this.simNow() - st.startTime;
  if (decl.loop === false) elapsed = Math.min(elapsed, last); else elapsed = last > 0 ? (elapsed % last + last) % last : 0;
  let f0 = decl.frames[0], f1 = decl.frames[decl.frames.length - 1];
  for (let k = 0; k < decl.frames.length - 1; k++) {
    if (elapsed >= decl.frames[k].time && elapsed <= decl.frames[k + 1].time) {
      f0 = decl.frames[k];
      f1 = decl.frames[k + 1];
      break;
    }
  }
  if (decl.type === 'string') return toStr(evaluate(f0.value));
  const v0 = toNum(evaluate(f0.value)), v1 = toNum(evaluate(f1.value));
  const span = f1.time - f0.time || 1;
  const t = clamp((elapsed - f0.time) / span, 0, 1);
  return v0 + (v1 - v0) * t;
};

Engine.startAnim = function(name) {
  const decl = this.varDecls.get(name);
  if (!decl || !decl.hasAnimation) return;
  this.animState.set(decl.nodeId, {
    started: true,
    startTime: this.simNow(),
    frozen: null
  });
};

Engine.stopAnim = function(name) {
  const decl = this.varDecls.get(name);
  if (!decl || !decl.hasAnimation) return;
  const cur = this.resolveDecl(decl);
  this.animState.set(decl.nodeId, {
    started: true,
    startTime: this.simNow(),
    frozen: cur
  });
};

export const BUILTINS = {
  time: () => Engine.simNow(),
  time_sys: () => Date.now(),
  hour24: () => new Date(Engine.simNow()).getHours(),
  hour: () => new Date(Engine.simNow()).getHours(),
  hour12: () => {
    let h = new Date(Engine.simNow()).getHours() % 12;
    return h ? h : 12;
  },
  minute: () => new Date(Engine.simNow()).getMinutes(),
  second: () => new Date(Engine.simNow()).getSeconds(),
  year: () => new Date(Engine.simNow()).getFullYear(),
  month: () => new Date(Engine.simNow()).getMonth(),
  date: () => new Date(Engine.simNow()).getDate(),
  day_of_week: () => new Date(Engine.simNow()).getDay() + 1,
  time_format: () => Engine.sim.timeFormat24 ? 1 : 0,
  screen_width: () => Engine.screenW,
  screen_height: () => Engine.screenH,
  battery_level: () => Engine.sim.battLevel,
  battery_state: () => Engine.sim.battState,
  ring_mode: () => Engine.sim.ringMode,
  volume_level: () => Engine.sim.volLevel,
  call_missed_count: () => Engine.sim.missedCalls,
  sms_unread_count: () => Engine.sim.unreadSms,
  wifi_state: () => 1,
  data_state: () => 1,
  shake: () => 0,
  steps_value: () => 0,
  gx: () => Engine.sim.tiltX,
  gy: () => Engine.sim.tiltY,
  gz: () => 0,
  x_acc: () => Engine.sim.tiltX * 9.8,
  y_acc: () => Engine.sim.tiltY * 9.8,
  z_acc: () => 9.8,
  touch_x: () => Engine.touch.x,
  touch_y: () => Engine.touch.y,
  touch_begin_x: () => Engine.touch.beginX,
  touch_begin_y: () => Engine.touch.beginY,
  touch_pressure: () => Engine.touch.active ? 1 : 0
};
