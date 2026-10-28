/**
 * Example library: ready-made patterns with texts that should and should not match.
 * Pure data, no DOM. Every pattern is anchored with ^ and $ and uses the m flag, so
 * loading an example tests each line of its text on its own.
 *
 * @typedef {object} Example
 * @property {string} id
 * @property {{ en: string, tr: string }} name
 * @property {{ en: string, tr: string }} note
 * @property {string} pattern
 * @property {string} flags
 * @property {string} replacement   a template that shows off the groups in the Replace tab
 * @property {string[]} samples          lines the pattern must match
 * @property {string[]} counterExamples  lines the pattern must reject
 */

/** @type {readonly Example[]} */
export const EXAMPLES = Object.freeze([
  {
    id: 'email',
    name: { en: 'Email-like address', tr: 'E-posta benzeri adres' },
    note: {
      en: 'A practical approximation; the full RFC 5322 grammar allows much more.',
      tr: 'Pratik bir yaklaşım; RFC 5322’nin tam dilbilgisi çok daha fazlasına izin verir.',
    },
    pattern: '^(?<user>[\\w.+-]+)@(?<domain>[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]{2,})$',
    flags: 'gm',
    replacement: '$<user> [at] $<domain>',
    samples: ['ali.veli@example.com', 'test+tag@mail.example.org', 'info@sub-domain.example.net', 'a_b@example.io'],
    counterExamples: ['ali@', '@example.com', 'ali veli@example.com', 'ali@example', 'ali@@example.com', 'ali@example.c'],
  },
  {
    id: 'url',
    name: { en: 'Web address (http/https)', tr: 'Web adresi (http/https)' },
    note: {
      en: 'Needs a dot in the host name, so localhost is rejected.',
      tr: 'Alan adında nokta ister, bu yüzden localhost reddedilir.',
    },
    pattern: '^(?<scheme>https?)://(?<host>(?:[\\w-]+\\.)+[a-z]{2,})(?::(?<port>\\d{2,5}))?(?<path>/\\S*)?$',
    flags: 'gim',
    replacement: '$<host>',
    samples: [
      'https://example.com',
      'http://www.example.org/path/to/page',
      'https://sub.example.com.tr:8080/search?q=regex#top',
      'https://celaldrg.github.io/regex-tester/',
    ],
    counterExamples: ['ftp://example.com', 'https://', 'example.com', 'https://exa mple.com', 'http//example.com', 'https://localhost'],
  },
  {
    id: 'phone-tr',
    name: { en: 'Turkish mobile number', tr: 'Türkiye cep telefonu' },
    note: {
      en: 'Accepts +90, 0 or no prefix with spaces, dashes or brackets; the replacement writes every number the same way.',
      tr: '+90, 0 ya da öneksiz yazımı; boşluk, tire ve parantezi kabul eder. Değiştirme her numarayı aynı biçime getirir.',
    },
    pattern: '^(?:(?:\\+90|0)[ -]?)?\\(?(5\\d{2})\\)?[ -]?(\\d{3})[ -]?(\\d{2})[ -]?(\\d{2})$',
    flags: 'gm',
    replacement: '+90 $1 $2 $3 $4',
    samples: ['0532 123 45 67', '+90 555 123 45 67', '05321234567', '5321234567', '+90 (532) 123-45-67', '0 (505) 987 65 43'],
    counterExamples: ['0212 123 45 67', '0532 123 45 6', '+91 532 123 45 67', '0532 123 45 678', '05321234', '532.123.45.67'],
  },
  {
    id: 'iban-tr',
    name: { en: 'Turkish IBAN (format)', tr: 'TR IBAN (biçim)' },
    note: {
      en: 'Checks the shape only (TR plus 24 digits, spaces optional), not the mod-97 checksum.',
      tr: 'Yalnız biçimi denetler (TR ve 24 rakam, boşluklar isteğe bağlı); mod-97 sağlamasını denetlemez.',
    },
    pattern: '^TR(?<check>\\d{2}) ?(?:\\d{4} ?){5}\\d{2}$',
    flags: 'gm',
    replacement: 'TR$<check> **** **** **** **** **** **',
    samples: ['TR12 0006 4000 0011 2345 6789 01', 'TR120006400000112345678901', 'TR56 0001 0017 4512 3456 7890 12'],
    counterExamples: [
      'TR12 0006 4000 0011 2345 6789 0',
      'TR12 0006 4000 0011 2345 6789 012',
      'DE89 3704 0044 0532 0130 00',
      'TR1A 0006 4000 0011 2345 6789 01',
      'tr12 0006 4000 0011 2345 6789 01',
    ],
  },
  {
    id: 'iso-date',
    name: { en: 'Date (YYYY-MM-DD)', tr: 'Tarih (YYYY-AA-GG)' },
    note: {
      en: 'Checks month 01–12 and day 01–31, not how many days a month has. The replacement turns it into DD.MM.YYYY.',
      tr: 'Ayı 01–12, günü 01–31 olarak denetler; ayın kaç gün çektiğine bakmaz. Değiştirme GG.AA.YYYY biçimine çevirir.',
    },
    pattern: '^(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])$',
    flags: 'gm',
    replacement: '$<day>.$<month>.$<year>',
    samples: ['2026-10-28', '1999-01-01', '2024-02-29', '2000-12-31'],
    counterExamples: ['2026-13-01', '2026-00-10', '2026-10-32', '26-10-28', '2026/10/28', '2026-1-5'],
  },
  {
    id: 'hex-color',
    name: { en: 'Hex color', tr: 'Onaltılık renk kodu' },
    note: {
      en: '3, 4, 6 or 8 hex digits after #, in any case.',
      tr: '# işaretinden sonra 3, 4, 6 ya da 8 onaltılık hane; büyük/küçük harf fark etmez.',
    },
    pattern: '^#(?<hex>[\\da-f]{3,4}|[\\da-f]{6}|[\\da-f]{8})$',
    flags: 'gim',
    replacement: '0x$<hex>',
    samples: ['#c4b5fd', '#FFF', '#0f172a', '#1e293bcc', '#abcd'],
    counterExamples: ['#ggg', 'c4b5fd', '#12345', '#1234567', '#', '# fff'],
  },
  {
    id: 'capitalized',
    name: { en: 'Capitalized word (any alphabet)', tr: 'Büyük harfle başlayan kelime (her alfabe)' },
    note: {
      en: 'Uses \\p{Lu} and \\p{Ll} with the u flag, so İ, Ç, Ş and Ü work; \\w would not.',
      tr: 'u bayrağıyla \\p{Lu} ve \\p{Ll} kullanır; İ, Ç, Ş ve Ü sorunsuz çalışır, \\w ise çalışmazdı.',
    },
    pattern: '^\\p{Lu}\\p{Ll}+$',
    flags: 'gmu',
    replacement: '«$&»',
    samples: ['İstanbul', 'Çanakkale', 'Ömer', 'Şile', 'Zürich'],
    counterExamples: ['istanbul', 'İSTANBUL', 'Ankara1', 'New York', 'Ç'],
  },
]);

/**
 * Looks up an example by id.
 * @param {string} id
 * @returns {Example|undefined}
 */
export function findExample(id) {
  return EXAMPLES.find((example) => example.id === id);
}

/**
 * The test text for an example: samples and counter-examples interleaved, one per line.
 * @param {Example} example
 * @returns {string}
 */
export function exampleText(example) {
  const lines = [];
  const rows = Math.max(example.samples.length, example.counterExamples.length);
  for (let k = 0; k < rows; k++) {
    if (k < example.samples.length) lines.push(example.samples[k]);
    if (k < example.counterExamples.length) lines.push(example.counterExamples[k]);
  }
  return lines.join('\n');
}
