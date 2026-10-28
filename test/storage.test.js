import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/storage.js';

/** A Map-backed stand-in for localStorage. */
function memoryBackend() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

const throwing = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('values round-trip as JSON under a prefix', () => {
  const backend = memoryBackend();
  const store = createStorage(() => backend);
  assert.equal(store.set('lang', 'tr'), true);
  assert.equal(store.set('explainOpen', true), true);
  assert.equal(backend.map.get('regex-tester:lang'), '"tr"');
  assert.equal(store.get('lang', 'en'), 'tr');
  assert.equal(store.get('explainOpen', false), true);
});

test('a missing key returns the fallback', () => {
  const store = createStorage(() => memoryBackend());
  assert.equal(store.get('lang', 'en'), 'en');
  assert.equal(store.get('lang', null), null);
});

test('blocked storage never throws', () => {
  const store = createStorage(() => throwing);
  assert.equal(store.get('lang', 'en'), 'en');
  assert.equal(store.set('lang', 'tr'), false);
});

test('no storage at all never throws', () => {
  const store = createStorage(() => undefined);
  assert.equal(store.get('lang', 'en'), 'en');
  assert.equal(store.set('lang', 'tr'), false);
});

test('corrupted data returns the fallback', () => {
  const backend = memoryBackend();
  backend.map.set('regex-tester:lang', '{not json');
  assert.equal(createStorage(() => backend).get('lang', 'en'), 'en');
});

test('the backend is looked up on every access, not at import time', () => {
  let calls = 0;
  const store = createStorage(() => {
    calls++;
    return memoryBackend();
  });
  assert.equal(calls, 0);
  store.get('lang', 'en');
  store.set('lang', 'tr');
  assert.equal(calls, 2);
});
