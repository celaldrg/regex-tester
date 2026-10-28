/**
 * Human-readable descriptions (English and Turkish) for pattern tokens and engine errors.
 * Pure module: data plus string formatting, no DOM.
 */
import { tokenize } from './tokenizer.js';

const MAX_SET_ITEMS = 12;

const STRINGS = {
  en: {
    'literal.one': 'Matches the character “{text}”.',
    'literal.many': 'Matches the text “{text}” exactly.',
    'literal.space': 'Matches a space.',
    'literal.caseless': 'Upper and lower case both match (i flag).',
    'escape.identity': 'Escaped “{char}”: matches a literal “{char}”.',
    'escape.control.n': 'Matches a line feed (newline).',
    'escape.control.r': 'Matches a carriage return.',
    'escape.control.t': 'Matches a tab character.',
    'escape.control.f': 'Matches a form feed.',
    'escape.control.v': 'Matches a vertical tab.',
    'escape.nul': 'Matches the NUL character (U+0000).',
    'escape.octal': 'Legacy octal escape: matches the character {code}.',
    'escape.controlLetter': 'Matches the control character Ctrl+{letter} ({code}).',
    'escape.hex': 'Matches the character {code} (“{char}”).',
    'escape.unicode': 'Matches the Unicode character {code} (“{char}”).',
    'escape.codePoint': 'Matches the Unicode code point {code} (“{char}”).',
    'escape.incomplete': 'Incomplete escape sequence.',
    'class.dot': 'Any single character except line breaks.',
    'class.dotAll': 'Any single character, line breaks included (s flag).',
    'class.digit': 'Any digit 0–9.',
    'class.notDigit': 'Any character that is not a digit.',
    'class.word': 'Any word character: ASCII letter, digit or underscore (not ç, ğ, ü…).',
    'class.notWord': 'Any character that is not an ASCII letter, digit or underscore.',
    'class.space': 'Any whitespace character (space, tab, line break…).',
    'class.notSpace': 'Any character that is not whitespace.',
    'class.property': 'Any character with the Unicode property {value}.',
    'class.notProperty': 'Any character without the Unicode property {value}.',
    'class.set': 'One character from the set: {items}.',
    'class.negatedSet': 'One character that is NOT in the set: {items}.',
    'class.empty': 'An empty set: never matches.',
    'class.any': 'Any character at all, line breaks included.',
    'class.unterminated': 'Unterminated character set: a “]” is missing.',
    'quantifier.star': 'Repeats the previous item zero or more times',
    'quantifier.plus': 'Repeats the previous item one or more times',
    'quantifier.optional': 'Makes the previous item optional (zero or one time)',
    'quantifier.once': 'The previous item appears exactly once',
    'quantifier.exact': 'Repeats the previous item exactly {min} times',
    'quantifier.atLeast': 'Repeats the previous item {min} or more times',
    'quantifier.range': 'Repeats the previous item {min} to {max} times',
    'quantifier.greedy': '(greedy: as many as possible).',
    'quantifier.lazy': '(lazy: as few as possible).',
    'group.capture': 'Capturing group #{number}: saves the text it matches.',
    'group.named': 'Named capturing group “{name}” (#{number}).',
    'group.nonCapture': 'Non-capturing group: groups items without saving them.',
    'group.modifiers': 'Group with local flags {modifiers}.',
    'group.unknown': 'Unknown group syntax.',
    'lookaround.lookahead': 'Lookahead: what follows must match this, without consuming it.',
    'lookaround.negativeLookahead': 'Negative lookahead: what follows must NOT match this.',
    'lookaround.lookbehind': 'Lookbehind: what comes before must match this.',
    'lookaround.negativeLookbehind': 'Negative lookbehind: what comes before must NOT match this.',
    'groupEnd.capture': 'End of group #{number}.',
    'groupEnd.named': 'End of group “{name}”.',
    'groupEnd.other': 'End of the group.',
    'groupEnd.unmatched': 'Unmatched “)”: there is no group to close.',
    'anchor.start': 'Start of the text.',
    'anchor.startLine': 'Start of a line (m flag).',
    'anchor.end': 'End of the text.',
    'anchor.endLine': 'End of a line (m flag).',
    'anchor.wordBoundary': 'Word boundary: between a word character and a non-word character.',
    'anchor.notWordBoundary': 'Not a word boundary.',
    'backreference.number': 'Back-reference: matches the same text as group #{number} again.',
    'backreference.name': 'Back-reference: matches the same text as group “{name}” again.',
    'alternation.or': 'OR: matches either the part before or the part after.',
    'error.flag': 'Unknown flag “{flag}”.',
    'error.repeatedFlag': 'The flag “{flag}” appears twice.',
    'error.runtime': 'The engine stopped: {reason}',
  },
  tr: {
    'literal.one': '“{text}” karakterini eşler.',
    'literal.many': '“{text}” metnini birebir eşler.',
    'literal.space': 'Bir boşluk eşler.',
    'literal.caseless': 'Büyük ve küçük harf fark etmez (i bayrağı).',
    'escape.identity': 'Kaçışlı “{char}”: düz bir “{char}” eşler.',
    'escape.control.n': 'Satır sonu (LF) karakterini eşler.',
    'escape.control.r': 'Satır başı (CR) karakterini eşler.',
    'escape.control.t': 'Sekme (tab) karakterini eşler.',
    'escape.control.f': 'Sayfa ilerletme (form feed) karakterini eşler.',
    'escape.control.v': 'Dikey sekme karakterini eşler.',
    'escape.nul': 'NUL karakterini (U+0000) eşler.',
    'escape.octal': 'Eski usul sekizlik kaçış: {code} karakterini eşler.',
    'escape.controlLetter': 'Ctrl+{letter} denetim karakterini ({code}) eşler.',
    'escape.hex': '{code} karakterini (“{char}”) eşler.',
    'escape.unicode': '{code} Unicode karakterini (“{char}”) eşler.',
    'escape.codePoint': '{code} Unicode kod noktasını (“{char}”) eşler.',
    'escape.incomplete': 'Eksik kaçış dizisi.',
    'class.dot': 'Satır sonu dışındaki herhangi bir karakter.',
    'class.dotAll': 'Satır sonu dahil herhangi bir karakter (s bayrağı).',
    'class.digit': '0–9 arası herhangi bir rakam.',
    'class.notDigit': 'Rakam olmayan herhangi bir karakter.',
    'class.word': 'Herhangi bir kelime karakteri: ASCII harf, rakam ya da alt çizgi (ç, ğ, ü… dahil değil).',
    'class.notWord': 'ASCII harf, rakam ya da alt çizgi olmayan herhangi bir karakter.',
    'class.space': 'Herhangi bir boşluk karakteri (boşluk, sekme, satır sonu…).',
    'class.notSpace': 'Boşluk olmayan herhangi bir karakter.',
    'class.property': '{value} Unicode özelliğine sahip herhangi bir karakter.',
    'class.notProperty': '{value} Unicode özelliğine sahip olmayan herhangi bir karakter.',
    'class.set': 'Kümeden bir karakter: {items}.',
    'class.negatedSet': 'Kümede OLMAYAN bir karakter: {items}.',
    'class.empty': 'Boş küme: hiçbir zaman eşleşmez.',
    'class.any': 'Satır sonu dahil kesinlikle herhangi bir karakter.',
    'class.unterminated': 'Kapanmamış karakter kümesi: bir “]” eksik.',
    'quantifier.star': 'Önceki öğeyi sıfır ya da daha çok kez tekrarlar',
    'quantifier.plus': 'Önceki öğeyi bir ya da daha çok kez tekrarlar',
    'quantifier.optional': 'Önceki öğeyi isteğe bağlı yapar (sıfır ya da bir kez)',
    'quantifier.once': 'Önceki öğe tam bir kez geçer',
    'quantifier.exact': 'Önceki öğeyi tam {min} kez tekrarlar',
    'quantifier.atLeast': 'Önceki öğeyi en az {min} kez tekrarlar',
    'quantifier.range': 'Önceki öğeyi {min} ile {max} kez arasında tekrarlar',
    'quantifier.greedy': '(açgözlü: olabildiğince çok).',
    'quantifier.lazy': '(tembel: olabildiğince az).',
    'group.capture': '{number} numaralı yakalama grubu: eşlediği metni saklar.',
    'group.named': '“{name}” adlı yakalama grubu (#{number}).',
    'group.nonCapture': 'Yakalamayan grup: öğeleri saklamadan gruplar.',
    'group.modifiers': 'Yerel bayraklı grup {modifiers}.',
    'group.unknown': 'Tanınmayan grup sözdizimi.',
    'lookaround.lookahead': 'İleri bakış: ardından gelen metin buna uymalı, ama tüketilmez.',
    'lookaround.negativeLookahead': 'Olumsuz ileri bakış: ardından gelen metin buna UYMAMALI.',
    'lookaround.lookbehind': 'Geri bakış: önündeki metin buna uymalı.',
    'lookaround.negativeLookbehind': 'Olumsuz geri bakış: önündeki metin buna UYMAMALI.',
    'groupEnd.capture': '{number} numaralı grubun sonu.',
    'groupEnd.named': '“{name}” grubunun sonu.',
    'groupEnd.other': 'Grubun sonu.',
    'groupEnd.unmatched': 'Eşi olmayan “)”: kapatılacak grup yok.',
    'anchor.start': 'Metnin başı.',
    'anchor.startLine': 'Satır başı (m bayrağı).',
    'anchor.end': 'Metnin sonu.',
    'anchor.endLine': 'Satır sonu (m bayrağı).',
    'anchor.wordBoundary': 'Kelime sınırı: kelime karakteri ile kelime olmayan karakterin arası.',
    'anchor.notWordBoundary': 'Kelime sınırı olmayan konum.',
    'backreference.number': 'Geri başvuru: {number} numaralı grubun eşlediği metni yeniden eşler.',
    'backreference.name': 'Geri başvuru: “{name}” grubunun eşlediği metni yeniden eşler.',
    'alternation.or': 'VEYA: öncesindeki ya da sonrasındaki kısmı eşler.',
    'error.flag': 'Bilinmeyen bayrak “{flag}”.',
    'error.repeatedFlag': '“{flag}” bayrağı iki kez yazılmış.',
    'error.runtime': 'Motor durdu: {reason}',
  },
};

