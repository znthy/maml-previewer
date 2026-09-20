import { NULLV, toNum, toStr } from './utils.js';

import { logOnce } from './log.js';

import { Engine } from './engine.js';

function tokenize(str) {
  let i = 0;
  const toks = [];
  const reNum = /^\d+(\.\d+)?/, reStr = /^'(?:[^'\\]|\\.)*'/, reHash = /^#[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?/, reAt = /^@[A-Za-z_][A-Za-z0-9_]*/, reIdent = /^[A-Za-z_][A-Za-z0-9_]*/, reWs = /^\s+/;
  while (i < str.length) {
    const s = str.slice(i);
    let m;
    if (m = reWs.exec(s)) {
      i += m[0].length;
      continue;
    }
    if (m = reNum.exec(s)) {
      toks.push({
        t: 'num',
        v: parseFloat(m[0])
      });
      i += m[0].length;
      continue;
    }
    if (m = reStr.exec(s)) {
      toks.push({
        t: 'str',
        v: m[0].slice(1, -1).replace(/\\'/g, "'")
      });
      i += m[0].length;
      continue;
    }
    if (m = reHash.exec(s)) {
      const parts = m[0].slice(1).split('.');
      toks.push({
        t: 'hash',
        name: parts[0],
        prop: parts[1] || null
      });
      i += m[0].length;
      continue;
    }
    if (m = reAt.exec(s)) {
      const parts = m[0].slice(1).split('.');
      toks.push({
        t: 'at',
        name: parts[0],
        prop: parts[1] || null
      });
      i += m[0].length;
      continue;
    }
    if (m = reIdent.exec(s)) {
      toks.push({
        t: 'ident',
        v: m[0]
      });
      i += m[0].length;
      continue;
    }
    const c = str[i];
    if ('+-*/%(),'.includes(c)) {
      toks.push({
        t: c
      });
      i++;
      continue;
    }
    i++;
  }
  toks.push({
    t: 'eof'
  });
  return toks;
}

function Parser(toks) {
  this.toks = toks;
  this.pos = 0;
}

Parser.prototype.peek = function() {
  return this.toks[this.pos];
};

Parser.prototype.next = function() {
  return this.toks[this.pos++];
};

Parser.prototype.parseExpr = function() {
  let node = this.parseTerm();
  while (this.peek().t === '+' || this.peek().t === '-') {
    const op = this.next().t;
    node = {
      type: 'bin',
      op: op,
      a: node,
      b: this.parseTerm()
    };
  }
  return node;
};

Parser.prototype.parseTerm = function() {
  let node = this.parseFactor();
  while (this.peek().t === '*' || this.peek().t === '/' || this.peek().t === '%') {
    const op = this.next().t;
    node = {
      type: 'bin',
      op: op,
      a: node,
      b: this.parseFactor()
    };
  }
  return node;
};

Parser.prototype.parseFactor = function() {
  if (this.peek().t === '-') {
    this.next();
    return {
      type: 'neg',
      a: this.parseFactor()
    };
  }
  if (this.peek().t === '+') {
    this.next();
    return this.parseFactor();
  }
  return this.parsePrimary();
};

Parser.prototype.parsePrimary = function() {
  const tok = this.peek();
  if (tok.t === 'num') {
    this.next();
    return {
      type: 'num',
      value: tok.v
    };
  }
  if (tok.t === 'str') {
    this.next();
    return {
      type: 'str',
      value: tok.v
    };
  }
  if (tok.t === 'hash') {
    this.next();
    return {
      type: 'ref',
      sigil: '#',
      name: tok.name,
      prop: tok.prop
    };
  }
  if (tok.t === 'at') {
    this.next();
    return {
      type: 'ref',
      sigil: '@',
      name: tok.name,
      prop: tok.prop
    };
  }
  if (tok.t === '(') {
    this.next();
    const e = this.parseExpr();
    if (this.peek().t === ')') this.next();
    return e;
  }
  if (tok.t === 'ident') {
    this.next();
    if (this.peek().t === '(') {
      this.next();
      const args = [];
      if (this.peek().t !== ')') {
        args.push(this.parseExpr());
        while (this.peek().t === ',') {
          this.next();
          args.push(this.parseExpr());
        }
      }
      if (this.peek().t === ')') this.next();
      return {
        type: 'call',
        name: tok.v.toLowerCase(),
        args: args
      };
    }
    return {
      type: 'str',
      value: tok.v
    };
  }
  this.next();
  return {
    type: 'num',
    value: 0
  };
};

