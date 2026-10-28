/**
 * App state for the tester: a plain object that the UI replaces on every change,
 * plus the ?demo state and the share-link (URL hash) encoding. Pure module, no DOM.
 *
 * @typedef {object} TesterState
 * @property {string} pattern
 * @property {string} flags        canonical flag string, e.g. "gim"
 * @property {string} text         the test text
 * @property {string} replacement  template for the Replace tab
 * @property {'matches'|'replace'|'split'} tab
 * @property {boolean} explainOpen  explanation panel visible
 * @property {boolean} cheatsOpen   cheat sheet drawer visible
 */
import { sanitizeFlags, toggleFlag } from './regex.js';
import { EXAMPLES, exampleText, findExample } from './library.js';

/** Result tabs under the test text. */
export const TABS = Object.freeze(['matches', 'replace', 'split']);

const DEFAULTS = Object.freeze({
  pattern: 'colou?r',
  flags: 'gi',
  text: 'Color, colour or COLOR? All three match, but "colr" does not.',
  replacement: '[$&]',
  tab: 'matches',
  explainOpen: false,
  cheatsOpen: false,
});

const DEMO = Object.freeze({
  pattern: '(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])',
  flags: 'g',
  text: [
    'Release notes',
    'v1.0 shipped on 2026-10-28; the beta opened on 2026-09-15.',
    'Next review: 2026-11-04 (not a date: 2026-13-40).',
    'Archive: 2025-12-31 and the leap day 2024-02-29.',
  ].join('\n'),
  replacement: '$<day>.$<month>.$<year>',
  tab: 'matches',
  explainOpen: true,
  cheatsOpen: false,
});

/** Short keys used in the share link: #p=…&f=…&t=…&r=…&v=… */
const HASH_KEYS = Object.freeze({ pattern: 'p', flags: 'f', text: 't', replacement: 'r', tab: 'v' });

/** Pattern, flags and text of every state the app ships with (start, demo, library). */
const BUILT_IN = Object.freeze([
  DEFAULTS,
  DEMO,
  ...EXAMPLES.map((example) => ({ pattern: example.pattern, flags: example.flags, text: exampleText(example) })),
].map(({ pattern, flags, text }) => Object.freeze({ pattern, flags: sanitizeFlags(flags), text })));

/**
 * Creates a normalized state; missing fields take the defaults.
 * @param {Partial<TesterState>} [init]
 * @returns {TesterState}
 */
export function createState(init = {}) {
  return normalize({ ...DEFAULTS, ...init });
}

/**
 * Returns a new state with the patch applied (the input state is not changed).
 * @param {TesterState} state
 * @param {Partial<TesterState>} patch
 * @returns {TesterState}
 */
export function updateState(state, patch) {
  return normalize({ ...state, ...patch });
}

/**
 * Switches one flag on or off.
 * @param {TesterState} state
 * @param {string} flag
 * @returns {TesterState}
 */
export function toggleStateFlag(state, flag) {
  return updateState(state, { flags: toggleFlag(state.flags, flag) });
}

/**
 * Loads a library example: pattern, flags, test text and replacement.
 * @param {TesterState} state
 * @param {string} id  example id; an unknown id returns the state unchanged
 * @returns {TesterState}
 */
export function applyExample(state, id) {
  const example = findExample(id);
  if (!example) return state;
  return updateState(state, {
    pattern: example.pattern,
    flags: example.flags,
    text: exampleText(example),
    replacement: example.replacement,
  });
}

/**
 * The deterministic ?demo state: a date pattern with named groups, several matches
 * in the text and the explanation panel open.
 * @returns {TesterState}
 */
export function createDemoState() {
  return createState(DEMO);
}

/**
 * True when pattern, flags and text are exactly one of the shipped states (the start
 * state, the demo or a library example). Those are known to analyse in well under a
 * millisecond, so the UI may run them on the main thread instead of the worker guard.
 * @param {TesterState} state
 * @returns {boolean}
 */
export function isBuiltIn(state) {
  return BUILT_IN.some((known) => known.pattern === state.pattern && known.flags === state.flags && known.text === state.text);
}

/**
 * True when the shareable fields equal the start state, so the URL needs no hash.
 * @param {TesterState} state
 * @returns {boolean}
 */
export function isDefaultShare(state) {
  return encodeHash(state) === encodeHash(createState());
}

/**
 * The request the worker analyses for this state (see analyze in regex.js).
 * @param {TesterState} state
 * @returns {{ pattern: string, flags: string, text: string, replacement: string, mode: string }}
 */
export function toRequest(state) {
  return { pattern: state.pattern, flags: state.flags, text: state.text, replacement: state.replacement, mode: state.tab };
}

/**
 * Encodes the shareable part of the state as a URL hash.
 * @param {TesterState} state
 * @returns {string} e.g. "#p=a%2B&f=g&t=…&r=…&v=matches"
 */
export function encodeHash(state) {
  const params = new URLSearchParams();
  for (const [field, key] of Object.entries(HASH_KEYS)) params.set(key, state[field]);
  return `#${params}`;
}

/**
 * Reads a share-link hash back into a state patch.
 * @param {string} hash  location.hash, with or without the leading #
 * @returns {Partial<TesterState>|null} null when the hash holds no pattern
 */
export function decodeHash(hash) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  if (!params.has(HASH_KEYS.pattern)) return null;
  const patch = {};
  for (const [field, key] of Object.entries(HASH_KEYS)) {
    if (params.has(key)) patch[field] = params.get(key);
  }
  return patch;
}

function normalize(state) {
  return {
    pattern: String(state.pattern ?? ''),
    flags: sanitizeFlags(String(state.flags ?? '')),
    text: String(state.text ?? ''),
    replacement: String(state.replacement ?? ''),
    tab: TABS.includes(state.tab) ? state.tab : 'matches',
    explainOpen: Boolean(state.explainOpen),
    cheatsOpen: Boolean(state.cheatsOpen),
  };
}
