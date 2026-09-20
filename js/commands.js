import { Engine } from './engine.js';

import { toNum } from './utils.js';

import { evaluate } from './expr.js';

import { log } from './log.js';

import { startElementAnim, stopElementAnim } from './animation.js';

import { canvas } from './stage.js';

export function collectDecls(el) {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName;
    if (tag === 'Var') {
      const name = child.getAttribute('name');
      if (name) {
        const animEl = Array.from(child.children).find(c => c.tagName === 'VariableAnimation');
        let decl;
        if (animEl) {
          const frames = Array.from(animEl.children).filter(c => c.tagName === 'AniFrame').map(f => ({
            time: parseFloat(f.getAttribute('time')) || 0,
            value: f.getAttribute('value') || '0'
          }));
          decl = {
            kind: 'var',
            name: name,
            type: (child.getAttribute('type') || 'number').toLowerCase(),
            hasAnimation: true,
            frames: frames,
            loop: animEl.getAttribute('loop') !== 'false',
            initPause: animEl.getAttribute('initPause') === 'true',
            nodeId: name + '#' + Engine.declCounter++
          };
        } else {
          decl = {
            kind: 'var',
            name: name,
            type: (child.getAttribute('type') || 'number').toLowerCase(),
            hasAnimation: false,
            expression: child.getAttribute('expression') || '0'
          };
        }
        Engine.varDecls.set(name, decl);
        const thAttr = child.getAttribute('threshold');
        const trigEl = Array.from(child.children).find(c => c.tagName === 'Trigger');
        if (thAttr != null && trigEl) Engine.thresholdVars.push({
          name: name,
          threshold: parseFloat(thAttr) || 1,
          triggerEl: trigEl,
          last: null
        });
      }
    } else if (tag === 'VarArray') {
      const typeAttr = child.getAttribute('type') || 'number';
      const varsEl = Array.from(child.children).find(c => c.tagName === 'Vars');
      const itemsEl = Array.from(child.children).find(c => c.tagName === 'Items');
      const items = itemsEl ? Array.from(itemsEl.children).filter(c => c.tagName === 'Item').map(i => i.getAttribute('value') || '') : [];
      if (varsEl) {
        for (const v of Array.from(varsEl.children)) {
          if (v.tagName !== 'Var') continue;
          const nm = v.getAttribute('name');
          if (!nm) continue;
          Engine.varDecls.set(nm, {
            kind: 'vararray',
            name: nm,
            type: (v.getAttribute('type') || typeAttr || 'number').toLowerCase(),
            indexExpr: v.getAttribute('index') || '0',
            items: items
          });
        }
      }
      continue;
    } else if (tag === 'ContentProviderBinder') {
      for (const v of Array.from(child.children)) {
        if (v.tagName === 'Variable') {
          const nm = v.getAttribute('name');
          if (nm) Engine.contentProviderVarColumn.set(nm, v.getAttribute('column') || '');
        }
      }
    } else if (tag === 'ExternalCommands') {
      for (const t of Array.from(child.children)) {
        if (t.tagName === 'Trigger') {
          if (t.getAttribute('action') === 'resume') Engine.resumeTrigger = t;
          if (t.getAttribute('action') === 'pause') Engine.pauseTrigger = t;
        }
      }
    }
    collectDecls(child);
  }
}

export function runCommandsIn(triggerEl) {
  if (!triggerEl) return;
  for (const cmd of Array.from(triggerEl.children)) runCommandEl(cmd);
}

function runCommandEl(cmdEl) {
  const tag = cmdEl.tagName;
  if (!tag) return;
  const hasCond = cmdEl.hasAttribute('condition');
  const condOK = hasCond ? toNum(evaluate(cmdEl.getAttribute('condition'))) > 0 : true;
  if (hasCond && !condOK) return;
  const delay = cmdEl.hasAttribute('delay') ? toNum(evaluate(cmdEl.getAttribute('delay'))) : 0;
  const delayCond = cmdEl.getAttribute('delayCondition');
  const run = () => {
    if (delayCond != null && toNum(evaluate(delayCond)) <= 0) return;
    doCommand(cmdEl, tag);
  };
  if (delay > 0) setTimeout(run, delay); else run();
}

function doCommand(cmdEl, tag) {
  switch (tag) {
   case 'VariableCommand':
    {
      const name = cmdEl.getAttribute('name');
      if (!name) return;
      const exprAttr = cmdEl.getAttribute('expression');
      const val = exprAttr != null ? evaluate(exprAttr) : cmdEl.hasAttribute('value') ? evaluate(cmdEl.getAttribute('value')) : 0;
      Engine.overrides.set(name, val);
      log(`#${name} = ${typeof val === 'number' ? Math.round(val * 1e3) / 1e3 : val}`, 'act');
      break;
    }

   case 'Command':
    {
      const target = cmdEl.getAttribute('target') || '';
      const value = cmdEl.getAttribute('value');
      const dot = target.lastIndexOf('.');
      const tname = dot >= 0 ? target.slice(0, dot) : target, tprop = dot >= 0 ? target.slice(dot + 1) : '';
      if (tprop === 'animation') {
        if (value === 'play') {
          if (!Engine.startAnim(tname)) startElementAnim(tname);
        } else if (value === 'stop') {
          if (!Engine.stopAnim(tname)) stopElementAnim(tname);
        }
        log(`${tname}.animation → ${value}`, 'act');
      } else if (tprop === 'visibility') {
        const cur = Engine.visOverrides.get(tname);
        const nv = value === 'true' ? 1 : value === 'false' ? 0 : cur ? 0 : 1;
        Engine.visOverrides.set(tname, nv);
      }
      break;
    }

   case 'ExternCommand':
    log('ExternCommand: ' + cmdEl.getAttribute('command'), 'act');
    flashEdge('#5aa9ff');
    break;

   case 'IntentCommand':
    log('would launch: ' + (cmdEl.getAttribute('package') || cmdEl.getAttribute('action') || ''), 'act');
    break;

   case 'SoundCommand':
    log('sound: ' + cmdEl.getAttribute('sound'), 'act');
    break;

   case 'RefreshWeatherCommand':
   case 'BinderCommand':
    break;

   default:
    break;
  }
}

export function flashEdge(color) {
  canvas.style.boxShadow = `0 0 0 3px ${color}, 0 20px 60px rgba(0,0,0,.5)`;
  setTimeout(() => {
    canvas.style.boxShadow = '';
  }, 220);
}
