import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, expandReplacement, findMatches, replaceText, splitText } from '../src/regex.js';

/** [pattern, flags, text, template]: the preview must equal String.prototype.replace. */
const REPLACE_CASES = [
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', '$<m>/$<y>'],
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', '[$&]'],
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', '($`)'],
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', "($')"],
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', '$$ $$$ $'],
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', '$0 $00 $01 $1 $2 $3 $10 $99'],
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', '[$<nope>]'],
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', '[$<y]'],
  ['(?<y>\\d{4})-(?<m>\\d{2})', 'g', 'a 2026-10 b 2025-01', '[$<toString>]'],
  ['(\\w+)\\s(\\w+)', '', 'John Smith', '$2, $1'],
  ['(a)', 'g', 'banana', '[$<x>]'],
  ['(a)|(b)', 'g', 'abc', '[$1|$2]'],
  ['x*', 'g', 'axb', '-'],
  ['(?:)', 'gu', '😀a', '|'],
  ['(?:)', 'g', '😀a', '|'],
  ['\\d', 'y', '12a3', 'D'],
  ['\\d', 'gy', '12a3', 'D'],
  ['a', 'y', 'ba', 'X'],
  ['^', 'gm', 'a\nb\nc', '> '],
  ['$', 'gm', 'a\nb', ';'],
  ['b', 'g', 'abc', 'x$'],
  ['(\\d)(\\d)(\\d)(\\d)(\\d)(\\d)(\\d)(\\d)(\\d)(\\d)(\\d)', '', '12345678901', '$11-$10-$1-$111-$011'],
  ['(\\d)', 'g', '1 2', '$10'],
  ['.', 'gs', 'a\nb', '<$&>'],
  ['(?<first>\\p{Lu})(?<rest>\\p{Ll}+)', 'gu', 'İstanbul ve Çanakkale', '$<rest>$<first>'],
  ['(?<=₺)\\d+', 'g', '₺10 ve ₺250', '$&,00'],
  ['a*', 'g', '', 'X'],
  ['$', '', 'abc', '!'],
  ['\\b', 'g', 'hi there', '|'],
  ['a', 'g', 'aaa', '$x$-$'],
  ['(?<a>.)(?<b>.)', 'g', 'abcd', '$<b>$<a>'],
  ['(x)?y', 'g', 'y xy', '[$1]'],
  ['(\\d+)', 'g', 'a10b', '$01$001'],
  ['(?<w>\\w+)', 'i', 'Hello world', "$<w>$'$`"],
  ['o', 'g', 'foo boo', ''],
  ['(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])', 'g', 'on 2026-10-28 and 2024-02-29', '$<day>.$<month>.$<year>'],
];

for (const [pattern, flags, text, template] of REPLACE_CASES) {
  test(`replace parity: /${pattern}/${flags} with "${template}"`, () => {
    const result = replaceText(pattern, flags, text, template);
    assert.equal(result.ok, true);
    assert.equal(result.output, text.replace(new RegExp(pattern, flags), template));
    assert.equal(result.segments.map((s) => s.text).join(''), result.output);
  });
}

test('replace parity over a pattern x template matrix', () => {
  const patterns = [
    ['(\\w)(\\w)?', 'g'],
    ['(?<l>[a-z])(?<d>\\d)?', 'gi'],
    ['\\s+', 'g'],
    ['^(\\w+)', 'gm'],
    ['(?:)', 'g'],
    ['(ç|ş|ğ)', 'giu'],
    ['(.)\\1', 'g'],
    ['\\d+$', 'm'],
  ];
  const templates = ['$1', '$2', '$<l>', '$<d>', '$&$&', '$`', "$'", '$$1', '$12', '$<', '<$0>', ''];
  const text = 'Çağ 12 ab3\nşş xyz  ğ9\naa';
  let checks = 0;
  for (const [pattern, flags] of patterns) {
    for (const template of templates) {
      const result = replaceText(pattern, flags, text, template);
      assert.equal(result.output, text.replace(new RegExp(pattern, flags), template), `/${pattern}/${flags} "${template}"`);
      checks++;
    }
  }
  assert.equal(checks, 96);
});

test('replace segments mark the replaced parts and count them', () => {
  const result = replaceText('\\d+', 'g', 'a1b22c', '#');
  assert.deepEqual(result.segments, [
    { text: 'a', replaced: false },
    { text: '#', replaced: true },
    { text: 'b', replaced: false },
    { text: '#', replaced: true },
    { text: 'c', replaced: false },
  ]);
  assert.equal(result.count, 2);
});

test('replace keeps deletions visible as empty replaced segments', () => {
  const result = replaceText('o', 'g', 'foo', '');
  assert.equal(result.output, 'f');
  assert.deepEqual(result.segments.filter((s) => s.replaced), [{ text: '', replaced: true }, { text: '', replaced: true }]);
});

test('expandReplacement handles every token type directly', () => {
  const found = findMatches('(?<a>b)(c)?', 'g', 'abd');
  const match = found.matches[0];
  assert.equal(expandReplacement('$$|$&|$`|$\'|$1|$2|$<a>|$<zz>|$3|$', match, 'abd', true), '$|b|a|d|b||b||$3|$');
  assert.equal(expandReplacement('$<a>', match, 'abd', false), '$<a>');
});

test('replace with an invalid pattern returns the error', () => {
  const result = replaceText('(', 'g', 'abc', 'x');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'syntax');
});

