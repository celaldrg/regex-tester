import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureNames, tokenize } from '../src/tokenizer.js';
import { describeError, describeToken, explain } from '../src/explain.js';
import { buildRegex, findMatches } from '../src/regex.js';

/** [pattern, flags, expected token types in order] */
const TYPE_CASES = [
  ['abc', '', ['literal']],
  ['ab+', '', ['literal', 'literal', 'quantifier']],
  ['^\\d{3}-\\d{4}$', '', ['anchor', 'class', 'quantifier', 'literal', 'class', 'quantifier', 'anchor']],
  ['[a-z]+', '', ['class', 'quantifier']],
  ['[^aeiou]', '', ['class']],
  ['(a|b)', '', ['group', 'literal', 'alternation', 'literal', 'groupEnd']],
  ['(?:x)', '', ['group', 'literal', 'groupEnd']],
  ['(?<year>\\d{4})', '', ['group', 'class', 'quantifier', 'groupEnd']],
  ['(?=foo)', '', ['lookaround', 'literal', 'groupEnd']],
  ['(?!bar)', '', ['lookaround', 'literal', 'groupEnd']],
  ['(?<=\\$)\\d+', '', ['lookaround', 'escape', 'groupEnd', 'class', 'quantifier']],
  ['(?<!x)y', '', ['lookaround', 'literal', 'groupEnd', 'literal']],
  ['(\\w)\\1', '', ['group', 'class', 'groupEnd', 'backreference']],
  ['(?<q>a)\\k<q>', '', ['group', 'literal', 'groupEnd', 'backreference']],
  ['\\bword\\b', '', ['anchor', 'literal', 'anchor']],
  ['\\Bx', '', ['anchor', 'literal']],
  ['a.c', '', ['literal', 'class', 'literal']],
  ['\\n\\t\\x41\\u00e7', '', ['escape', 'escape', 'escape', 'escape']],
  ['\\u{1F600}', 'u', ['escape']],
  ['\\p{Lu}\\P{L}', 'u', ['class', 'class']],
  ['a*?b+?c??', '', ['literal', 'quantifier', 'literal', 'quantifier', 'literal', 'quantifier']],
  ['x{2,}y{1,3}z{5}', '', ['literal', 'quantifier', 'literal', 'quantifier', 'literal', 'quantifier']],
  ['\\.\\*\\\\', '', ['escape', 'escape', 'escape']],
  ['[\\d.-]', '', ['class']],
  ['a{', '', ['literal']],
  ['\\1(a)', '', ['backreference', 'group', 'literal', 'groupEnd']],
  ['\\8', '', ['escape']],
  ['[][^]', '', ['class', 'class']],
  ['a|b|c', '', ['literal', 'alternation', 'literal', 'alternation', 'literal']],
  ['(?i:a)', '', ['group', 'literal', 'groupEnd']],
  ['\\cJ', '', ['escape']],
  ['\\c1', '', ['literal']],
  ['[\\]]', '', ['class']],
  ['^$', '', ['anchor', 'anchor']],
  ['\\0', '', ['escape']],
  ['\\k', '', ['escape']],
  ['(a)\\12', '', ['group', 'literal', 'groupEnd', 'escape']],
  ['\\s\\S\\w\\W\\d\\D', '', ['class', 'class', 'class', 'class', 'class', 'class']],
  ['(?<!\\d)(?=\\d{3})', '', ['lookaround', 'class', 'groupEnd', 'lookaround', 'class', 'quantifier', 'groupEnd']],
  ['(ab)+', '', ['group', 'literal', 'groupEnd', 'quantifier']],
];

test('has at least 25 tokenizer cases', () => {
  assert.ok(TYPE_CASES.length >= 25);
});

for (const [pattern, flags, types] of TYPE_CASES) {
  test(`token types: /${pattern}/${flags}`, () => {
    assert.deepEqual(tokenize(pattern, flags).map((token) => token.type), types);
  });
}

