/**
 * DOM rendering for the editor mirrors, the result tabs, the colour key and the
 * explanation list. Each render function rebuilds its container from data; the paint
 * functions only switch classes, so hovering never re-creates the hovered element.
 *
 * @typedef {import('./tokenizer.js').Token} Token
 * @typedef {import('./regex.js').MatchResult} MatchResult
 * @typedef {import('./regex.js').Segment} Segment
 * @typedef {(key: string, params?: object) => string} Translate
 */
import { h } from './dom.js';
import { groupColor, visibleRuns } from './view.js';

/** Keeps a trailing line break visible in a mirror, as the textarea shows it. */
const MIRROR_END = '​';

/**
 * Paints the pattern behind its transparent textarea: one coloured span per token.
 * @param {HTMLElement} mirror
 * @param {string} pattern
 * @param {Token[]} tokens
 * @param {{ main: Set<number>, related: Set<number> }} focus
 */
export function renderPatternMirror(mirror, pattern, tokens, focus) {
  const nodes = [];
  let last = 0;
  tokens.forEach((token, index) => {
    if (token.start > last) nodes.push(pattern.slice(last, token.start));
    nodes.push(h('span', { className: `tok tok-${token.type}`, dataset: { index: String(index) } }, [pattern.slice(token.start, token.end)]));
    last = token.end;
  });
  if (last < pattern.length) nodes.push(pattern.slice(last));
  mirror.replaceChildren(...nodes, MIRROR_END);
  paintTokenFocus([mirror], focus);
}

/**
 * Paints the test text behind its textarea with every match and group marked.
 * @param {HTMLElement} mirror
 * @param {string} text
 * @param {MatchResult[]} matches
 * @param {Segment[]} segments  from highlightSegments
 */
export function renderTextMirror(mirror, text, matches, segments) {
  const nodes = segments.map((segment) =>
    segment.match === null ? text.slice(segment.start, segment.end) : matchMark(text, segment, matches[segment.match]),
  );
  mirror.replaceChildren(...nodes, MIRROR_END);
}

function matchMark(text, segment, match) {
  const classes = ['hl', segment.match % 2 ? 'hl-alt' : 'hl-main'];
  if (segment.group !== null) classes.push(`hl-g${groupColor(segment.group)}`);
  if (segment.start === segment.end) classes.push('hl-empty');
  if (segment.start === match.index) classes.push('hl-first');
  if (segment.end === match.end) classes.push('hl-last');
  const value = text.slice(segment.start, segment.end);
  return h('mark', { className: classes.join(' '), dataset: { match: String(segment.match) } }, [value]);
}

/**
 * The colour key above the test text: whole match plus one swatch per group.
 * @param {HTMLElement} list
 * @param {(string|null)[]|null} groupNames  null hides the key
 * @param {Translate} t
 */
export function renderLegend(list, groupNames, t) {
  list.hidden = groupNames === null;
  if (groupNames === null) return;
  const items = [h('li', { className: 'legend-item legend-match' }, [t('legend.match')])];
  groupNames.forEach((name, k) => {
    items.push(h('li', { className: `legend-item g${groupColor(k + 1)}` }, [name ?? `#${k + 1}`]));
  });
  list.replaceChildren(...items);
}

/**
 * The match list: number, value and position of each match, then its groups.
 * @param {HTMLElement} list
 * @param {MatchResult[]} matches  already capped by the caller
 * @param {Translate} t
 */
export function renderMatchList(list, matches, t) {
  list.replaceChildren(...matches.map((match, k) => h('li', {}, [matchCard(match, k, t)])));
}

function matchCard(match, k, t) {
  const top = h('span', { className: 'match-top' }, [
    h('span', { className: 'match-no', text: String(k + 1) }),
    valueNode('match-value', match.value, t),
    h('span', { className: 'match-range', text: t('match.range', { start: match.index, end: match.end }) }),
  ]);
  const groups = match.groups.length === 0 ? null : h('span', { className: 'match-groups' }, match.groups.map((group) => groupChip(group, t)));
  return h('button', { type: 'button', className: 'match', dataset: { match: String(k) }, 'aria-pressed': 'false' }, [top, groups]);
}

function groupChip(group, t) {
  const unset = group.value === null;
  return h('span', { className: `group-chip g${groupColor(group.number)}${unset ? ' is-unset' : ''}` }, [
    h('span', { className: 'group-no', text: String(group.number) }),
    group.name === null ? null : h('span', { className: 'group-name', text: group.name }),
    unset ? h('span', { className: 'group-value', text: t('group.unset') }) : valueNode('group-value', group.value, t),
    unset ? null : h('span', { className: 'group-range', text: t('match.groupRange', { start: group.start, end: group.end }) }),
  ]);
}

