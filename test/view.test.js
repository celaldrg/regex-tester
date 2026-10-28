import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUP_COLORS, LIST_LIMIT, activeExample, groupColor, summarize, tokenFocus, visibleRuns } from '../src/view.js';
import { tokenize } from '../src/tokenizer.js';
import { analyze } from '../src/regex.js';
import { TIMEOUT_MS } from '../src/runner.js';
import { applyExample, createDemoState, createState, toRequest, updateState } from '../src/state.js';
import { EXAMPLES } from '../src/library.js';

/** Index of the first token with this raw text. */
const at = (tokens, raw) => tokens.findIndex((token) => token.raw === raw);
const sorted = (set) => [...set].sort((a, b) => a - b);

test('group colours cycle through the palette', () => {
  assert.equal(GROUP_COLORS, 6);
  assert.deepEqual([1, 2, 6, 7, 12, 13].map(groupColor), [1, 2, 6, 1, 6, 1]);
  assert.ok(LIST_LIMIT >= 100);
});

test('visibleRuns shows line breaks and tabs as symbols', () => {
  assert.deepEqual(visibleRuns('a\nb'), [
    { text: 'a', special: false },
    { text: '↵', special: true },
    { text: 'b', special: false },
  ]);
  assert.deepEqual(visibleRuns('\t\r\n'), [
    { text: '⇥', special: true },
    { text: '␍', special: true },
    { text: '↵', special: true },
  ]);
  assert.deepEqual(visibleRuns('plain'), [{ text: 'plain', special: false }]);
  assert.deepEqual(visibleRuns(''), []);
});

test('activeExample recognizes a loaded library example', () => {
  for (const example of EXAMPLES) {
    assert.equal(activeExample(applyExample(createState(), example.id))?.id, example.id);
  }
  assert.equal(activeExample(createState()), undefined);
  const edited = updateState(applyExample(createState(), 'email'), { pattern: 'x' });
  assert.equal(activeExample(edited), undefined);
});

test('summarize describes every outcome', () => {
  assert.deepEqual(summarize('g', null), { kind: 'pending' });
  assert.deepEqual(summarize('g', { status: 'timeout' }), { kind: 'timeout', ms: TIMEOUT_MS });
  assert.deepEqual(summarize('g', { status: 'error', message: 'boom' }), { kind: 'failed', message: 'boom' });
  const invalid = analyze({ pattern: '(', text: 'x' });
  assert.equal(summarize('g', { status: 'done', result: invalid }).kind, 'error');
  assert.equal(summarize('g', { status: 'done', result: analyze({ pattern: '', text: 'x' }) }).kind, 'empty');
});

test('summarize counts matches and groups and flags a missing g', () => {
  const demo = createDemoState();
  const ok = summarize(demo.flags, { status: 'done', result: analyze(toRequest(demo)) });
  assert.deepEqual(ok, { kind: 'ok', count: 5, groups: 3, truncated: false, firstOnly: false });
  const first = summarize('', { status: 'done', result: analyze({ pattern: 'a', flags: '', text: 'aaa' }) });
  assert.equal(first.count, 1);
  assert.equal(first.firstOnly, true);
  const none = summarize('', { status: 'done', result: analyze({ pattern: 'z', flags: '', text: 'aaa' }) });
  assert.equal(none.count, 0);
  assert.equal(none.firstOnly, false);
  const capped = summarize('g', { status: 'done', result: analyze({ pattern: 'a', flags: 'g', text: 'a'.repeat(1500) }) });
  assert.equal(capped.truncated, true);
});

test('tokenFocus pairs group brackets in both directions', () => {
  const tokens = tokenize('(?<year>\\d{4})-(a)');
  const open = at(tokens, '(?<year>');
  const close = tokens.findIndex((token, k) => k > open && token.type === 'groupEnd');
  assert.deepEqual(sorted(tokenFocus(tokens, open).main), [open]);
  assert.deepEqual(sorted(tokenFocus(tokens, open).related), [close]);
  assert.deepEqual(sorted(tokenFocus(tokens, close).related), [open]);
});

test('tokenFocus links a quantifier to what it repeats', () => {
  const tokens = tokenize('(?:ab)+c');
  const plus = at(tokens, '+');
  const related = sorted(tokenFocus(tokens, plus).related);
  assert.deepEqual(related, [0, 1, 2], 'the whole group (opener, literal, closer) is repeated');
  const single = tokenize('ab*');
  assert.deepEqual(sorted(tokenFocus(single, at(single, '*')).related), [at(single, 'b')], 'only the b is repeated, not the a');
});

test('tokenFocus links a back-reference to its group', () => {
  const tokens = tokenize('(a)(b)\\2');
  const ref = tokens.findIndex((token) => token.type === 'backreference');
  const second = tokens.filter((token) => token.type === 'group').map((token) => tokens.indexOf(token))[1];
  assert.deepEqual(sorted(tokenFocus(tokens, ref).related), [second]);
});

test('tokenFocus without a token is empty', () => {
  const tokens = tokenize('a+');
  for (const index of [null, 99]) {
    const focus = tokenFocus(tokens, index);
    assert.equal(focus.main.size, 0);
    assert.equal(focus.related.size, 0);
  }
  assert.equal(tokenFocus(tokens, at(tokens, 'a')).related.size, 0, 'a literal has no partners');
});