function callFn(name, args) {
  switch (name) {
   case 'eq':
    return toNum(args[0]) === toNum(args[1]) ? 1 : 0;

   case 'ne':
    return toNum(args[0]) !== toNum(args[1]) ? 1 : 0;

   case 'ge':
    return toNum(args[0]) >= toNum(args[1]) ? 1 : 0;

   case 'gt':
    return toNum(args[0]) > toNum(args[1]) ? 1 : 0;

   case 'le':
    return toNum(args[0]) <= toNum(args[1]) ? 1 : 0;

   case 'lt':
    return toNum(args[0]) < toNum(args[1]) ? 1 : 0;

   case 'eqs':
    return toStr(args[0]) === toStr(args[1]) ? 1 : 0;

   case 'not':
    return toNum(args[0]) > 0 ? 0 : 1;

   case 'isnull':
    return args[0] === NULLV ? 1 : 0;

   case 'ifelse':
    {
      for (let i = 0; i + 1 < args.length; i += 2) {
        if (toNum(args[i]) > 0) return args[i + 1];
      }
      return args.length ? args[args.length - 1] : 0;
    }

   case 'int':
    return Math.floor(toNum(args[0]));

   case 'round':
    return Math.round(toNum(args[0]));

   case 'abs':
    return Math.abs(toNum(args[0]));

   case 'min':
    return Math.min.apply(null, args.map(toNum));

   case 'max':
    return Math.max.apply(null, args.map(toNum));

   case 'sqrt':
    return Math.sqrt(Math.max(0, toNum(args[0])));

   case 'sin':
    return Math.sin(toNum(args[0]));

   case 'cos':
    return Math.cos(toNum(args[0]));

   case 'tan':
    return Math.tan(toNum(args[0]));

   case 'asin':
    return Math.asin(toNum(args[0]));

   case 'acos':
    return Math.acos(toNum(args[0]));

   case 'atan':
    return Math.atan(toNum(args[0]));

   case 'sinh':
    return Math.sinh(toNum(args[0]));

   case 'cosh':
    return Math.cosh(toNum(args[0]));

   case 'rand':
    return Math.random();

   case 'len':
    return toStr(args[0]).length;

   case 'digit':
    {
      const s = String(Math.trunc(Math.abs(toNum(args[0]))));
      const n = toNum(args[1]);
      const ch = s[s.length - n];
      return ch === undefined ? 0 : Number(ch);
    }

   case 'substr':
    {
      const s = toStr(args[0]);
      const start = toNum(args[1]);
      const len = toNum(args[2]);
      return s.substr(start - 1, len);
    }

   default:
    logOnce('fn:' + name, 'Unknown function in expression: ' + name + '()');
    return 0;
  }
}

const compileCache = new Map;

function compile(str) {
  let ast = compileCache.get(str);
  if (ast !== undefined) return ast;
  try {
    ast = new Parser(tokenize(str)).parseExpr();
  } catch (e) {
    logOnce('parse:' + str, 'Could not parse expression: ' + str);
    ast = null;
  }
  compileCache.set(str, ast);
  return ast;
}

let evalDepth = 0;

function evalAST(node) {
  if (!node) return 0;
  if (++evalDepth > 250) {
    evalDepth--;
    return 0;
  }
  let out;
  switch (node.type) {
   case 'num':
    out = node.value;
    break;

   case 'str':
    out = node.value;
    break;

   case 'ref':
    {
      const v = node.prop ? Engine.resolveProp(node.name, node.prop) : Engine.resolveVar(node.name);
      out = node.sigil === '@' ? toStr(v) : toNum(v);
      break;
    }

   case 'neg':
    out = -toNum(evalAST(node.a));
    break;

   case 'bin':
    {
      const a = evalAST(node.a), b = evalAST(node.b);
      if (node.op === '+') {
        out = typeof a === 'string' || typeof b === 'string' ? toStr(a) + toStr(b) : toNum(a) + toNum(b);
      } else if (node.op === '-') out = toNum(a) - toNum(b); else if (node.op === '*') out = toNum(a) * toNum(b); else if (node.op === '/') {
        const bb = toNum(b);
        out = bb === 0 ? 0 : toNum(a) / bb;
      } else if (node.op === '%') {
        const bb = toNum(b);
        out = bb === 0 ? 0 : toNum(a) % bb;
      }
      break;
    }

   case 'call':
    out = callFn(node.name, node.args.map(evalAST));
    break;

   default:
    out = 0;
  }
  evalDepth--;
  return out;
}

export function evaluate(str) {
  if (str == null || str === '') return 0;
  const ast = compile(str);
  if (!ast) return 0;
  try {
    return evalAST(ast);
  } catch (e) {
    logOnce('eval:' + str, 'Evaluation error in: ' + str + ' — ' + e.message);
    return 0;
  }
}