test('tokens carry positions, group numbers, names and links', () => {
  const tokens = tokenize('^(?<year>\\d{4})-(?<month>\\d\\d)$');
  const [start, year, digit, four, yearEnd, dash, month] = tokens;
  assert.deepEqual([start.start, start.end, start.kind], [0, 1, 'start']);
  assert.deepEqual([year.kind, year.number, year.name, year.start, year.end, year.close], ['named', 1, 'year', 1, 9, 14]);
  assert.deepEqual([digit.kind, digit.depth], ['digit', 1]);
  assert.deepEqual([four.kind, four.min, four.max, four.lazy, four.target], ['exact', 4, 4, false, 9]);
  assert.deepEqual([yearEnd.open, yearEnd.number, yearEnd.name, yearEnd.depth], [1, 1, 'year', 0]);
  assert.deepEqual([dash.value, dash.start], ['-', 15]);
  assert.deepEqual([month.number, month.name, month.start, month.end], [2, 'month', 16, 25]);
});

test('quantifier details', () => {
  const [, star] = tokenize('x*');
  assert.deepEqual([star.kind, star.min, star.max, star.lazy], ['star', 0, Infinity, false]);
  const [, range] = tokenize('a{2,5}?');
  assert.deepEqual([range.kind, range.min, range.max, range.lazy, range.raw], ['range', 2, 5, true, '{2,5}?']);
  const [, atLeast] = tokenize('a{3,}');
  assert.deepEqual([atLeast.kind, atLeast.min, atLeast.max], ['atLeast', 3, Infinity]);
  const groupPlus = tokenize('(ab)+');
  assert.equal(groupPlus[3].target, 0);
  assert.equal(tokenize('+')[0].target, null);
});

test('character set details', () => {
  const [set] = tokenize('[^a-z0-9_]');
  assert.deepEqual([set.kind, set.negated, set.items], ['set', true, ['a-z', '0-9', '_']]);
  const [mixed] = tokenize('[\\w.-]');
  assert.deepEqual(mixed.items, ['\\w', '.', '-']);
  const [unterminated] = tokenize('[abc');
  assert.deepEqual([unterminated.kind, unterminated.end], ['unterminated', 4]);
});

test('escape values', () => {
  const values = (pattern, flags) => tokenize(pattern, flags).map((t) => [t.kind, t.value]);
  assert.deepEqual(values('\\x41\\u00e7\\cJ\\0'), [['hex', 'A'], ['unicode', 'ç'], ['controlLetter', '\n'], ['nul', '\0']]);
  assert.deepEqual(values('\\012\\400'), [['octal', '\n'], ['octal', ' '], ['char', '0']]);
  assert.deepEqual(values('\\uD83D\\uDE00', 'u'), [['unicode', '😀']]);
  assert.deepEqual(values('\\.'), [['identity', '.']]);
});

test('modifier groups list the flags they switch (tokens only; engines differ in support)', () => {
  const [on] = tokenize('(?i:a)');
  assert.deepEqual([on.kind, on.add, on.remove, on.number], ['modifiers', 'i', '', null]);
  const [both] = explain('(?i-m:a)', '', 'en');
  assert.deepEqual([both.add, both.remove, both.text], ['i', 'm', 'Group with local flags +i −m.']);
  assert.equal(tokenize('(?-:a)')[0].kind, 'unknown');
});

test('depth follows group nesting', () => {
  assert.deepEqual(tokenize('((a))').map((t) => t.depth), [0, 1, 2, 1, 0]);
});

test('back-references know their group', () => {
  const named = tokenize('(?<q>a)\\k<q>')[3];
  assert.deepEqual([named.kind, named.number, named.name], ['name', 1, 'q']);
  const numbered = tokenize('(a)(?<b>b)\\2')[6];
  assert.deepEqual([numbered.kind, numbered.number, numbered.name], ['number', 2, 'b']);
});

