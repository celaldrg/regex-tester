import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAGS, buildRegex, findMatches, highlightSegments, parseFlags, sanitizeFlags, toggleFlag } from '../src/regex.js';

/**
 * Each case lists the expected matches as [index, value, groups], where every group is
 * [value, start] or null when the group did not take part in the match.
 */
const CASES = [
  {
    name: 'named date groups',
    pattern: '(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})',
    flags: 'g',
    text: 'Due 2026-10-28, paid 2026-11-02.',
    names: ['year', 'month', 'day'],
    expect: [
      [4, '2026-10-28', [['2026', 4], ['10', 9], ['28', 12]]],
      [21, '2026-11-02', [['2026', 21], ['11', 26], ['02', 29]]],
    ],
  },
  { name: 'first match only without g', pattern: '\\d+', flags: '', text: 'a1 b22 c333', expect: [[1, '1', []]] },
  {
    name: 'all matches with g',
    pattern: '\\d+',
    flags: 'g',
    text: 'a1 b22 c333',
    expect: [[1, '1', []], [4, '22', []], [8, '333', []]],
  },
  {
    name: 'ignore case',
    pattern: 'hello',
    flags: 'gi',
    text: 'Hello HELLO hello',
    expect: [[0, 'Hello', []], [6, 'HELLO', []], [12, 'hello', []]],
  },
  { name: 'lookahead', pattern: '\\d+(?=%)', flags: 'g', text: '50% of 200 is 100%', expect: [[0, '50', []], [14, '100', []]] },
  { name: 'negative lookahead', pattern: '\\b(?!un)\\w+', flags: 'g', text: 'undo redo unify', expect: [[5, 'redo', []]] },
  {
    name: 'lookbehind (Turkish lira sign)',
    pattern: '(?<=₺)\\d+(?:,\\d+)?',
    flags: 'g',
    text: 'Fiyat: ₺120,50 ve ₺99',
    expect: [[8, '120,50', []], [19, '99', []]],
  },
  { name: 'negative lookbehind', pattern: '(?<!\\$)\\b\\d+\\b', flags: 'g', text: '$5 and 10 and $20', expect: [[7, '10', []]] },
  {
    name: 'capture inside a lookbehind lies before the match',
    pattern: '(?<=(\\w))-(\\w)',
    flags: 'g',
    text: 'a-b c-d',
    expect: [[1, '-b', [['a', 0], ['b', 2]]], [5, '-d', [['c', 4], ['d', 6]]]],
  },
  {
    name: 'numbered back-reference',
    pattern: '(\\w)\\1',
    flags: 'g',
    text: 'aabbcd',
    expect: [[0, 'aa', [['a', 0]]], [2, 'bb', [['b', 2]]]],
  },
  {
    name: 'named back-reference',
    pattern: '(?<q>[\'"]).*?\\k<q>',
    flags: 'g',
    text: 'say "hi" and \'yo\'',
    names: ['q'],
    expect: [[4, '"hi"', [['"', 4]]], [13, "'yo'", [["'", 13]]]],
  },
  {
    name: 'multiline ^ matches every line',
    pattern: '^\\w+',
    flags: 'gm',
    text: 'alpha beta\ngamma\ndelta',
    expect: [[0, 'alpha', []], [11, 'gamma', []], [17, 'delta', []]],
  },
  { name: 'without m ^ is the text start only', pattern: '^\\w+', flags: 'g', text: 'alpha beta\ngamma\ndelta', expect: [[0, 'alpha', []]] },
  {
    name: 'multiline $ matches every line end',
    pattern: '\\d$',
    flags: 'gm',
    text: 'a1\nb2\nc3',
    expect: [[1, '1', []], [4, '2', []], [7, '3', []]],
  },
  { name: 'sticky without g: one match at index 0', pattern: '\\d', flags: 'y', text: '12a3', expect: [[0, '1', []]] },
  { name: 'sticky with g stops at the first gap', pattern: '\\d', flags: 'gy', text: '12a3', expect: [[0, '1', []], [1, '2', []]] },
  { name: 'sticky never searches ahead', pattern: 'a', flags: 'y', text: 'ba', expect: [] },
  { name: 'dotAll lets . match a line break', pattern: 'a.b', flags: 's', text: 'a\nb', expect: [[0, 'a\nb', []]] },
  { name: 'without s . stops at a line break', pattern: 'a.b', flags: '', text: 'a\nb', expect: [] },
  {
    name: 'empty matches advance one character',
    pattern: 'x*',
    flags: 'g',
    text: 'axb',
    expect: [[0, '', []], [1, 'x', []], [2, '', []], [3, '', []]],
  },
  { name: 'u flag: empty matches step over a surrogate pair', pattern: '(?:)', flags: 'gu', text: '😀', expect: [[0, '', []], [2, '', []]] },
  {
    name: 'without u: empty matches split a surrogate pair',
    pattern: '(?:)',
    flags: 'g',
    text: '😀',
    expect: [[0, '', []], [1, '', []], [2, '', []]],
  },
  { name: 'u flag: . matches a whole emoji', pattern: '^.$', flags: 'u', text: '😀', expect: [[0, '😀', []]] },
  {
    name: 'u flag: \\p{L} matches Turkish letters',
    pattern: '\\p{L}+',
    flags: 'gu',
    text: "Çağrı İstanbul'a gitti",
    expect: [[0, 'Çağrı', []], [6, 'İstanbul', []], [15, 'a', []], [17, 'gitti', []]],
  },
  {
    name: 'u flag: \\w stays ASCII-only',
    pattern: '\\w+',
    flags: 'gu',
    text: 'çay ılık',
    expect: [[1, 'ay', []], [5, 'l', []], [7, 'k', []]],
  },
  {
    name: 'u and i flags fold Turkish capitals (but not İ)',
    pattern: '[ğüşöç]+',
    flags: 'giu',
    text: 'GÜNEŞLİ ÇÖĞÜŞ',
    expect: [[1, 'Ü', []], [4, 'Ş', []], [8, 'ÇÖĞÜŞ', []]],
  },
  {
    name: 'Turkish group names with the u flag',
    pattern: '(?<gün>\\d{2})\\.(?<ay>\\d{2})\\.(?<yıl>\\d{4})',
    flags: 'u',
    text: 'Tarih: 28.10.2026',
    names: ['gün', 'ay', 'yıl'],
    expect: [[7, '28.10.2026', [['28', 7], ['10', 10], ['2026', 13]]]],
  },
  {
    name: 'groups that do not take part are null',
    pattern: '(a)|(b)',
    flags: 'g',
    text: 'ab',
    expect: [[0, 'a', [['a', 0], null]], [1, 'b', [null, ['b', 1]]]],
  },
  {
    name: 'nested groups',
    pattern: '((\\d)(\\d))-(\\d)',
    flags: '',
    text: 'x12-3',
    expect: [[1, '12-3', [['12', 1], ['1', 1], ['2', 2], ['3', 4]]]],
  },
  {
    name: 'named groups in an alternation-free URL pattern',
    pattern: '(?<scheme>https?)://(?<host>[^/\\s]+)',
    flags: 'g',
    text: 'see http://a.example and https://b.example/x',
    names: ['scheme', 'host'],
    expect: [
      [4, 'http://a.example', [['http', 4], ['a.example', 11]]],
      [25, 'https://b.example', [['https', 25], ['b.example', 33]]],
    ],
  },
  { name: 'lazy quantifier', pattern: '<.+?>', flags: 'g', text: '<a><b>', expect: [[0, '<a>', []], [3, '<b>', []]] },
  { name: 'greedy quantifier', pattern: '<.+>', flags: 'g', text: '<a><b>', expect: [[0, '<a><b>', []]] },
  {
    name: 'negated character set',
    pattern: '[^aeiou\\s]+',
    flags: 'g',
    text: 'regex tool',
    expect: [[0, 'r', []], [2, 'g', []], [4, 'x', []], [6, 't', []], [9, 'l', []]],
  },
  { name: 'not a word boundary', pattern: '\\Bend', flags: 'g', text: 'endless weekend', expect: [[12, 'end', []]] },
  {
    name: 'd flag set by the user',
    pattern: '(?<word>\\w+)@',
    flags: 'gd',
    text: 'me@ you@',
    names: ['word'],
    expect: [[0, 'me@', [['me', 0]]], [4, 'you@', [['you', 4]]]],
  },
  { name: 'hex escape with a quantifier', pattern: '\\x41{2,}', flags: 'g', text: 'A AA AAA', expect: [[2, 'AA', []], [5, 'AAA', []]] },
  { name: 'code point escape with the u flag', pattern: '\\u{1F600}+', flags: 'gu', text: 'hi 😀😀!', expect: [[3, '😀😀', []]] },
  {
    name: 'a repeated group keeps its last iteration',
    pattern: '(?:(\\d)-)+',
    flags: '',
    text: '1-2-3-',
    expect: [[0, '1-2-3-', [['3', 4]]]],
  },
  {
    name: 'optional group',
    pattern: 'colou?r(s)?',
    flags: 'gi',
    text: 'Colors and colour',
    expect: [[0, 'Colors', [['s', 5]]], [11, 'colour', [null]]],
  },
];

