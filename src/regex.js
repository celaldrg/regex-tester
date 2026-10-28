/**
 * Regular expression helpers built on the platform's own RegExp engine.
 *
 * Pure module: no DOM and no globals at import time, so it runs in a Web Worker,
 * on the main thread and under node --test alike. Nothing here throws on bad input:
 * invalid patterns or flags come back as { ok: false, error }.
 *
 * @typedef {{ code: 'syntax'|'runtime'|'flag'|'repeatedFlag', message: string, reason?: string, flag?: string }} RegexError
 * @typedef {{ number: number, name: string|null, value: string|null, start: number|null, end: number|null }} GroupResult
 *   value, start and end are null when the group did not take part in the match
 * @typedef {{ index: number, end: number, value: string, groups: GroupResult[] }} MatchResult
 * @typedef {{ ok: true, groupCount: number, groupNames: (string|null)[], matches: MatchResult[], truncated: boolean }} MatchSet
 * @typedef {{ start: number, end: number, match: number|null, group: number|null }} Segment
 *   a run of the test text; match is the index into matches, group the innermost group number
 */
import { captureNames } from './tokenizer.js';

/** Supported flags in canonical order (the order RegExp.prototype.flags uses). */
export const FLAGS = Object.freeze(['d', 'g', 'i', 'm', 's', 'u', 'y']);

/** Default cap on matches and split parts, so a huge text cannot flood the page. */
export const MAX_RESULTS = 1000;

const MAX_SPLIT_LIMIT = 2 ** 32 - 1;

/**
 * Validates a flag string strictly and returns it in canonical order.
 * @param {string} flags
 * @returns {{ ok: true, flags: string } | { ok: false, error: RegexError }}
 */
export function parseFlags(flags) {
  const seen = new Set();
  for (const flag of String(flags)) {
    if (!FLAGS.includes(flag)) return { ok: false, error: { code: 'flag', flag, message: `Unknown flag "${flag}"` } };
    if (seen.has(flag)) return { ok: false, error: { code: 'repeatedFlag', flag, message: `Repeated flag "${flag}"` } };
    seen.add(flag);
  }
  return { ok: true, flags: FLAGS.filter((flag) => seen.has(flag)).join('') };
}

/**
 * Lenient flag cleanup for user state: drops unknown or repeated flags.
 * @param {string} flags
 * @returns {string} canonical flag string
 */
export function sanitizeFlags(flags) {
  return FLAGS.filter((flag) => String(flags).includes(flag)).join('');
}

/**
 * Switches one flag on or off.
 * @param {string} flags  current flags
 * @param {string} flag   flag to toggle; unknown flags leave the string unchanged
 * @returns {string} canonical flag string
 */
export function toggleFlag(flags, flag) {
  const current = sanitizeFlags(flags);
  if (!FLAGS.includes(flag)) return current;
  return sanitizeFlags(current.includes(flag) ? current.replace(flag, '') : current + flag);
}

/**
 * Compiles a pattern without ever throwing.
 * @param {string} pattern
 * @param {string} [flags]
 * @returns {{ ok: true, regex: RegExp } | { ok: false, error: RegexError }}
 */
export function buildRegex(pattern, flags = '') {
  const parsed = parseFlags(flags);
  if (!parsed.ok) return parsed;
  try {
    return { ok: true, regex: new RegExp(pattern, parsed.flags) };
  } catch (err) {
    return { ok: false, error: engineError('syntax', err) };
  }
}

function engineError(code, err) {
  const message = String(err?.message ?? err);
  const cut = message.lastIndexOf(': ');
  return { code, message, reason: cut === -1 ? message : message.slice(cut + 2) };
}

/**
 * Finds matches the way String.prototype.matchAll and replace iterate: only the first
 * match without the g flag, every match with it (an empty match moves on by one
 * character, or one code point with u). Group indices are always reported, whether or
 * not the d flag is set.
 * @param {string} pattern
 * @param {string} flags
 * @param {string} text
 * @param {{ maxMatches?: number }} [options]  matches beyond the cap set truncated
 * @returns {MatchSet | { ok: false, error: RegexError }}
 */
export function findMatches(pattern, flags, text, { maxMatches = MAX_RESULTS } = {}) {
  const built = buildRegex(pattern, flags);
  if (!built.ok) return built;
  const regex = built.regex.hasIndices ? built.regex : new RegExp(built.regex.source, `${built.regex.flags}d`);
  const matches = [];
  let groupNames;
  let truncated = false;
  try {
    // The engine compiles on first use, so even the group probe can fail (e.g. "Stack overflow").
    groupNames = namesOf(regex);
    for (const m of execAll(regex, text)) {
      if (matches.length >= maxMatches) {
        truncated = true;
        break;
      }
      matches.push(toMatchResult(m, groupNames));
    }
  } catch (err) {
    return { ok: false, error: engineError('runtime', err) };
  }
  return { ok: true, groupCount: groupNames.length, groupNames, matches, truncated };
}

function* execAll(regex, text) {
  regex.lastIndex = 0;
  for (;;) {
    const m = regex.exec(text);
    if (!m) return;
    yield m;
    if (!regex.global) return;
    if (m[0] === '') regex.lastIndex = advanceIndex(text, regex.lastIndex, regex.unicode);
  }
}