/**
 * A value shown on one line: line breaks and tabs become dimmed symbols, and an empty
 * string says so instead of showing nothing.
 */
function valueNode(className, value, t) {
  if (value === '') return h('span', { className: `${className} is-empty`, text: t('value.empty') });
  const runs = visibleRuns(value).map((run) => (run.special ? h('span', { className: 'special', text: run.text }) : run.text));
  return h('code', { className }, runs);
}

/**
 * The replace preview: unchanged text plus the replacements, which are marked.
 * @param {HTMLElement} output
 * @param {{ text: string, replaced: boolean }[]} segments
 */
export function renderReplaceOutput(output, segments) {
  const nodes = segments.map((segment) => {
    if (!segment.replaced) return segment.text;
    return h('mark', { className: segment.text === '' ? 'rep is-empty' : 'rep' }, [segment.text]);
  });
  output.replaceChildren(...nodes, MIRROR_END);
}

/**
 * The split preview: one row per part; separators captured by groups are tagged, and
 * the undefined part of a group that did not take part says so in words.
 * @param {HTMLElement} list
 * @param {{ value: string|null, capture: boolean }[]} parts
 * @param {Translate} t
 */
export function renderSplitParts(list, parts, t) {
  list.replaceChildren(
    ...parts.map((part, k) => {
      const unset = part.value === null;
      return h('li', { className: part.capture ? 'part is-capture' : 'part' }, [
        h('span', { className: 'part-no', text: String(k) }),
        unset ? unsetPartValue(t) : valueNode('part-value', part.value, t),
        part.capture && !unset ? h('span', { className: 'part-tag', text: t('split.capture') }) : null,
      ]);
    }),
  );
}

/** The JavaScript value (undefined) followed by a plain-language note. */
function unsetPartValue(t) {
  return h('span', { className: 'part-value' }, [
    h('code', { className: 'part-undefined', text: 'undefined' }),
    ' ',
    h('span', { className: 'part-note', text: t('split.unset') }),
  ]);
}

/**
 * The explanation list: each token's pattern text next to its description, indented
 * by how many groups enclose it.
 * @param {HTMLElement} list
 * @param {Array<Token & { text: string }>} tokens
 * @param {{ main: Set<number>, related: Set<number> }} focus
 * @param {number|null} pinned  the token tapped or clicked last
 */
export function renderTokenList(list, tokens, focus, pinned) {
  list.replaceChildren(
    ...tokens.map((token, index) =>
      h('li', {}, [
        h(
          'button',
          {
            type: 'button',
            className: 'token-row',
            dataset: { index: String(index) },
            style: { '--depth': String(Math.min(token.depth, 4)) },
            'aria-pressed': String(index === pinned),
          },
          [h('code', { className: `tok tok-${token.type}`, text: token.raw }), h('span', { className: 'token-text', text: token.text })],
        ),
      ]),
    ),
  );
  paintTokenFocus([list], focus);
}

/**
 * Marks the focused token and its partners wherever tokens are shown.
 * @param {HTMLElement[]} containers
 * @param {{ main: Set<number>, related: Set<number> }} focus
 */
export function paintTokenFocus(containers, focus) {
  for (const container of containers) {
    for (const node of container.querySelectorAll('[data-index]')) {
      const index = Number(node.dataset.index);
      node.classList.toggle('is-hot', focus.main.has(index));
      node.classList.toggle('is-related', focus.related.has(index));
    }
  }
}

/**
 * Shows which token is pinned (for screen readers and the pressed style).
 * @param {HTMLElement} list
 * @param {number|null} pinned
 */
export function paintPinnedToken(list, pinned) {
  for (const row of list.querySelectorAll('.token-row')) row.setAttribute('aria-pressed', String(Number(row.dataset.index) === pinned));
}

/**
 * Marks one match in the text and in the list (hovered, focused or pinned).
 * @param {HTMLElement} mirror
 * @param {HTMLElement} list
 * @param {number|null} active
 * @param {number|null} pinned
 */
export function paintActiveMatch(mirror, list, active, pinned) {
  for (const mark of mirror.querySelectorAll('mark')) mark.classList.toggle('is-active', Number(mark.dataset.match) === active);
  for (const card of list.querySelectorAll('.match')) {
    const k = Number(card.dataset.match);
    card.classList.toggle('is-active', k === active);
    card.setAttribute('aria-pressed', String(k === pinned));
  }
}
