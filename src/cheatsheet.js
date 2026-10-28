/**
 * Cheat sheet data (English and Turkish). Pure data, no DOM.
 * Pattern snippets are complete, valid patterns (compiled with the item's flags), so the
 * UI can insert them as they are.
 *
 * @typedef {{ syntax: string, flags?: string, en: string, tr: string }} CheatItem
 * @typedef {{ id: string, kind: 'pattern'|'flag'|'replacement', title: { en: string, tr: string }, items: CheatItem[] }} CheatSection
 */
import { FLAGS } from './regex.js';

/** One line per flag, for the flag toggles and the cheat sheet. */
export const FLAG_INFO = Object.freeze({
  d: { en: 'Indices: report where every group starts and ends', tr: 'Konumlar: her grubun başladığı ve bittiği yeri verir' },
  g: { en: 'Global: find every match, not only the first', tr: 'Genel: yalnız ilkini değil, tüm eşleşmeleri bulur' },
  i: { en: 'Ignore case: A and a count as the same', tr: 'Harf duyarsız: A ile a aynı sayılır' },
  m: { en: 'Multiline: ^ and $ work at every line', tr: 'Çok satır: ^ ve $ her satırda çalışır' },
  s: { en: 'Dot all: . also matches line breaks', tr: 'Tam nokta: . satır sonlarını da eşler' },
  u: { en: 'Unicode: whole code points and \\p{…} classes', tr: 'Unicode: tam kod noktaları ve \\p{…} sınıfları' },
  y: { en: 'Sticky: each match must start where the last one ended', tr: 'Yapışkan: her eşleşme bir öncekinin bittiği yerde başlamalı' },
});

