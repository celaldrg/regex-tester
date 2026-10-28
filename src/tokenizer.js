/**
 * Tokenizer for JavaScript regular expression patterns.
 *
 * Pure module (no DOM, no globals). It never throws: invalid patterns still produce
 * best-effort tokens so the explanation panel can show something while the engine
 * reports the real error. Tokens carry their [start, end) position in the pattern,
 * which the UI uses to highlight a token when it is hovered or tapped.
 *
 * Token types: literal, escape, class, quantifier, group, lookaround, groupEnd,
 * anchor, backreference, alternation.
 *
 * @typedef {object} Token
 * @property {string} type   one of the token types above
 * @property {string} kind   sub-kind, e.g. 'digit', 'named', 'lookbehind', 'range'
 * @property {number} start  index of the first pattern character of the token
 * @property {number} end    index just after the token
 * @property {string} raw    the pattern text of the token
 * @property {number} depth  how many groups enclose the token
 * @property {string} [value]        literal / escape character(s), property name
 * @property {boolean} [negated]     character set starting with ^
 * @property {string[]} [items]      character set items, ranges joined as "a-z"
 * @property {number} [min]          quantifier minimum
 * @property {number} [max]          quantifier maximum (Infinity when unbounded)
 * @property {boolean} [lazy]        quantifier followed by ?
 * @property {number|null} [target]  start of the item a quantifier repeats
 * @property {number|null} [number]  capture group number (groups, groupEnd, back-references)
 * @property {string|null} [name]    capture group name
 * @property {number|null} [close]   index of the ")" closing a group or lookaround
 * @property {number} [open]         start of the group a groupEnd closes
 * @property {string} [add]          flags switched on by a modifier group, e.g. (?i:...)
 * @property {string} [remove]       flags switched off by a modifier group, e.g. (?-i:...)
 */

const CLASS_ESCAPES = { d: 'digit', D: 'notDigit', w: 'word', W: 'notWord', s: 'space', S: 'notSpace' };
const CONTROL_ESCAPES = { n: '\n', r: '\r', t: '\t', f: '\f', v: '\v' };
const SIMPLE_QUANTIFIERS = { '*': ['star', 0, Infinity], '+': ['plus', 1, Infinity], '?': ['optional', 0, 1] };
const SINGLE_CHAR_TOKENS = { '|': ['alternation', 'or'], '^': ['anchor', 'start'], '$': ['anchor', 'end'], '.': ['class', 'dot'] };
const NOT_REPEATABLE = new Set(['quantifier', 'alternation', 'group', 'lookaround', 'anchor']);

/**
 * Splits a regular expression pattern into tokens.
 * Runs of plain characters are merged into one literal token, except a character
 * that a quantifier applies to, which keeps its own token.
 * @param {string} pattern  pattern source, without slashes
 * @param {string} [flags]  flags; u (or v) switches to Unicode-mode parsing rules
 * @returns {Token[]}
 */
export function tokenize(pattern, flags = '') {
  const ctx = {
    pattern,
    unicode: /[uv]/.test(flags),
    names: captureNames(pattern),
    tokens: [],
    open: [],
    groups: 0,
  };
  let i = 0;
  while (i < pattern.length) i = readToken(ctx, i);
  return mergeLiterals(ctx.tokens);
}

/**
 * Lists the capturing groups of a pattern in numbering order.
 * @param {string} pattern
 * @returns {(string|null)[]} one entry per group: its name, or null when unnamed
 */
export function captureNames(pattern) {
  const names = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') i++;
    else if (inClass) inClass = c !== ']';
    else if (c === '[') inClass = true;
    else if (c === '(') {
      const head = groupHead(pattern, i);
      if (head.kind === 'capture' || head.kind === 'named') names.push(head.name ?? null);
    }
  }
  return names;
}

function readToken(ctx, i) {
  const c = ctx.pattern[i];
  if (c === '\\') return readEscape(ctx, i);
  if (c === '[') return readClass(ctx, i);
  if (c === '(') return openGroup(ctx, i);
  if (c === ')') return closeGroup(ctx, i);
  if (c === '{') return readBraces(ctx, i);
  if (Object.hasOwn(SIMPLE_QUANTIFIERS, c)) return addQuantifier(ctx, i, i + 1, ...SIMPLE_QUANTIFIERS[c]);
  if (Object.hasOwn(SINGLE_CHAR_TOKENS, c)) return add(ctx, ...SINGLE_CHAR_TOKENS[c], i, i + 1);
  return readLiteral(ctx, i);
}