test('Annex B: "\\c(" is a backslash, a "c" and a real group', () => {
  const tokens = tokenize('\\c(a)');
  assert.deepEqual(tokens.map((t) => [t.type, t.raw]), [['literal', '\\c'], ['group', '('], ['literal', 'a'], ['groupEnd', ')']]);
  assert.deepEqual(captureNames('\\c(a)'), [null]);
});

const ENGINE_CORPUS = [
  '(a)(?<x>b)(?:c)(d)',
  '[(](a)\\((b)',
  '(?<=(a))(?<!(b))(?=(c))(?!(d))',
  '\\c(a)',
  '[\\]](b)',
  '[]](c)',
  '(?<\\u0061b>x)(y)',
  '((((a))))',
  '(?<year>\\d{4})-(?<month>\\d{2})',
  '(a)\\12(b)',
  '[(?<n>x)](z)',
  '(?:(?:(a)))',
];

test('captureNames agrees with the engine on group count and names', () => {
  for (const pattern of ENGINE_CORPUS) {
    const probe = new RegExp(`${pattern}|`).exec('');
    assert.equal(captureNames(pattern).length, probe.length - 1, pattern);
    const named = captureNames(pattern).filter((name) => name !== null);
    assert.deepEqual(named.sort(), Object.keys(probe.groups ?? {}).sort(), pattern);
  }
  assert.deepEqual(captureNames('(?<\\u0061b>x)(y)'), ['ab', null]);
});

const TILING_CORPUS = [
  ...TYPE_CASES.map(([pattern, flags]) => [pattern, flags]),
  ['(', ''],
  [')', ''],
  ['[abc', ''],
  ['\\', ''],
  ['a{2', ''],
  ['(?', ''],
  ['(?<n', ''],
  ['\\k<', 'u'],
  ['\\u{', 'u'],
  ['\\p{', 'u'],
  ['\\x4', ''],
  ['[\\', ''],
  ['(?<\\u{FFFFFF}>x)', 'u'],
  ['😀+', ''],
  ['😀+', 'u'],
];

test('tokens tile every pattern, valid or not, without throwing', () => {
  for (const [pattern, flags] of TILING_CORPUS) {
    const tokens = tokenize(pattern, flags);
    let position = 0;
    for (const token of tokens) {
      assert.equal(token.start, position, `/${pattern}/${flags}`);
      assert.ok(token.end > token.start, `/${pattern}/${flags}`);
      assert.equal(token.raw, pattern.slice(token.start, token.end));
      position = token.end;
    }
    assert.equal(position, pattern.length, `/${pattern}/${flags}`);
  }
});

test('the u flag keeps astral characters whole', () => {
  assert.deepEqual(tokenize('😀+', 'u').map((t) => t.raw), ['😀', '+']);
  assert.deepEqual(tokenize('😀+', '').map((t) => t.raw.length), [1, 1, 1]);
});

test('every token gets a filled-in description in English and Turkish', () => {
  const placeholder = /\{(text|char|code|letter|value|items|min|max|number|name|modifiers)\}/;
  for (const [pattern, flags] of TILING_CORPUS) {
    const en = explain(pattern, flags, 'en');
    const tr = explain(pattern, flags, 'tr');
    en.forEach((token, k) => {
      for (const text of [token.text, tr[k].text]) {
        assert.ok(text.length > 0, `/${pattern}/ ${token.type}`);
        assert.ok(!text.includes('undefined'), `/${pattern}/ ${token.type}: ${text}`);
        assert.ok(!placeholder.test(text), `/${pattern}/ ${token.type}: ${text}`);
      }
      assert.notEqual(token.text, tr[k].text, `/${pattern}/ ${token.type}`);
    });
  }
});

