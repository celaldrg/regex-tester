import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TABS,
  applyExample,
  createDemoState,
  createState,
  decodeHash,
  encodeHash,
  toRequest,
  toggleStateFlag,
  updateState,
} from '../src/state.js';
import { exampleText, findExample } from '../src/library.js';
import { analyze } from '../src/regex.js';
import { explain } from '../src/explain.js';

test('createState fills in the defaults', () => {
  const state = createState();
  assert.deepEqual(Object.keys(state).sort(), ['cheatsOpen', 'explainOpen', 'flags', 'pattern', 'replacement', 'tab', 'text']);
  assert.equal(state.pattern, 'colou?r');
  assert.equal(state.flags, 'gi');
  assert.equal(state.tab, 'matches');
  assert.equal(state.explainOpen, false);
  assert.equal(state.cheatsOpen, false);
  assert.equal(analyze(toRequest(state)).matches.length, 3);
});

test('createState normalizes bad input', () => {
  const state = createState({ tab: 'bogus', flags: 'yqgig', pattern: 42, text: null, explainOpen: 1 });
  assert.equal(state.tab, 'matches');
  assert.equal(state.flags, 'giy');
  assert.equal(state.pattern, '42');
  assert.equal(state.text, '');
  assert.equal(state.explainOpen, true);
  assert.deepEqual(TABS, ['matches', 'replace', 'split']);
});

test('updateState returns a new state and leaves the old one alone', () => {
  const before = createState();
  const frozen = structuredClone(before);
  const after = updateState(before, { pattern: 'x+', tab: 'split' });
  assert.notEqual(after, before);
  assert.deepEqual(before, frozen);
  assert.equal(after.pattern, 'x+');
  assert.equal(after.tab, 'split');
  assert.equal(after.text, before.text);
});

test('toggleStateFlag keeps the canonical flag order', () => {
  let state = createState({ flags: 'gi' });
  state = toggleStateFlag(state, 'm');
  assert.equal(state.flags, 'gim');
  state = toggleStateFlag(state, 'd');
  assert.equal(state.flags, 'dgim');
  state = toggleStateFlag(state, 'g');
  assert.equal(state.flags, 'dim');
  assert.equal(toggleStateFlag(state, 'x').flags, 'dim');
});

test('applyExample loads pattern, flags, text and replacement', () => {
  const base = createState({ tab: 'replace', cheatsOpen: true });
  const example = findExample('phone-tr');
  const state = applyExample(base, 'phone-tr');
  assert.equal(state.pattern, example.pattern);
  assert.equal(state.flags, example.flags);
  assert.equal(state.text, exampleText(example));
  assert.equal(state.replacement, example.replacement);
  assert.equal(state.tab, 'replace');
  assert.equal(state.cheatsOpen, true);
  assert.equal(analyze(toRequest(state)).replace.count, example.samples.length);
  assert.equal(applyExample(base, 'missing'), base);
});

test('toRequest passes the active tab as the analysis mode', () => {
  const state = createState({ pattern: 'a', flags: 'g', text: 'aa', replacement: 'b', tab: 'replace' });
  assert.deepEqual(toRequest(state), { pattern: 'a', flags: 'g', text: 'aa', replacement: 'b', mode: 'replace' });
});

test('the share hash round-trips tricky text', () => {
  const state = createState({
    pattern: '(?<ad>[A-ZÇĞİÖŞÜ]\\p{Ll}+) & #1 %20 +',
    flags: 'gmu',
    text: 'Çağrı & Şule\n#etiket 100% + 😀\r\n=?&',
    replacement: '$<ad> = $&$$',
    tab: 'split',
    explainOpen: true,
  });
  const hash = encodeHash(state);
  assert.match(hash, /^#p=/);
  assert.ok(!/[\s#]/.test(hash.slice(1)), 'no raw spaces, line breaks or # inside the hash');
  assert.equal(hash.split('&').length, 5);
  const restored = createState(decodeHash(hash));
  assert.deepEqual(restored, { ...state, explainOpen: false });
  assert.deepEqual(decodeHash(hash.slice(1)), decodeHash(hash));
});

test('decodeHash ignores hashes without a pattern', () => {
  for (const hash of ['', '#', '#t=abc', '#foo=bar', undefined, null]) assert.equal(decodeHash(hash), null);
  assert.deepEqual(decodeHash('#p='), { pattern: '' });
  assert.deepEqual(decodeHash('#p=a%2B&v=nope'), { pattern: 'a+', tab: 'nope' });
  assert.equal(createState(decodeHash('#p=a%2B&v=nope')).tab, 'matches');
  assert.equal(decodeHash('#p=%E0%A4%A').pattern.length > 0, true);
});

test('the demo state is deterministic and shows several matches', () => {
  const demo = createDemoState();
  assert.deepEqual(createDemoState(), demo);
  assert.notEqual(createDemoState(), demo);
  assert.equal(demo.explainOpen, true);
  const result = analyze(toRequest(demo));
  assert.equal(result.ok, true);
  assert.deepEqual(result.groupNames, ['year', 'month', 'day']);
  assert.deepEqual(
    result.matches.map((match) => match.value),
    ['2026-10-28', '2026-09-15', '2026-11-04', '2025-12-31', '2024-02-29'],
  );
  for (const match of result.matches) {
    assert.deepEqual(match.groups.map((group) => group.name), ['year', 'month', 'day']);
    assert.equal(match.groups.map((group) => group.value).join('-'), match.value);
  }
  const named = explain(demo.pattern, demo.flags, 'en').filter((token) => token.type === 'group' && token.kind === 'named');
  assert.deepEqual(named.map((token) => token.name), ['year', 'month', 'day']);
});

test('the demo replace tab converts the dates and skips the impossible one', () => {
  const demo = updateState(createDemoState(), { tab: 'replace' });
  const { output } = analyze(toRequest(demo)).replace;
  assert.match(output, /shipped on 28\.10\.2026; the beta opened on 15\.09\.2026\./);
  assert.match(output, /not a date: 2026-13-40/);
  assert.match(output, /leap day 29\.02\.2024\./);
});