function add(ctx, type, kind, start, end, extra = {}) {
  ctx.tokens.push({ type, kind, start, end, raw: ctx.pattern.slice(start, end), depth: ctx.open.length, ...extra });
  return end;
}

function charLength(text, i, unicode) {
  return unicode ? String.fromCodePoint(text.codePointAt(i)).length : 1;
}

function readLiteral(ctx, i) {
  const end = i + charLength(ctx.pattern, i, ctx.unicode);
  return add(ctx, 'literal', 'char', i, end, { value: ctx.pattern.slice(i, end) });
}

function addQuantifier(ctx, start, end, kind, min, max) {
  const lazy = ctx.pattern[end] === '?';
  return add(ctx, 'quantifier', kind, start, lazy ? end + 1 : end, { min, max, lazy, target: quantifierTarget(ctx) });
}

function quantifierTarget(ctx) {
  const prev = ctx.tokens[ctx.tokens.length - 1];
  if (!prev || NOT_REPEATABLE.has(prev.type)) return null;
  return prev.type === 'groupEnd' && prev.open !== undefined ? prev.open : prev.start;
}

function readBraces(ctx, i) {
  const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(ctx.pattern.slice(i));
  if (!m) return readLiteral(ctx, i);
  const min = Number(m[1]);
  if (!m[2]) return addQuantifier(ctx, i, i + m[0].length, 'exact', min, min);
  if (!m[3]) return addQuantifier(ctx, i, i + m[0].length, 'atLeast', min, Infinity);
  return addQuantifier(ctx, i, i + m[0].length, 'range', min, Number(m[3]));
}

function readEscape(ctx, i) {
  const { pattern, unicode } = ctx;
  const next = pattern[i + 1];
  if (next === undefined) return add(ctx, 'escape', 'incomplete', i, i + 1);
  if (Object.hasOwn(CLASS_ESCAPES, next)) return add(ctx, 'class', CLASS_ESCAPES[next], i, i + 2);
  if (next === 'b') return add(ctx, 'anchor', 'wordBoundary', i, i + 2);
  if (next === 'B') return add(ctx, 'anchor', 'notWordBoundary', i, i + 2);
  if (next >= '1' && next <= '9') return readDecimalEscape(ctx, i);
  if (next === 'k' && (unicode || ctx.names.some((name) => name !== null))) return readNamedReference(ctx, i);
  if ((next === 'p' || next === 'P') && unicode) return readProperty(ctx, i);
  const escape = characterEscape(pattern, i, unicode);
  if (escape) return add(ctx, 'escape', escape.kind, i, escape.end, { value: escape.value });
  // Annex B: "\c" without a control letter is a literal backslash followed by "c".
  if (next === 'c' && !unicode) return add(ctx, 'literal', 'char', i, i + 1, { value: '\\' });
  const end = i + 1 + charLength(pattern, i + 1, unicode);
  return add(ctx, 'escape', 'identity', i, end, { value: pattern.slice(i + 1, end) });
}

/**
 * Character escapes shared by atoms and character sets: \n \r \t \f \v, \0,
 * legacy octal (non-Unicode mode only), \cX, \xHH, \uHHHH and \u{H...}.
 */
function characterEscape(pattern, i, unicode) {
  const next = pattern[i + 1];
  if (Object.hasOwn(CONTROL_ESCAPES, next)) return { kind: 'control', end: i + 2, value: CONTROL_ESCAPES[next] };
  if (next === '0' && (unicode || !isOctal(pattern[i + 2]))) return { kind: 'nul', end: i + 2, value: '\0' };
  if (!unicode && isOctal(next)) return readOctal(pattern, i + 1);
  if (next === 'c' && /^[A-Za-z]$/.test(pattern[i + 2] ?? '')) {
    return { kind: 'controlLetter', end: i + 3, value: String.fromCharCode(pattern.charCodeAt(i + 2) % 32) };
  }
  if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(pattern.slice(i + 2, i + 4))) {
    return { kind: 'hex', end: i + 4, value: String.fromCharCode(parseInt(pattern.slice(i + 2, i + 4), 16)) };
  }
  if (next === 'u') return unicodeEscape(pattern, i, unicode);
  return null;
}

