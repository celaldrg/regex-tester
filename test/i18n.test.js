import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LANGS, STRINGS, normalizeLang, otherLang, translate, translateCount } from '../src/i18n.js';
import { FLAGS } from '../src/regex.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** True when the key exists, or exists as a counted pair (<key>.one and <key>.other). */
function known(key) {
  return Object.hasOwn(STRINGS.en, key) || (Object.hasOwn(STRINGS.en, `${key}.one`) && Object.hasOwn(STRINGS.en, `${key}.other`));
}

test('English and Turkish have exactly the same keys', () => {
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
  assert.deepEqual(LANGS, ['en', 'tr']);
});

test('no string is empty and both languages use the same placeholders', () => {
  for (const key of Object.keys(STRINGS.en)) {
    for (const lang of LANGS) assert.ok(STRINGS[lang][key].trim().length > 0, `${lang} ${key} is empty`);
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(STRINGS.en[key]), `placeholders differ in ${key}`);
  }
});

test('translate fills placeholders and falls back safely', () => {
  assert.equal(translate('en', 'status.timeout', { ms: 500 }), 'Stopped after 500 ms');
  assert.equal(translate('tr', 'status.timeout', { ms: 500 }), '500 ms sonra durduruldu');
  assert.equal(translate('en', 'status.timeout'), 'Stopped after {ms} ms', 'a missing parameter stays visible');
  assert.equal(translate('de', 'tab.split'), 'Split', 'an unknown language falls back to English');
  assert.equal(translate('en', 'no.such.key'), 'no.such.key');
  assert.equal(translate('en', 'toast.inserted', { syntax: '$&' }), 'Added $&', 'replacement patterns in values are inserted literally');
});

test('translateCount picks the singular or the plural', () => {
  assert.equal(translateCount('en', 'status.matches', 1), '1 match');
  assert.equal(translateCount('en', 'status.matches', 0), '0 matches');
  assert.equal(translateCount('en', 'status.matches', 7), '7 matches');
  assert.equal(translateCount('tr', 'split.count', 3), '3 parça');
});

test('normalizeLang and otherLang keep the language valid', () => {
  assert.equal(normalizeLang('tr'), 'tr');
  assert.equal(normalizeLang('xx'), 'en');
  assert.equal(normalizeLang(null), 'en');
  assert.equal(otherLang('en'), 'tr');
  assert.equal(otherLang('tr'), 'en');
  assert.equal(otherLang(undefined), 'tr');
});

test('the language toggle shows the language it switches to', () => {
  assert.equal(translate('en', 'header.langShort'), 'TR');
  assert.equal(translate('tr', 'header.langShort'), 'EN');
});

test('every flag has a name in both languages', () => {
  for (const flag of FLAGS) assert.ok(known(`flag.${flag}`), `flag.${flag} missing`);
});

test('every i18n key used in index.html exists', () => {
  const html = read('index.html');
  const keys = [...html.matchAll(/data-i18n(?:-placeholder|-label)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 30, 'the page should be translated');
  for (const key of keys) assert.ok(known(key), `index.html uses unknown key ${key}`);
});

test('every i18n key used in the UI modules exists', () => {
  const prefixes = new Set(Object.keys(STRINGS.en).map((key) => key.split('.')[0]));
  // explain.js, cheatsheet.js and library.js carry their own EN/TR text next to their data.
  const ownText = new Set(['i18n.js', 'explain.js', 'cheatsheet.js', 'library.js']);
  const files = readdirSync(new URL('src/', root)).filter((name) => name.endsWith('.js') && !ownText.has(name));
  let checked = 0;
  for (const name of files) {
    for (const [, key] of read(`src/${name}`).matchAll(/'([a-z]+\.[A-Za-z.]+)'/g)) {
      if (!prefixes.has(key.split('.')[0])) continue;
      assert.ok(known(key), `${name} uses unknown key ${key}`);
      checked++;
    }
  }
  assert.ok(checked > 30, 'the UI modules should use the string table');
});
