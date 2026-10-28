import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyExample, createDemoState, createState, isBuiltIn, isDefaultShare, toRequest, updateState } from '../src/state.js';
import { EXAMPLES } from '../src/library.js';
import { analyze } from '../src/regex.js';

const shipped = () => [createState(), createDemoState(), ...EXAMPLES.map((example) => applyExample(createState(), example.id))];

test('the start state, the demo and every example count as built in', () => {
  for (const state of shipped()) assert.equal(isBuiltIn(state), true, state.pattern);
});

test('every built-in state analyses cleanly in every tab', () => {
  for (const state of shipped()) {
    for (const tab of ['matches', 'replace', 'split']) {
      const result = analyze(toRequest(updateState(state, { tab })));
      assert.equal(result.ok, true, `${state.pattern} (${tab})`);
      assert.equal(result.truncated, false);
    }
  }
});

test('any edit to pattern, flags or text leaves the built-in set', () => {
  const start = createState();
  assert.equal(isBuiltIn(updateState(start, { pattern: 'colou?rs' })), false);
  assert.equal(isBuiltIn(updateState(start, { flags: 'g' })), false);
  assert.equal(isBuiltIn(updateState(start, { text: `${start.text} ` })), false);
  assert.equal(isBuiltIn(updateState(start, { replacement: '<$&>', tab: 'replace' })), true, 'replacement and tab do not matter');
});

test('only the start state needs no share hash', () => {
  assert.equal(isDefaultShare(createState()), true);
  assert.equal(isDefaultShare(createState({ explainOpen: true, cheatsOpen: true })), true, 'panels are not shared');
  assert.equal(isDefaultShare(createState({ tab: 'split' })), false);
  assert.equal(isDefaultShare(createDemoState()), false);
});