/** AdvanceStringIndex from the spec: one code unit, or a whole surrogate pair in Unicode mode. */
function advanceIndex(text, index, unicode) {
  if (!unicode || index + 1 >= text.length) return index + 1;
  const lead = text.charCodeAt(index);
  const trail = text.charCodeAt(index + 1);
  const pair = lead >= 0xd800 && lead <= 0xdbff && trail >= 0xdc00 && trail <= 0xdfff;
  return index + (pair ? 2 : 1);
}

/**
 * Group names in numbering order. The tokenizer reads them from the source; the engine
 * confirms the count and the names, otherwise the groups stay unnamed.
 */
function namesOf(regex) {
  const probe = new RegExp(`${regex.source}|`, regex.flags.replace(/[gy]/g, '')).exec('');
  const count = probe.length - 1;
  const engineNames = Object.keys(probe.groups ?? {});
  const names = captureNames(regex.source);
  const consistent = names.length === count && names.every((name) => name === null || engineNames.includes(name));
  return consistent ? names : Array(count).fill(null);
}

function toMatchResult(m, names) {
  const groups = names.map((name, k) => {
    const span = m.indices[k + 1];
    return { number: k + 1, name, value: m[k + 1] ?? null, start: span ? span[0] : null, end: span ? span[1] : null };
  });
  return { index: m.index, end: m.indices[0][1], value: m[0], groups };
}

/**
 * Expands a replacement template for one match exactly like String.prototype.replace
 * (GetSubstitution): $$, $&, $`, $', $1..$99 and $<name>; anything else stays literal.
 * @param {string} template
 * @param {MatchResult} match
 * @param {string} text  the whole subject text (for $` and $')
 * @param {boolean} namedGroups  whether the pattern has named groups ($<name> is literal otherwise)
 * @returns {string}
 */
export function expandReplacement(template, match, text, namedGroups) {
  let out = '';
  let i = 0;
  while (i < template.length) {
    const dollar = template.indexOf('$', i);
    if (dollar === -1) return out + template.slice(i);
    out += template.slice(i, dollar);
    const [piece, next] = substitute(template, dollar, match, text, namedGroups);
    out += piece;
    i = next;
  }
  return out;
}

function substitute(template, at, match, text, namedGroups) {
  const c = template[at + 1];
  if (c === '$') return ['$', at + 2];
  if (c === '&') return [match.value, at + 2];
  if (c === '`') return [text.slice(0, match.index), at + 2];
  if (c === "'") return [text.slice(match.end), at + 2];
  if (c >= '0' && c <= '9') return numberedGroup(template, at, match.groups);
  if (c === '<' && namedGroups) return namedGroup(template, at, match.groups);
  return ['$', at + 1];
}

/** $nn wins when that group exists; otherwise $n plus a literal digit (spec GetSubstitution). */
function numberedGroup(template, at, groups) {
  const digits = template.slice(at + 1, at + 3);
  const two = Number(digits);
  if (/^\d\d$/.test(digits) && two >= 1 && two <= groups.length) return [groups[two - 1].value ?? '', at + 3];
  const one = Number(template[at + 1]);
  if (one >= 1 && one <= groups.length) return [groups[one - 1].value ?? '', at + 2];
  return [template.slice(at, at + 2), at + 2];
}

function namedGroup(template, at, groups) {
  const close = template.indexOf('>', at + 2);
  if (close === -1) return ['$<', at + 2];
  const name = template.slice(at + 2, close);
  const group = groups.find((g) => g.name === name && g.value !== null);
  return [group ? group.value : '', close + 1];
}

/**
 * Builds the replace preview from a match set. With all matches present the output
 * equals text.replace(new RegExp(pattern, flags), template).
 * @param {string} text
 * @param {MatchSet} matchSet
 * @param {string} template
 * @returns {{ output: string, segments: { text: string, replaced: boolean }[], count: number }}
 */
export function buildReplacement(text, matchSet, template) {
  const namedGroups = matchSet.groupNames.some((name) => name !== null);
  const segments = [];
  let last = 0;
  for (const match of matchSet.matches) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), replaced: false });
    segments.push({ text: expandReplacement(template, match, text, namedGroups), replaced: true });
    last = match.end;
  }
  if (last < text.length) segments.push({ text: text.slice(last), replaced: false });
  return { output: segments.map((segment) => segment.text).join(''), segments, count: matchSet.matches.length };
}

/**
 * Replace in one call.
 * @param {string} pattern
 * @param {string} flags
 * @param {string} text
 * @param {string} template
 * @param {{ maxMatches?: number }} [options]
 * @returns {({ ok: true, truncated: boolean } & ReturnType<typeof buildReplacement>) | { ok: false, error: RegexError }}
 */
export function replaceText(pattern, flags, text, template, options) {
  const found = findMatches(pattern, flags, text, options);
  if (!found.ok) return found;
  return { ok: true, truncated: found.truncated, ...buildReplacement(text, found, template) };
}