function summarize(result) {
  return result.matches.map((m) => [m.index, m.value, m.groups.map((g) => (g.value === null ? null : [g.value, g.start]))]);
}

/** The same summary straight from the platform engine, as the reference. */
function nativeSummary(pattern, flags, text) {
  const regex = new RegExp(pattern, flags.includes('d') ? flags : `${flags}d`);
  const found = regex.global ? [...text.matchAll(regex)] : [regex.exec(text)].filter(Boolean);
  return found.map((m) => [m.index, m[0], m.slice(1).map((value, k) => (value === undefined ? null : [value, m.indices[k + 1][0]]))]);
}

test('has at least 30 pattern/text cases', () => {
  assert.ok(CASES.length >= 30, `only ${CASES.length} cases`);
});

for (const c of CASES) {
  test(`matches: ${c.name}`, () => {
    const result = findMatches(c.pattern, c.flags, c.text);
    assert.equal(result.ok, true);
    assert.deepEqual(summarize(result), c.expect);
    assert.deepEqual(summarize(result), nativeSummary(c.pattern, c.flags, c.text));
    assert.deepEqual(result.groupNames, c.names ?? Array(result.groupCount).fill(null));
    assert.equal(result.truncated, false);
    for (const m of result.matches) {
      assert.equal(m.end, m.index + m.value.length);
      for (const g of m.groups) {
        if (g.value === null) assert.deepEqual([g.start, g.end], [null, null]);
        else assert.equal(c.text.slice(g.start, g.end), g.value);
      }
    }
  });
}