function isOctal(ch) {
  return ch !== undefined && ch >= '0' && ch <= '7';
}

/** Legacy octal escape as V8 reads it: two digits, a third only while the value stays below 32. */
function readOctal(pattern, k) {
  let value = Number(pattern[k]);
  let end = k + 1;
  if (isOctal(pattern[end])) {
    value = value * 8 + Number(pattern[end++]);
    if (value < 32 && isOctal(pattern[end])) value = value * 8 + Number(pattern[end++]);
  }
  return { kind: 'octal', end, value: String.fromCharCode(value) };
}

function unicodeEscape(pattern, i, unicode) {
  if (unicode && pattern[i + 2] === '{') {
    const m = /^\{([0-9a-fA-F]+)\}/.exec(pattern.slice(i + 2));
    const codePoint = m ? parseInt(m[1], 16) : NaN;
    return codePoint <= 0x10ffff ? { kind: 'codePoint', end: i + 2 + m[0].length, value: String.fromCodePoint(codePoint) } : null;
  }
  const hex = pattern.slice(i + 2, i + 6);
  if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
  const code = parseInt(hex, 16);
  const trail = pattern.slice(i + 6, i + 12);
  if (unicode && code >= 0xd800 && code <= 0xdbff && /^\\u[dD][c-fC-F][0-9a-fA-F]{2}$/.test(trail)) {
    return { kind: 'unicode', end: i + 12, value: String.fromCharCode(code, parseInt(trail.slice(2), 16)) };
  }
  return { kind: 'unicode', end: i + 6, value: String.fromCharCode(code) };
}

/**
 * \1..\99: a back-reference when that many groups exist (or always in Unicode mode);
 * otherwise Annex B reads \8 and \9 as plain digits and the rest as legacy octal.
 */
function readDecimalEscape(ctx, i) {
  const digits = /^\d+/.exec(ctx.pattern.slice(i + 1))[0];
  const number = Number(digits);
  if (number <= ctx.names.length || ctx.unicode) {
    return add(ctx, 'backreference', 'number', i, i + 1 + digits.length, { number, name: ctx.names[number - 1] ?? null });
  }
  if (digits[0] === '8' || digits[0] === '9') return add(ctx, 'escape', 'identity', i, i + 2, { value: digits[0] });
  const octal = readOctal(ctx.pattern, i + 1);
  return add(ctx, 'escape', 'octal', i, octal.end, { value: octal.value });
}

function readNamedReference(ctx, i) {
  const m = /^<([^>]*)>/.exec(ctx.pattern.slice(i + 2));
  if (!m) return add(ctx, 'escape', 'incomplete', i, i + 2);
  const name = decodeGroupName(m[1]);
  const number = ctx.names.indexOf(name) + 1 || null;
  return add(ctx, 'backreference', 'name', i, i + 2 + m[0].length, { number, name });
}

function readProperty(ctx, i) {
  const m = /^\{([^}]*)\}/.exec(ctx.pattern.slice(i + 2));
  if (!m) return add(ctx, 'escape', 'incomplete', i, i + 2);
  const kind = ctx.pattern[i + 1] === 'P' ? 'notProperty' : 'property';
  return add(ctx, 'class', kind, i, i + 2 + m[0].length, { value: m[1] });
}

function readClass(ctx, i) {
  const { pattern, unicode } = ctx;
  const negated = pattern[i + 1] === '^';
  const atoms = [];
  let k = negated ? i + 2 : i + 1;
  while (k < pattern.length && pattern[k] !== ']') {
    const length = classAtomLength(pattern, k, unicode);
    atoms.push(pattern.slice(k, k + length));
    k += length;
  }
  const closed = k < pattern.length;
  const kind = closed ? 'set' : 'unterminated';
  return add(ctx, 'class', kind, i, closed ? k + 1 : pattern.length, { negated, items: joinRanges(atoms, unicode) });
}

