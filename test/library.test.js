import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES, exampleText, findExample } from '../src/library.js';
import { CHEAT_SHEET, FLAG_INFO } from '../src/cheatsheet.js';
import { explain } from '../src/explain.js';
import { FLAGS, buildRegex, findMatches, replaceText } from '../src/regex.js';
import { tokenize } from '../src/tokenizer.js';

const LANGS = ['en', 'tr'];
const LEAK = /undefined|\{(text|char|code|letter|value|items|min|max|number|name|modifiers)\}/;

function isFullMatch(example, line) {
  const found = findMatches(example.pattern, example.flags, line);
  return found.matches.length === 1 && found.matches[0].value === line;
}

test('the library has the required examples', () => {
  const ids = EXAMPLES.map((example) => example.id);
  for (const id of ['email', 'url', 'phone-tr', 'iban-tr', 'iso-date', 'hex-color']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const example of EXAMPLES) {
  test(`example ${example.id}: compiles, matches every sample, rejects every counter-example`, () => {
    assert.equal(buildRegex(example.pattern, example.flags).ok, true);
    assert.ok(example.samples.length >= 3 && example.counterExamples.length >= 3);
    const native = new RegExp(example.pattern, example.flags.replace(/[gy]/g, ''));
    for (const sample of example.samples) {
      assert.ok(!sample.includes('\n'));
      assert.ok(isFullMatch(example, sample), `should match: ${sample}`);
      assert.ok(native.test(sample), `native should match: ${sample}`);
    }
    for (const counter of example.counterExamples) {
      assert.ok(!counter.includes('\n'));
      assert.deepEqual(findMatches(example.pattern, example.flags, counter).matches, [], `should reject: ${counter}`);
      assert.ok(!native.test(counter), `native should reject: ${counter}`);
    }
  });

  test(`example ${example.id}: the loaded text matches exactly the samples`, () => {
    const text = exampleText(example);
    assert.equal(text.split('\n').length, example.samples.length + example.counterExamples.length);
    const found = findMatches(example.pattern, example.flags, text);
    assert.deepEqual(found.matches.map((match) => match.value), example.samples);
  });

  test(`example ${example.id}: the replacement uses existing groups and matches String.replace`, () => {
    const { groupCount, groupNames } = findMatches(example.pattern, example.flags, '');
    for (const [, name] of example.replacement.matchAll(/\$<([^>]*)>/g)) assert.ok(groupNames.includes(name), name);
    for (const [, digit] of example.replacement.matchAll(/\$(\d)/g)) assert.ok(Number(digit) <= groupCount, digit);
    const text = exampleText(example);
    const preview = replaceText(example.pattern, example.flags, text, example.replacement);
    assert.equal(preview.output, text.replace(new RegExp(example.pattern, example.flags), example.replacement));
    assert.equal(preview.count, example.samples.length);
  });

  test(`example ${example.id}: name and note in English and Turkish`, () => {
    for (const lang of LANGS) {
      assert.ok(example.name[lang].length > 0 && example.note[lang].length > 0);
    }
    assert.notEqual(example.note.en, example.note.tr);
  });
}

test('replacements rewrite the samples as intended', () => {
  const replaced = (id, line) => {
    const example = findExample(id);
    return replaceText(example.pattern, example.flags, line, example.replacement).output;
  };
  for (const phone of findExample('phone-tr').samples) assert.match(replaced('phone-tr', phone), /^\+90 5\d\d \d{3} \d\d \d\d$/);
  assert.equal(replaced('phone-tr', '+90 (532) 123-45-67'), '+90 532 123 45 67');
  assert.equal(replaced('phone-tr', '0 (505) 987 65 43'), '+90 505 987 65 43');
  assert.equal(replaced('iso-date', '2026-10-28'), '28.10.2026');
  assert.equal(replaced('email', 'ali.veli@example.com'), 'ali.veli [at] example.com');
  assert.equal(replaced('iban-tr', 'TR12 0006 4000 0011 2345 6789 01'), 'TR12 **** **** **** **** **** **');
  assert.equal(replaced('hex-color', '#c4b5fd'), '0xc4b5fd');
  assert.equal(replaced('url', 'https://sub.example.com.tr:8080/search?q=regex#top'), 'sub.example.com.tr');
  assert.equal(replaced('capitalized', 'İstanbul'), '«İstanbul»');
});

test('findExample and exampleText', () => {
  assert.equal(findExample('iso-date').flags, 'gm');
  assert.equal(findExample('nope'), undefined);
  const text = exampleText({ samples: ['a', 'b', 'c'], counterExamples: ['x'] });
  assert.equal(text, 'a\nx\nb\nc');
});

test('FLAG_INFO describes every flag in both languages', () => {
  assert.deepEqual(Object.keys(FLAG_INFO).sort(), [...FLAGS].sort());
  for (const flag of FLAGS) {
    assert.ok(FLAG_INFO[flag].en.length > 0 && FLAG_INFO[flag].tr.length > 0);
    assert.notEqual(FLAG_INFO[flag].en, FLAG_INFO[flag].tr);
  }
});

test('cheat sheet sections and items are complete in both languages', () => {
  const ids = CHEAT_SHEET.map((section) => section.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const section of CHEAT_SHEET) {
    assert.ok(['pattern', 'flag', 'replacement'].includes(section.kind), section.id);
    for (const lang of LANGS) assert.ok(section.title[lang].length > 0, section.id);
    assert.ok(section.items.length > 0, section.id);
    for (const item of section.items) {
      assert.ok(item.syntax.length > 0);
      for (const lang of LANGS) assert.ok(item[lang].length > 0, `${section.id} ${item.syntax}`);
    }
  }
  const flagSection = CHEAT_SHEET.find((section) => section.kind === 'flag');
  assert.deepEqual(flagSection.items.map((item) => item.syntax), [...FLAGS]);
});

/** Token types that every snippet of a pattern section must contain at least one of. */
const SECTION_TOKENS = {
  characters: ['class', 'escape'],
  anchors: ['anchor'],
  quantifiers: ['quantifier'],
  groups: ['group', 'alternation'],
  lookarounds: ['lookaround'],
};

test('every pattern snippet compiles, explains cleanly and shows its kind of token', () => {
  for (const section of CHEAT_SHEET.filter((s) => s.kind === 'pattern')) {
    const wanted = SECTION_TOKENS[section.id];
    assert.ok(wanted, section.id);
    for (const item of section.items) {
      const flags = item.flags ?? '';
      assert.equal(buildRegex(item.syntax, flags).ok, true, item.syntax);
      for (const lang of LANGS) {
        for (const token of explain(item.syntax, flags, lang)) assert.doesNotMatch(token.text, LEAK, item.syntax);
      }
      const types = tokenize(item.syntax, flags).map((token) => token.type);
      assert.ok(types.some((type) => wanted.includes(type)), `${item.syntax}: ${types}`);
    }
  }
});

test('the cheat sheet covers back-references and alternation', () => {
  const groups = CHEAT_SHEET.find((section) => section.id === 'groups');
  const types = groups.items.flatMap((item) => tokenize(item.syntax, item.flags ?? '').map((token) => token.type));
  assert.ok(types.includes('backreference'));
  assert.ok(types.includes('alternation'));
});

test('replacement snippets behave like String.replace', () => {
  const replacement = CHEAT_SHEET.find((section) => section.kind === 'replacement');
  for (const { syntax } of replacement.items) {
    const preview = replaceText('(?<name>b)', 'g', 'abc', syntax);
    assert.equal(preview.output, 'abc'.replace(/(?<name>b)/g, syntax), syntax);
  }
});