test('group count is known even when nothing matches', () => {
  const result = findMatches('(a)(?<b>b)(?:c)', 'g', 'zzz');
  assert.equal(result.groupCount, 2);
  assert.deepEqual(result.groupNames, [null, 'b']);
  assert.deepEqual(result.matches, []);
});

test('the match cap stops runaway results and reports truncation', () => {
  const capped = findMatches('a', 'g', 'a'.repeat(50), { maxMatches: 10 });
  assert.equal(capped.matches.length, 10);
  assert.equal(capped.truncated, true);
  const exact = findMatches('a', 'g', 'a'.repeat(10), { maxMatches: 10 });
  assert.equal(exact.matches.length, 10);
  assert.equal(exact.truncated, false);
  const empty = findMatches('', 'g', 'x'.repeat(5000));
  assert.equal(empty.matches.length, 1000);
  assert.equal(empty.truncated, true);
});

const INVALID = [
  ['(', ''],
  [')', ''],
  ['[', ''],
  ['*', ''],
  ['a**', ''],
  ['a{2,1}', ''],
  ['[z-a]', ''],
  ['\\', ''],
  ['(?<1a>x)', ''],
  ['(?<n>a)(?<n>b)', ''],
  ['(?<a>x)\\k<nope>', ''],
  ['(?<=a', ''],
  ['(?', ''],
  ['\\p{Foo}', 'u'],
  ['\\u{110000}', 'u'],
  ['\\1', 'u'],
  [']', 'u'],
  ['{1}', 'u'],
  ['\\-', 'u'],
];