/** @type {readonly CheatSection[]} */
export const CHEAT_SHEET = Object.freeze([
  {
    id: 'characters',
    kind: 'pattern',
    title: { en: 'Characters', tr: 'Karakterler' },
    items: [
      { syntax: '.', en: 'Any character except a line break', tr: 'Satır sonu dışında herhangi bir karakter' },
      { syntax: '\\d', en: 'A digit 0–9', tr: '0–9 arası bir rakam' },
      { syntax: '\\D', en: 'Anything but a digit', tr: 'Rakam dışında herhangi bir şey' },
      { syntax: '\\w', en: 'Word character: A–Z, a–z, 0–9 or _', tr: 'Kelime karakteri: A–Z, a–z, 0–9 ya da _' },
      { syntax: '\\W', en: 'Anything but a word character', tr: 'Kelime karakteri dışında herhangi bir şey' },
      { syntax: '\\s', en: 'Whitespace: space, tab, line break', tr: 'Boşluk: boşluk, sekme, satır sonu' },
      { syntax: '\\S', en: 'Anything but whitespace', tr: 'Boşluk dışında herhangi bir şey' },
      { syntax: '[abc]', en: 'One of a, b or c', tr: 'a, b ya da c’den biri' },
      { syntax: '[^abc]', en: 'Any character except a, b and c', tr: 'a, b ve c dışında herhangi bir karakter' },
      { syntax: '[a-z]', en: 'One character from the range a–z', tr: 'a–z aralığından bir karakter' },
      { syntax: '\\p{L}', flags: 'u', en: 'A letter from any alphabet (u flag)', tr: 'Herhangi bir alfabeden bir harf (u bayrağı)' },
      { syntax: '\\p{Lu}', flags: 'u', en: 'An upper-case letter, e.g. İ or Ş (u flag)', tr: 'Büyük harf, örneğin İ ya da Ş (u bayrağı)' },
      { syntax: '\\.', en: 'A special character, escaped to match literally', tr: 'Düz eşlensin diye kaçışlanmış özel karakter' },
      { syntax: '\\n', en: 'Line feed (new line)', tr: 'Satır sonu (yeni satır)' },
      { syntax: '\\t', en: 'Tab', tr: 'Sekme' },
      { syntax: '\\u00e7', en: 'A character by its code: ç', tr: 'Koduyla bir karakter: ç' },
    ],
  },
  {
    id: 'anchors',
    kind: 'pattern',
    title: { en: 'Anchors', tr: 'Çapalar' },
    items: [
      { syntax: '^', en: 'Start of the text (of each line with m)', tr: 'Metnin başı (m ile her satırın başı)' },
      { syntax: '$', en: 'End of the text (of each line with m)', tr: 'Metnin sonu (m ile her satırın sonu)' },
      { syntax: '\\b', en: 'Word boundary', tr: 'Kelime sınırı' },
      { syntax: '\\B', en: 'Not a word boundary', tr: 'Kelime sınırı olmayan yer' },
    ],
  },
  {
    id: 'quantifiers',
    kind: 'pattern',
    title: { en: 'Quantifiers', tr: 'Niceleyiciler' },
    items: [
      { syntax: 'a*', en: 'Zero or more a', tr: 'Sıfır ya da daha çok a' },
      { syntax: 'a+', en: 'One or more a', tr: 'Bir ya da daha çok a' },
      { syntax: 'a?', en: 'Optional a', tr: 'İsteğe bağlı a' },
      { syntax: 'a{3}', en: 'Exactly three a', tr: 'Tam üç a' },
      { syntax: 'a{2,}', en: 'Two or more a', tr: 'İki ya da daha çok a' },
      { syntax: 'a{2,5}', en: 'Between two and five a', tr: 'İki ile beş arası a' },
      { syntax: 'a+?', en: 'Lazy: as few a as possible', tr: 'Tembel: olabildiğince az a' },
    ],
  },
  {
    id: 'groups',
    kind: 'pattern',
    title: { en: 'Groups and references', tr: 'Gruplar ve başvurular' },
    items: [
      { syntax: '(abc)', en: 'Capturing group, numbered from 1', tr: '1’den başlayarak numaralanan yakalama grubu' },
      { syntax: '(?<name>abc)', en: 'Named capturing group', tr: 'Adlı yakalama grubu' },
      { syntax: '(?:abc)', en: 'Group without capturing', tr: 'Yakalamayan grup' },
      { syntax: '(a)\\1', en: 'Back-reference to group 1', tr: '1. gruba geri başvuru' },
      { syntax: '(?<x>a)\\k<x>', en: 'Back-reference by name', tr: 'Ada göre geri başvuru' },
      { syntax: 'cat|dog', en: 'Either cat or dog', tr: 'Ya cat ya dog' },
    ],
  },
  {
    id: 'lookarounds',
    kind: 'pattern',
    title: { en: 'Lookarounds', tr: 'Çevre bakışları' },
    items: [
      { syntax: 'a(?=b)', en: 'a only when b follows', tr: 'Ardından b gelen a' },
      { syntax: 'a(?!b)', en: 'a only when b does not follow', tr: 'Ardından b gelmeyen a' },
      { syntax: '(?<=a)b', en: 'b only when a comes before', tr: 'Önünde a olan b' },
      { syntax: '(?<!a)b', en: 'b only when a does not come before', tr: 'Önünde a olmayan b' },
    ],
  },
  {
    id: 'flags',
    kind: 'flag',
    title: { en: 'Flags', tr: 'Bayraklar' },
    items: FLAGS.map((flag) => ({ syntax: flag, ...FLAG_INFO[flag] })),
  },
  {
    id: 'replacement',
    kind: 'replacement',
    title: { en: 'Replacement', tr: 'Değiştirme' },
    items: [
      { syntax: '$1', en: 'Text of group 1', tr: '1. grubun metni' },
      { syntax: '$<name>', en: 'Text of the named group', tr: 'Adlı grubun metni' },
      { syntax: '$&', en: 'The whole match', tr: 'Eşleşmenin tamamı' },
      { syntax: '$`', en: 'Text before the match', tr: 'Eşleşmeden önceki metin' },
      { syntax: "$'", en: 'Text after the match', tr: 'Eşleşmeden sonraki metin' },
      { syntax: '$$', en: 'A literal $ sign', tr: 'Düz bir $ işareti' },
    ],
  },
]);