test('a capped replace reports truncation instead of throwing', () => {
  const result = replaceText('a', 'g', 'a'.repeat(30), 'b', { maxMatches: 10 });
  assert.equal(result.truncated, true);
  assert.equal(result.output, 'b'.repeat(10) + 'a'.repeat(20));
});

/** [pattern, flags, text, limit]: part values must equal String.prototype.split. */
const SPLIT_CASES = [
  [',', '', 'a,b,,c'],
  ['(\\d)', '', 'a1b2c'],
  ['(?:)', '', 'abc'],
  ['(?:)', 'u', '😀a'],
  ['(?:)', '', '😀a'],
  ['x*', '', 'axbxxc'],
  ['\\s*', '', 'a b  c'],
  ['(-)|(\\+)', '', '1-2+3'],
  ['a*', '', ''],
  ['b', '', ''],
  [',', 'y', 'a,b,,c'],
  [',', 'g', 'a,b,,c'],
  [',', '', 'a,b,c,d', 2],
  ['(,)', '', 'a,b,c', 2],
  [',', '', 'a,b', 0],
  ['$', 'm', 'a\nb'],
  ['\\b', '', 'hi there'],
  ['(?<=,)', '', 'a,b,c'],
  ['\\s*[;,]\\s*', '', 'elma ; armut,  kiraz'],
  ['(?<sep>[-/.])', '', '28.10-2026/x'],
];

for (const [pattern, flags, text, limit] of SPLIT_CASES) {
  test(`split parity: /${pattern}/${flags} on ${JSON.stringify(text)}${limit === undefined ? '' : ` limit ${limit}`}`, () => {
    const result = splitText(pattern, flags, text, { limit });
    assert.equal(result.ok, true);
    const values = result.parts.map((part) => (part.value === null ? undefined : part.value));
    assert.deepEqual(values, text.split(new RegExp(pattern, flags), limit));
  });
}

test('split marks captured separators', () => {
  const result = splitText('(\\d)', '', 'a1b');
  assert.deepEqual(result.parts, [
    { value: 'a', capture: false },
    { value: '1', capture: true },
    { value: 'b', capture: false },
  ]);
});

test('split is capped and reports truncation', () => {
  const text = 'a,'.repeat(20);
  const result = splitText(',', '', text, { maxParts: 5 });
  assert.equal(result.truncated, true);
  assert.deepEqual(result.parts.map((p) => p.value), text.split(',').slice(0, 5));
});

test('analyze returns the preview for the active tab only', () => {
  const request = { pattern: '(?<d>\\d)', flags: 'g', text: 'a1b2', replacement: '<$<d>>' };
  const matches = analyze({ ...request, mode: 'matches' });
  assert.equal(matches.matches.length, 2);
  assert.equal(matches.replace, undefined);
  assert.equal(matches.split, undefined);
  assert.equal(analyze({ ...request, mode: 'replace' }).replace.output, 'a<1>b<2>');
  assert.deepEqual(analyze({ ...request, mode: 'split' }).split.parts.map((p) => p.value), ['a', '1', 'b', '2', '']);
});

test('analyze treats an empty pattern as "nothing to show yet"', () => {
  const result = analyze({ pattern: '', flags: 'g', text: 'abc', replacement: 'x', mode: 'replace' });
  assert.equal(result.ok, true);
  assert.equal(result.empty, true);
  assert.deepEqual(result.matches, []);
  assert.equal(result.replace.output, 'abc');
  assert.deepEqual(result.segments, [{ start: 0, end: 3, match: null, group: null }]);
  assert.deepEqual(analyze({ pattern: '', text: 'abc', mode: 'split' }).split.parts, [{ value: 'abc', capture: false }]);
  assert.equal(analyze({ pattern: '', flags: 'q', text: 'abc' }).ok, false);
});

test('analyze passes engine errors through', () => {
  const result = analyze({ pattern: '(?<a>x', flags: 'g', text: 'x', mode: 'split' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'syntax');
});