for (const [pattern, flags] of INVALID) {
  test(`invalid pattern returns an error object: /${pattern}/${flags}`, () => {
    let result;
    assert.doesNotThrow(() => {
      result = findMatches(pattern, flags, 'some text');
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'syntax');
    assert.equal(typeof result.error.reason, 'string');
    assert.ok(result.error.reason.length > 0);
    assert.equal(buildRegex(pattern, flags).ok, false);
  });
}

test('a pattern nested too deeply for the engine returns an error object', () => {
  // The constructor accepts it; the engine only gives up when it compiles it on first use.
  const deep = `${'('.repeat(20000)}a${')'.repeat(20000)}`;
  let result;
  assert.doesNotThrow(() => {
    result = findMatches(deep, '', 'a');
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'runtime');
  assert.match(result.error.reason, /stack overflow/i);
});

test('invalid flags return an error object', () => {
  assert.deepEqual(findMatches('a', 'x', 'a').error.code, 'flag');
  assert.equal(findMatches('a', 'x', 'a').error.flag, 'x');
  assert.equal(findMatches('a', 'gg', 'a').error.code, 'repeatedFlag');
  assert.equal(buildRegex('a', 'v').ok, false);
});

test('flags are validated, cleaned and toggled in canonical order', () => {
  assert.deepEqual(FLAGS, ['d', 'g', 'i', 'm', 's', 'u', 'y']);
  assert.deepEqual(parseFlags('yigd'), { ok: true, flags: 'dgiy' });
  assert.equal(sanitizeFlags('yxgg'), 'gy');
  assert.equal(toggleFlag('gi', 'm'), 'gim');
  assert.equal(toggleFlag('gim', 'i'), 'gm');
  assert.equal(toggleFlag('g', 'q'), 'g');
  assert.equal(buildRegex('a', 'yg').regex.flags, 'gy');
});

test('highlight segments cover the text and mark the innermost group', () => {
  const text = 'on 2026-10-28.';
  const result = findMatches('(?<date>(?<year>\\d{4})-(\\d{2})-\\d{2})', 'g', text);
  const segments = highlightSegments(text, result.matches);
  assert.equal(segments.map((s) => text.slice(s.start, s.end)).join(''), text);
  const view = segments.map((s) => [text.slice(s.start, s.end), s.match, s.group]);
  assert.deepEqual(view, [
    ['on ', null, null],
    ['2026', 0, 2],
    ['-', 0, 1],
    ['10', 0, 3],
    ['-28', 0, 1],
    ['.', null, null],
  ]);
});

test('highlight segments keep empty matches and clip groups to the match', () => {
  const empty = findMatches('x*', 'g', 'ab');
  assert.deepEqual(
    highlightSegments('ab', empty.matches).map((s) => [s.start, s.end, s.match]),
    [[0, 0, 0], [0, 1, null], [1, 1, 1], [1, 2, null], [2, 2, 2]],
  );
  const behind = findMatches('(?<=(\\w))-', 'g', 'a-b');
  assert.deepEqual(highlightSegments('a-b', behind.matches), [
    { start: 0, end: 1, match: null, group: null },
    { start: 1, end: 2, match: 0, group: null },
    { start: 2, end: 3, match: null, group: null },
  ]);
});