/** Turkish versions of the V8 syntax error reasons (other engines fall back to their own text). */
const ERROR_REASONS_TR = {
  'unterminated group': 'Kapanmamış grup: bir “)” eksik.',
  "unmatched ')'": 'Eşi olmayan “)”.',
  '\\ at end of pattern': 'Desen “\\” ile bitiyor.',
  'invalid property name': 'Geçersiz Unicode özellik adı.',
  'invalid escape': 'Geçersiz kaçış dizisi.',
  'invalid decimal escape': 'Geçersiz ondalık kaçış.',
  'invalid unicode escape': 'Geçersiz Unicode kaçışı.',
  'nothing to repeat': 'Tekrarlanacak bir şey yok: niceleyiciden önce bir öğe olmalı.',
  'lone quantifier brackets': 'Tek başına kalmış niceleyici parantezi.',
  'numbers out of order in {} quantifier': '{} niceleyicisinde sayılar ters sırada.',
  'incomplete quantifier': 'Eksik niceleyici.',
  'invalid quantifier': 'Geçersiz niceleyici.',
  'invalid group': 'Geçersiz grup.',
  'invalid flag group': 'Geçersiz bayrak grubu.',
  'repeated flag in flag group': 'Bayrak grubunda aynı bayrak tekrarlanmış.',
  'multiple dashes in flag group': 'Bayrak grubunda birden çok tire var.',
  'invalid capture group name': 'Geçersiz yakalama grubu adı.',
  'duplicate capture group name': 'Aynı adı taşıyan iki yakalama grubu.',
  'invalid named reference': 'Geçersiz adlı başvuru.',
  'invalid named capture referenced': 'Var olmayan bir adlı gruba başvuru.',
  'invalid class escape': 'Geçersiz sınıf kaçışı.',
  'invalid property name in character class': 'Karakter kümesinde geçersiz özellik adı.',
  'invalid character class': 'Geçersiz karakter kümesi.',
  'unterminated character class': 'Kapanmamış karakter kümesi: bir “]” eksik.',
  'range out of order in character class': 'Karakter kümesinde aralık ters sırada.',
  'regular expression too large': 'Düzenli ifade çok büyük.',
  'too many captures': 'Çok fazla yakalama grubu.',
  'maximum call stack size exceeded': 'Bellek sınırı aşıldı (çok derin geri izleme).',
  'stack overflow': 'Yığın taştı: desen çok derin iç içe geçmiş.',
};