test('descriptions follow the flags', () => {
  const [caret] = tokenize('^');
  assert.equal(describeToken(caret, '', 'en'), 'Start of the text.');
  assert.equal(describeToken(caret, 'm', 'en'), 'Start of a line (m flag).');
  assert.equal(describeToken(caret, 'm', 'tr'), 'Satır başı (m bayrağı).');
  const [dot] = tokenize('.');
  assert.match(describeToken(dot, 's', 'en'), /line breaks included/);
  const [word] = tokenize('abc');
  assert.match(describeToken(word, 'i', 'en'), /Upper and lower case/);
  assert.doesNotMatch(describeToken(word, '', 'en'), /Upper and lower case/);
});

test('descriptions name groups and repetition counts', () => {
  const [group, , quantifier] = explain('(?<yıl>\\d{4})', 'u', 'tr');
  assert.equal(group.text, '“yıl” adlı yakalama grubu (#1).');
  assert.equal(quantifier.text, 'Önceki öğeyi tam 4 kez tekrarlar (açgözlü: olabildiğince çok).');
  const [, lazy] = explain('a+?', '', 'en');
  assert.equal(lazy.text, 'Repeats the previous item one or more times (lazy: as few as possible).');
  const [set] = explain('[a-z_]', '', 'en');
  assert.equal(set.text, 'One character from the set: a-z, _.');
  const [word] = explain('\\w', '', 'tr');
  assert.match(word.text, /ç, ğ, ü/);
});

test('engine errors are described in both languages', () => {
  const unterminated = findMatches('(', '', '').error;
  assert.equal(describeError(unterminated, 'en'), 'Unterminated group');
  assert.equal(describeError(unterminated, 'tr'), 'Kapanmamış grup: bir “)” eksik.');
  const repeat = findMatches('*', '', '').error;
  assert.match(describeError(repeat, 'tr'), /Tekrarlanacak bir şey yok/);
  assert.equal(describeError(findMatches('a', 'x', '').error, 'tr'), 'Bilinmeyen bayrak “x”.');
  assert.equal(describeError(findMatches('a', 'gg', '').error, 'en'), 'The flag “g” appears twice.');
  assert.equal(describeError({ code: 'syntax', reason: 'some new engine message' }, 'tr'), 'Some new engine message');
  assert.equal(describeError({ code: 'runtime', reason: 'Maximum call stack size exceeded' }, 'en'), 'The engine stopped: Maximum call stack size exceeded');
});

/** [pattern, V8 reason, Turkish text] for broken flag groups (RegExp modifiers). */
const FLAG_GROUP_ERRORS = [
  ['(?ii:a)', 'Repeated flag in flag group', 'Bayrak grubunda aynı bayrak tekrarlanmış.'],
  ['(?i-i:a)', 'Repeated flag in flag group', 'Bayrak grubunda aynı bayrak tekrarlanmış.'],
  ['(?-:a)', 'Invalid flag group', 'Geçersiz bayrak grubu.'],
  ['(?i-m-s:a)', 'Multiple dashes in flag group', 'Bayrak grubunda birden çok tire var.'],
];

test('flag group and nesting errors are described in Turkish', () => {
  for (const [pattern, reason, turkish] of FLAG_GROUP_ERRORS) {
    const error = { code: 'syntax', message: `Invalid regular expression: /${pattern}/: ${reason}`, reason };
    assert.equal(describeError(error, 'tr'), turkish);
    assert.equal(describeError(error, 'en'), reason);
  }
  const deep = { code: 'runtime', message: 'Invalid regular expression: /((a))/: Stack overflow', reason: 'Stack overflow' };
  assert.equal(describeError(deep, 'tr'), 'Motor durdu: Yığın taştı: desen çok derin iç içe geçmiş.');
});

const hasModifiers = buildRegex('(?i:a)').ok;

test('the engine reports flag group errors with the reasons the table knows', { skip: !hasModifiers && 'no RegExp modifiers in this engine' }, () => {
  for (const [pattern, reason, turkish] of FLAG_GROUP_ERRORS) {
    const { error } = findMatches(pattern, '', 'a');
    assert.equal(error.reason, reason, pattern);
    assert.equal(describeError(error, 'tr'), turkish, pattern);
  }
});