/**
 * Split preview following RegExp.prototype[Symbol.split]: the part values equal
 * text.split(new RegExp(pattern, flags), limit). Captured separators are marked.
 * @param {string} pattern
 * @param {string} flags
 * @param {string} text
 * @param {{ limit?: number, maxParts?: number }} [options]
 * @returns {{ ok: true, parts: { value: string|null, capture: boolean }[], truncated: boolean } | { ok: false, error: RegexError }}
 */
export function splitText(pattern, flags, text, { limit, maxParts = MAX_RESULTS } = {}) {
  const built = buildRegex(pattern, flags);
  if (!built.ok) return built;
  const requested = limit === undefined ? MAX_SPLIT_LIMIT : limit >>> 0;
  try {
    const parts = splitParts(built.regex, text, Math.min(requested, maxParts + 1));
    const truncated = parts.length > maxParts;
    return { ok: true, parts: truncated ? parts.slice(0, maxParts) : parts, truncated };
  } catch (err) {
    return { ok: false, error: engineError('runtime', err) };
  }
}

function splitParts(regex, text, limit) {
  const parts = [];
  if (limit === 0) return parts;
  const splitter = new RegExp(regex.source, regex.sticky ? regex.flags : `${regex.flags}y`);
  if (text.length === 0) return splitter.exec(text) ? parts : [{ value: text, capture: false }];
  let p = 0;
  let q = 0;
  while (q < text.length) {
    splitter.lastIndex = q;
    const m = splitter.exec(text);
    const e = m ? Math.min(splitter.lastIndex, text.length) : p;
    if (e === p) {
      q = advanceIndex(text, q, splitter.unicode);
      continue;
    }
    parts.push({ value: text.slice(p, q), capture: false });
    if (parts.length === limit) return parts;
    p = e;
    for (let n = 1; n < m.length; n++) {
      parts.push({ value: m[n] ?? null, capture: true });
      if (parts.length === limit) return parts;
    }
    q = p;
  }
  parts.push({ value: text.slice(p), capture: false });
  return parts;
}

/**
 * Cuts the text into plain and highlighted runs for inline rendering. Every match is cut
 * again at group boundaries so each run knows its innermost group. An empty match
 * gives a zero-length run.
 * @param {string} text
 * @param {MatchResult[]} matches
 * @returns {Segment[]}
 */
export function highlightSegments(text, matches) {
  const segments = [];
  let last = 0;
  matches.forEach((match, k) => {
    if (match.index > last) segments.push({ start: last, end: match.index, match: null, group: null });
    segments.push(...matchPieces(match, k));
    last = match.end;
  });
  if (last < text.length) segments.push({ start: last, end: text.length, match: null, group: null });
  return segments;
}

function matchPieces(match, k) {
  if (match.index === match.end) return [{ start: match.index, end: match.end, match: k, group: null }];
  const inside = match.groups
    .filter((g) => g.start !== null)
    .map((g) => ({ number: g.number, start: Math.max(g.start, match.index), end: Math.min(g.end, match.end) }))
    .filter((g) => g.end > g.start);
  const cuts = [...new Set([match.index, match.end, ...inside.flatMap((g) => [g.start, g.end])])].sort((a, b) => a - b);
  return cuts.slice(1).map((end, c) => ({ start: cuts[c], end, match: k, group: innermostGroup(inside, cuts[c], end) }));
}

function innermostGroup(groups, start, end) {
  let best = null;
  for (const g of groups) {
    const covers = g.start <= start && g.end >= end;
    if (covers && (!best || g.end - g.start <= best.end - best.start)) best = g;
  }
  return best ? best.number : null;
}

/**
 * Everything the UI needs for one state, in one call (this is what the worker runs).
 * An empty pattern returns no matches instead of an empty match at every position.
 * @param {{ pattern: string, flags?: string, text?: string, replacement?: string,
 *   mode?: 'matches'|'replace'|'split', maxMatches?: number }} request
 * @returns {(MatchSet & { empty: boolean, segments: Segment[],
 *   replace?: ReturnType<typeof buildReplacement>, split?: { parts: { value: string|null, capture: boolean }[], truncated: boolean } })
 *   | { ok: false, error: RegexError }}
 */
export function analyze({ pattern, flags = '', text = '', replacement = '', mode = 'matches', maxMatches = MAX_RESULTS }) {
  const empty = pattern === '';
  const found = empty ? noMatches(flags) : findMatches(pattern, flags, text, { maxMatches });
  if (!found.ok) return found;
  const result = { ...found, empty, segments: highlightSegments(text, found.matches) };
  if (mode === 'replace') result.replace = buildReplacement(text, found, replacement);
  if (mode === 'split') {
    const split = empty ? { ok: true, parts: [{ value: text, capture: false }], truncated: false } : splitText(pattern, flags, text, { maxParts: maxMatches });
    if (!split.ok) return split;
    result.split = { parts: split.parts, truncated: split.truncated };
  }
  return result;
}

function noMatches(flags) {
  const parsed = parseFlags(flags);
  return parsed.ok ? { ok: true, groupCount: 0, groupNames: [], matches: [], truncated: false } : parsed;
}