/**
 * Tokenizes a pattern and adds a description to every token.
 * @param {string} pattern
 * @param {string} [flags]
 * @param {'en'|'tr'} [lang]
 * @returns {Array<import('./tokenizer.js').Token & { text: string }>}
 */
export function explain(pattern, flags = '', lang = 'en') {
  return tokenize(pattern, flags).map((token) => ({ ...token, text: describeToken(token, flags, lang) }));
}

/**
 * Describes one token in the chosen language.
 * @param {import('./tokenizer.js').Token} token
 * @param {string} [flags]  flags change some meanings (m for ^ $, s for ., i for literals)
 * @param {'en'|'tr'} [lang]
 * @returns {string}
 */
export function describeToken(token, flags = '', lang = 'en') {
  return phrases(token, flags)
    .map(([key, params]) => format(lang, key, params))
    .join(' ');
}

/**
 * Turns an error object from the regex engine module into a short message.
 * @param {{ code: string, reason?: string, message?: string, flag?: string }} error
 * @param {'en'|'tr'} [lang]
 * @returns {string}
 */
export function describeError(error, lang = 'en') {
  if (error.code === 'flag' || error.code === 'repeatedFlag') return format(lang, `error.${error.code}`, { flag: error.flag });
  const reason = String(error.reason ?? error.message ?? '');
  const translated = lang === 'tr' ? ERROR_REASONS_TR[reason.toLowerCase()] : undefined;
  const text = translated ?? capitalize(reason);
  return error.code === 'runtime' ? format(lang, 'error.runtime', { reason: text }) : text;
}

