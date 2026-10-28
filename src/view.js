/**
 * Pure helpers that turn analysis results and tokens into what the UI shows.
 * No DOM and no language strings: the UI modules add those.
 *
 * @typedef {import('./tokenizer.js').Token} Token
 * @typedef {import('./runner.js').RunOutcome} RunOutcome
 */
import { EXAMPLES } from './library.js';
import { sanitizeFlags } from './regex.js';
import { TIMEOUT_MS } from './runner.js';

/** How many matches the match list shows; the inline highlights show all of them. */
export const LIST_LIMIT = 200;

/** Number of distinct group colours; groups beyond that reuse them in order. */
export const GROUP_COLORS = 6;

/** Visible stand-ins for characters that would otherwise be invisible in a value. */
const INVISIBLE = Object.freeze({ '\n': '↵', '\r': '␍', '\t': '⇥' });

/**
 * Colour slot (1..GROUP_COLORS) of a capture group.
 * @param {number} number  group number, starting at 1
 * @returns {number}
 */
export function groupColor(number) {
  return ((number - 1) % GROUP_COLORS) + 1;
}

/**
 * Splits a value into plain runs and visible symbols for line breaks and tabs, so a
 * match, a group or a split part that contains them can be shown on one line.
 * @param {string} text
 * @returns {{ text: string, special: boolean }[]}
 */
export function visibleRuns(text) {
  const runs = [];
  let plain = '';
  for (const ch of text) {
    if (!Object.hasOwn(INVISIBLE, ch)) {
      plain += ch;
      continue;
    }
    if (plain) runs.push({ text: plain, special: false });
    runs.push({ text: INVISIBLE[ch], special: true });
    plain = '';
  }
  if (plain) runs.push({ text: plain, special: false });
  return runs;
}

/**
 * The library example whose pattern and flags the state uses, if any.
 * @param {{ pattern: string, flags: string }} state
 * @returns {import('./library.js').Example|undefined}
 */
export function activeExample(state) {
  return EXAMPLES.find((example) => example.pattern === state.pattern && sanitizeFlags(example.flags) === state.flags);
}

/**
 * Describes an analysis outcome for the status line and the notice.
 * @param {string} flags  the flags the outcome was computed with
 * @param {RunOutcome|null} outcome  null while the analysis is still running
 * @returns {{ kind: 'pending'|'timeout'|'failed'|'error'|'empty'|'ok', ms?: number, message?: string,
 *   error?: object, count?: number, groups?: number, truncated?: boolean, firstOnly?: boolean }}
 */
export function summarize(flags, outcome) {
  if (!outcome) return { kind: 'pending' };
  if (outcome.status === 'timeout') return { kind: 'timeout', ms: TIMEOUT_MS };
  if (outcome.status === 'error') return { kind: 'failed', message: outcome.message };
  const { result } = outcome;
  if (!result.ok) return { kind: 'error', error: result.error };
  if (result.empty) return { kind: 'empty' };
  const count = result.matches.length;
  return {
    kind: 'ok',
    count,
    groups: result.groupCount,
    truncated: result.truncated,
    firstOnly: count > 0 && !flags.includes('g'),
  };
}

/**
 * Which tokens to highlight when one is hovered or tapped: the token itself (main)
 * and its partners (related): the other bracket of a group or lookaround, the item a
 * quantifier repeats, or the group a back-reference points to.
 * @param {Token[]} tokens
 * @param {number|null} index  the hovered token, or null for none
 * @returns {{ main: Set<number>, related: Set<number> }}
 */
export function tokenFocus(tokens, index) {
  const main = new Set();
  const related = new Set();
  const token = index === null ? undefined : tokens[index];
  if (!token) return { main, related };
  main.add(index);
  tokens.forEach((other, k) => {
    if (k !== index && isPartner(token, other)) related.add(k);
  });
  return { main, related };
}

function isPartner(token, other) {
  switch (token.type) {
    case 'group':
    case 'lookaround':
      return other.type === 'groupEnd' && other.open === token.start;
    case 'groupEnd':
      return (other.type === 'group' || other.type === 'lookaround') && other.start === token.open;
    case 'quantifier':
      return token.target !== null && other.start >= token.target && other.end <= token.start;
    case 'backreference':
      return token.number !== null && other.type === 'group' && other.number === token.number;
    default:
      return false;
  }
}