function classAtomLength(pattern, k, unicode) {
  if (pattern[k] !== '\\') return charLength(pattern, k, unicode);
  const next = pattern[k + 1];
  if (next === undefined) return 1;
  if ((next === 'p' || next === 'P') && unicode) {
    const close = pattern.indexOf('}', k);
    return close === -1 ? 2 : close - k + 1;
  }
  const escape = characterEscape(pattern, k, unicode);
  return escape ? escape.end - k : 1 + charLength(pattern, k + 1, unicode);
}

function joinRanges(atoms, unicode) {
  const single = (atom) => !/^\\[dDwWsS]/.test(atom) && !(unicode && /^\\[pP]/.test(atom));
  const items = [];
  for (let k = 0; k < atoms.length; k++) {
    if (atoms[k + 1] === '-' && k + 2 < atoms.length && single(atoms[k]) && single(atoms[k + 2])) {
      items.push(`${atoms[k]}-${atoms[k + 2]}`);
      k += 2;
    } else {
      items.push(atoms[k]);
    }
  }
  return items;
}

/** Reads what follows "(" and says which kind of group it opens. */
function groupHead(pattern, i) {
  if (pattern[i + 1] !== '?') return { type: 'group', kind: 'capture', end: i + 1 };
  const a = pattern[i + 2];
  const b = pattern[i + 3];
  if (a === ':') return { type: 'group', kind: 'nonCapture', end: i + 3 };
  if (a === '=') return { type: 'lookaround', kind: 'lookahead', end: i + 3 };
  if (a === '!') return { type: 'lookaround', kind: 'negativeLookahead', end: i + 3 };
  if (a === '<' && b === '=') return { type: 'lookaround', kind: 'lookbehind', end: i + 4 };
  if (a === '<' && b === '!') return { type: 'lookaround', kind: 'negativeLookbehind', end: i + 4 };
  if (a === '<') {
    const close = pattern.indexOf('>', i + 3);
    if (close === -1) return { type: 'group', kind: 'named', end: i + 3, name: '' };
    return { type: 'group', kind: 'named', end: close + 1, name: decodeGroupName(pattern.slice(i + 3, close)) };
  }
  const m = /^\(\?([a-z]*)(?:-([a-z]*))?:/.exec(pattern.slice(i, i + 16));
  if (m && (m[1] || m[2])) return { type: 'group', kind: 'modifiers', end: i + m[0].length, add: m[1], remove: m[2] ?? '' };
  return { type: 'group', kind: 'unknown', end: i + 2 };
}

/** Group names may spell characters as \uXXXX or \u{X...}; the engine uses the decoded name. */
function decodeGroupName(raw) {
  return raw.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (whole, braced, plain) => {
    const codePoint = parseInt(braced ?? plain, 16);
    return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : whole;
  });
}

function openGroup(ctx, i) {
  const head = groupHead(ctx.pattern, i);
  const capturing = head.kind === 'capture' || head.kind === 'named';
  const extra = {
    number: capturing ? ++ctx.groups : null,
    name: head.name ?? null,
    close: null,
    ...(head.kind === 'modifiers' ? { add: head.add, remove: head.remove } : {}),
  };
  add(ctx, head.type, head.kind, i, head.end, extra);
  ctx.open.push(ctx.tokens[ctx.tokens.length - 1]);
  return head.end;
}

function closeGroup(ctx, i) {
  const opener = ctx.open.pop();
  if (!opener) return add(ctx, 'groupEnd', 'unmatched', i, i + 1, { number: null, name: null });
  opener.close = i;
  return add(ctx, 'groupEnd', opener.kind, i, i + 1, { open: opener.start, number: opener.number, name: opener.name });
}

function mergeLiterals(tokens) {
  const merged = [];
  tokens.forEach((token, index) => {
    const prev = merged[merged.length - 1];
    const quantified = tokens[index + 1]?.type === 'quantifier';
    if (token.type === 'literal' && prev?.type === 'literal' && !quantified) {
      prev.end = token.end;
      prev.raw += token.raw;
      prev.value += token.value;
    } else {
      merged.push(token);
    }
  });
  return merged;
}
