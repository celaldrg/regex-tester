/**
 * Interface strings in English and Turkish. Pure module: data plus formatting, no DOM.
 * Token explanations, cheat sheet entries and example texts live next to their data
 * (explain.js, cheatsheet.js, library.js); this file holds every other visible string.
 */

/** Supported interface languages; the first one is the default. */
export const LANGS = Object.freeze(['en', 'tr']);

/** String tables. Keys ending in .one / .other are the singular and plural forms. */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    'app.title': 'Regex Tester',
    'app.tagline': 'Live JavaScript regular expressions',
    'app.skip': 'Skip to the pattern',
    'header.share': 'Share',
    'header.reset': 'Reset',
    'header.langShort': 'TR',
    'header.langLabel': 'Switch to Turkish',
    'pattern.label': 'Regular expression',
    'pattern.placeholder': 'Type a pattern, e.g. \\d+',
    'flags.label': 'Flags',
    'flag.d': 'indices',
    'flag.g': 'global',
    'flag.i': 'ignore case',
    'flag.m': 'multiline',
    'flag.s': 'dot all',
    'flag.u': 'unicode',
    'flag.y': 'sticky',
    'tools.explain': 'Explain',
    'tools.examples': 'Examples',
    'tools.cheats': 'Cheat sheet',
    'status.pending': 'Matching…',
    'status.empty': 'Type a pattern to start.',
    'status.none': 'No match',
    'status.matches.one': '{count} match',
    'status.matches.other': '{count} matches',
    'status.groups.one': '{count} group',
    'status.groups.other': '{count} groups',
    'status.truncated': 'list capped at {count}',
    'status.firstOnly': 'first match only, turn on g for all',
    'status.error': 'Invalid pattern: {message}',
    'status.timeout': 'Stopped after {ms} ms',
    'status.failed': 'The matcher could not run: {message}',
    'notice.errorTitle': 'Invalid pattern',
    'notice.timeoutTitle': 'Stopped after {ms} ms',
    'notice.timeoutBody':
      'This pattern may backtrack catastrophically on this text. Nested quantifiers such as (a+)+ are a common cause; try a more specific pattern.',
    'notice.failedTitle': 'The matcher could not run',
    'text.label': 'Test text',
    'text.placeholder': 'Type or paste the text to test…',
    'legend.label': 'Colour key',
    'legend.match': 'match',
    'results.label': 'Results',
    'tab.matches': 'Matches',
    'tab.replace': 'Replace',
    'tab.split': 'Split',
    'match.range': 'index {start}–{end}',
    'match.groupRange': '{start}–{end}',
    'value.empty': 'empty',
    'group.unset': 'did not take part',
    'matches.none': 'No matches. Change the pattern, the flags or the text.',
    'matches.more.one': '{count} more match is highlighted but not listed.',
    'matches.more.other': '{count} more matches are highlighted but not listed.',
    'replace.label': 'Replacement',
    'replace.placeholder': 'e.g. $1 or $<name>',
    'replace.insert': 'Insert',
    'replace.output': 'Result',
    'replace.count.one': '{count} replacement',
    'replace.count.other': '{count} replacements',
    'replace.copy': 'Copy',
    'split.title': 'Parts',
    'split.count.one': '{count} part',
    'split.count.other': '{count} parts',
    'split.capture': 'captured',
    'split.unset': 'group did not take part',
    'explain.title': 'Explanation',
    'explain.hint': 'Hover or tap a token to find it in the pattern.',
    'explain.empty': 'Type a pattern to see each part explained.',
    'explain.close': 'Close the explanation',
    'cheats.title': 'Cheat sheet',
    'cheats.hint': 'Tap an item to add it to the pattern. Flags switch on or off.',
    'cheats.close': 'Close the cheat sheet',
    'examples.title': 'Example library',
    'examples.hint': 'Each example loads a pattern with lines that should and should not match.',
    'examples.close': 'Close the example library',
    'toast.copied': 'Link copied to the clipboard.',
    'toast.copyFailed': 'Could not copy. The link is in the address bar.',
    'toast.outputCopied': 'Result copied to the clipboard.',
    'toast.outputCopyFailed': 'Could not copy the result.',
    'toast.reset': 'Back to the starting example.',
    'toast.example': 'Loaded: {name}',
    'toast.inserted': 'Added {syntax}',
    'toast.flagOn': 'Flag {flag} is on',
    'toast.flagOff': 'Flag {flag} is off',
    'footer.source': 'Source on GitHub',
  }),
  tr: Object.freeze({
    'app.title': 'Regex Tester',
    'app.tagline': 'Canlı JavaScript düzenli ifadeleri',
    'app.skip': 'Desen alanına geç',
    'header.share': 'Paylaş',
    'header.reset': 'Sıfırla',
    'header.langShort': 'EN',
    'header.langLabel': 'İngilizceye geç',
    'pattern.label': 'Düzenli ifade',
    'pattern.placeholder': 'Bir desen yazın, ör. \\d+',
    'flags.label': 'Bayraklar',
    'flag.d': 'konumlar',
    'flag.g': 'genel',
    'flag.i': 'harf duyarsız',
    'flag.m': 'çok satır',
    'flag.s': 'tam nokta',
    'flag.u': 'unicode',
    'flag.y': 'yapışkan',
    'tools.explain': 'Açıkla',
    'tools.examples': 'Örnekler',
    'tools.cheats': 'Hızlı başvuru',
    'status.pending': 'Eşleştiriliyor…',
    'status.empty': 'Başlamak için bir desen yazın.',
    'status.none': 'Eşleşme yok',
    'status.matches.one': '{count} eşleşme',
    'status.matches.other': '{count} eşleşme',
    'status.groups.one': '{count} grup',
    'status.groups.other': '{count} grup',
    'status.truncated': 'liste {count} ile sınırlı',
    'status.firstOnly': 'yalnız ilk eşleşme; tümü için g’yi açın',
    'status.error': 'Geçersiz desen: {message}',
    'status.timeout': '{ms} ms sonra durduruldu',
    'status.failed': 'Eşleştirici çalışamadı: {message}',
    'notice.errorTitle': 'Geçersiz desen',
    'notice.timeoutTitle': '{ms} ms sonra durduruldu',
    'notice.timeoutBody':
      'Bu desen bu metinde felaket düzeyinde geri izlemeye girebilir. (a+)+ gibi iç içe niceleyiciler sık görülen bir nedendir; daha belirgin bir desen deneyin.',
    'notice.failedTitle': 'Eşleştirici çalışamadı',
    'text.label': 'Test metni',
    'text.placeholder': 'Denenecek metni yazın ya da yapıştırın…',
    'legend.label': 'Renk anahtarı',
    'legend.match': 'eşleşme',
    'results.label': 'Sonuçlar',
    'tab.matches': 'Eşleşmeler',
    'tab.replace': 'Değiştir',
    'tab.split': 'Böl',
    'match.range': 'konum {start}–{end}',
    'match.groupRange': '{start}–{end}',
    'value.empty': 'boş',
    'group.unset': 'katılmadı',
    'matches.none': 'Eşleşme yok. Deseni, bayrakları ya da metni değiştirin.',
    'matches.more.one': '{count} eşleşme daha vurgulandı ama listelenmedi.',
    'matches.more.other': '{count} eşleşme daha vurgulandı ama listelenmedi.',
    'replace.label': 'Yerine konacak metin',
    'replace.placeholder': 'ör. $1 ya da $<ad>',
    'replace.insert': 'Ekle',
    'replace.output': 'Sonuç',
    'replace.count.one': '{count} değiştirme',
    'replace.count.other': '{count} değiştirme',
    'replace.copy': 'Kopyala',
    'split.title': 'Parçalar',
    'split.count.one': '{count} parça',
    'split.count.other': '{count} parça',
    'split.capture': 'yakalanan',
    'split.unset': 'grup katılmadı',
    'explain.title': 'Açıklama',
    'explain.hint': 'Desende bulmak için bir parçanın üzerine gelin ya da dokunun.',
    'explain.empty': 'Her parçanın açıklamasını görmek için bir desen yazın.',
    'explain.close': 'Açıklamayı kapat',
    'cheats.title': 'Hızlı başvuru',
    'cheats.hint': 'Desene eklemek için bir öğeye dokunun. Bayraklar açılıp kapanır.',
    'cheats.close': 'Hızlı başvuruyu kapat',
    'examples.title': 'Örnek kütüphanesi',
    'examples.hint': 'Her örnek, eşleşmesi gereken ve gerekmeyen satırlarla birlikte bir desen yükler.',
    'examples.close': 'Örnek kütüphanesini kapat',
    'toast.copied': 'Bağlantı panoya kopyalandı.',
    'toast.copyFailed': 'Kopyalanamadı. Bağlantı adres çubuğunda.',
    'toast.outputCopied': 'Sonuç panoya kopyalandı.',
    'toast.outputCopyFailed': 'Sonuç kopyalanamadı.',
    'toast.reset': 'Başlangıç örneğine dönüldü.',
    'toast.example': 'Yüklendi: {name}',
    'toast.inserted': '{syntax} eklendi',
    'toast.flagOn': '{flag} bayrağı açık',
    'toast.flagOff': '{flag} bayrağı kapalı',
    'footer.source': 'Kaynak kodu GitHub’da',
  }),
});

/**
 * Returns a supported language code; anything else falls back to English.
 * @param {unknown} value
 * @returns {'en'|'tr'}
 */
export function normalizeLang(value) {
  return LANGS.includes(value) ? value : LANGS[0];
}

/**
 * The language the toggle button switches to.
 * @param {string} lang
 * @returns {'en'|'tr'}
 */
export function otherLang(lang) {
  return normalizeLang(lang) === 'en' ? 'tr' : 'en';
}

/**
 * Looks up a string and fills in its {placeholders}. A key missing in Turkish falls
 * back to English, and an unknown key to the key itself, so nothing shows "undefined".
 * @param {string} lang
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const template = STRINGS[normalizeLang(lang)][key] ?? STRINGS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (whole, name) => (Object.hasOwn(params, name) ? String(params[name]) : whole));
}

/**
 * Picks the singular ("<key>.one") or plural ("<key>.other") form for a count.
 * @param {string} lang
 * @param {string} key   base key without the .one / .other suffix
 * @param {number} count also passed to the string as {count}
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function translateCount(lang, key, count, params = {}) {
  return translate(lang, `${key}.${count === 1 ? 'one' : 'other'}`, { ...params, count });
}