function format(lang, key, params = {}) {
  const template = (STRINGS[lang] ?? STRINGS.en)[key] ?? STRINGS.en[key];
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name]));
}

function phrases(token, flags) {
  switch (token.type) {
    case 'literal':
      return literalPhrases(token, flags);
    case 'escape':
      return [escapePhrase(token)];
    case 'class':
      return [classPhrase(token, flags)];
    case 'quantifier':
      return quantifierPhrases(token);
    case 'group':
    case 'lookaround':
      return [[`${token.type}.${token.kind}`, { number: token.number, name: token.name, modifiers: modifierText(token) }]];
    case 'groupEnd':
      return [groupEndPhrase(token)];
    case 'anchor':
      return [anchorPhrase(token, flags)];
    default:
      return [[`${token.type}.${token.kind}`, { number: token.number, name: token.name }]];
  }
}

function literalPhrases(token, flags) {
  const chars = [...token.value];
  const main = token.value === ' '
    ? ['literal.space']
    : [chars.length === 1 ? 'literal.one' : 'literal.many', { text: visible(token.value) }];
  const cased = token.value.toLowerCase() !== token.value.toUpperCase();
  return flags.includes('i') && cased ? [main, ['literal.caseless']] : [main];
}

function escapePhrase(token) {
  const value = token.value ?? '';
  const params = { char: visible(value), code: codeOf(value), letter: token.raw.slice(2).toUpperCase() };
  const key = token.kind === 'control' ? `escape.control.${token.raw[1]}` : `escape.${token.kind}`;
  return [key, params];
}

function classPhrase(token, flags) {
  if (token.kind === 'dot') return [flags.includes('s') ? 'class.dotAll' : 'class.dot'];
  if (token.kind !== 'set') return [`class.${token.kind}`, { value: token.value }];
  if (token.items.length === 0) return [token.negated ? 'class.any' : 'class.empty'];
  const shown = token.items.slice(0, MAX_SET_ITEMS).map(visible);
  const items = token.items.length > MAX_SET_ITEMS ? `${shown.join(', ')}, …` : shown.join(', ');
  return [token.negated ? 'class.negatedSet' : 'class.set', { items }];
}

function quantifierPhrases(token) {
  const kind = token.kind === 'exact' && token.min === 1 ? 'once' : token.kind;
  return [[`quantifier.${kind}`, { min: token.min, max: token.max }], [token.lazy ? 'quantifier.lazy' : 'quantifier.greedy']];
}

function groupEndPhrase(token) {
  if (token.kind === 'unmatched') return ['groupEnd.unmatched'];
  if (token.number === null) return ['groupEnd.other'];
  return [token.name === null ? 'groupEnd.capture' : 'groupEnd.named', { number: token.number, name: token.name }];
}

function anchorPhrase(token, flags) {
  const multiline = flags.includes('m');
  if (token.kind === 'start') return [multiline ? 'anchor.startLine' : 'anchor.start'];
  if (token.kind === 'end') return [multiline ? 'anchor.endLine' : 'anchor.end'];
  return [`anchor.${token.kind}`];
}

function modifierText(token) {
  if (token.kind !== 'modifiers') return '';
  const on = token.add ? `+${token.add}` : '';
  const off = token.remove ? `−${token.remove}` : '';
  return [on, off].filter(Boolean).join(' ');
}

function codeOf(value) {
  const codePoint = value.codePointAt(0) ?? 0;
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Makes control characters readable inside a description. */
function visible(text) {
  return text.replace(/[\u0000-\u001f\u007f]/g, (ch) => {
    const names = { '\n': '\\n', '\r': '\\r', '\t': '\\t' };
    return names[ch] ?? `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`;
  });
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
