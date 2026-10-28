/**
 * Regex Tester UI: connects the page to the pure modules.
 *
 * Whatever the user types or opens from a share link is analysed in a module worker
 * with a 500 ms limit (runner.js), so a catastrophic pattern cannot freeze the page.
 * The shipped states (start, ?demo and library examples) are known to be fast and are
 * analysed right away on the main thread.
 */
import { FLAGS, analyze, highlightSegments, sanitizeFlags } from './regex.js';
import { captureNames } from './tokenizer.js';
import { describeError, explain } from './explain.js';
import { FLAG_INFO } from './cheatsheet.js';
import { findExample } from './library.js';
import { createRunner } from './runner.js';
import {
  TABS,
  applyExample,
  createDemoState,
  createState,
  decodeHash,
  encodeHash,
  isBuiltIn,
  isDefaultShare,
  toRequest,
  toggleStateFlag,
  updateState,
} from './state.js';
import { normalizeLang, otherLang, translate, translateCount } from './i18n.js';
import { storage } from './storage.js';
import { LIST_LIMIT, activeExample, summarize, tokenFocus } from './view.js';
import { arrowNavigation, autoGrow, byId, h, insertAtCaret } from './dom.js';
import {
  paintActiveMatch,
  paintPinnedToken,
  paintTokenFocus,
  renderLegend,
  renderMatchList,
  renderPatternMirror,
  renderReplaceOutput,
  renderSplitParts,
  renderTextMirror,
  renderTokenList,
} from './render.js';
import { renderCheatSheet, renderExamples, setupDialog } from './panels.js';

/** Flag buttons in everyday order: d (indices) last. */
const FLAG_ORDER = [...FLAGS.filter((flag) => flag !== 'd'), 'd'];
const HASH_DELAY_MS = 400;
const STALE_DELAY_MS = 150;
const TOAST_MS = 2400;
const INSERT_CHIP_LIMIT = 9;

const ui = {
  layout: byId('layout'),
  shareBtn: byId('share-btn'),
  resetBtn: byId('reset-btn'),
  langBtn: byId('lang-btn'),
  patternShell: byId('pattern-shell'),
  pattern: byId('pattern-input'),
  patternMirror: byId('pattern-mirror'),
  flagEcho: byId('flag-echo'),
  flagList: byId('flag-list'),
  status: byId('status'),
  statusText: byId('status-text'),
  explainBtn: byId('explain-btn'),
  examplesBtn: byId('examples-btn'),
  cheatsBtn: byId('cheats-btn'),
  explainPanel: byId('explain-panel'),
  explainClose: byId('explain-close'),
  tokenList: byId('token-list'),
  tokensEmpty: byId('tokens-empty'),
  text: byId('text-input'),
  textMirror: byId('text-mirror'),
  legend: byId('legend'),
  exampleNote: byId('example-note'),
  resultsCard: byId('results-card'),
  tabs: byId('tabs'),
  matchBadge: byId('match-badge'),
  notice: byId('notice'),
  noticeTitle: byId('notice-title'),
  noticeBody: byId('notice-body'),
  matchList: byId('match-list'),
  matchesEmpty: byId('matches-empty'),
  matchesMore: byId('matches-more'),
  replaceInput: byId('replace-input'),
  insertChips: byId('insert-chips'),
  replaceCount: byId('replace-count'),
  replaceOutput: byId('replace-output'),
  copyOutput: byId('copy-output'),
  splitCount: byId('split-count'),
  partList: byId('part-list'),
  examplesDialog: byId('examples-dialog'),
  exampleList: byId('example-list'),
  cheatsDialog: byId('cheats-dialog'),
  cheatSections: byId('cheat-sections'),
  toast: byId('toast'),
};

const runner = createRunner({ spawn: () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) });
const shared = decodeHash(location.hash);
const isDemo = !shared && new URLSearchParams(location.search).has('demo');

let lang = normalizeLang(storage.get('lang', null));
let state = initialState();
let tokens = [];
let outcome = null;
let shownRequest = null;
let lastRequestKey = '';
let analysisSeq = 0;
let hoveredToken = null;
let pinnedToken = null;
let hoveredMatch = null;
let pinnedMatch = null;
let staleTimer = 0;
let hashTimer = 0;
let toastTimer = 0;

const t = (key, params) => translate(lang, key, params);
const tc = (key, count, params) => translateCount(lang, key, count, params);

start();

function initialState() {
  const explainOpen = storage.get('explainOpen', false) === true;
  if (shared) return createState({ ...shared, explainOpen });
  if (isDemo) return createDemoState();
  return createState({ explainOpen });
}

function start() {
  buildFlagButtons();
  wireEvents();
  setInputs(state);
  renderTabs();
  renderExplainOpen();
  applyLanguage();
  analyseState();
  if (isDemo) togglePinnedToken(tokens.findIndex((token) => token.type === 'group' && token.name === 'month'));
  warmUpWorker();
}

/* ---------- state changes ---------- */

/** Applies a new state and refreshes whatever depends on the fields that changed. */
function commit(next) {
  const before = state;
  state = next;
  if (next.pattern !== before.pattern || next.flags !== before.flags) {
    hoveredToken = null;
    pinnedToken = null;
    refreshPattern();
  }
  if (next.text !== before.text) renderMirror();
  if (next.tab !== before.tab) renderTabs();
  if (next.explainOpen !== before.explainOpen) renderExplainOpen();
  analyseState();
  scheduleHashWrite();
}

function change(patch) {
  commit(updateState(state, patch));
}

/** Replaces the whole state from outside the inputs (example, reset, share link). */
function load(next) {
  setInputs(next);
  commit(next);
  growFields();
}

function setInputs(next) {
  if (ui.pattern.value !== next.pattern) ui.pattern.value = next.pattern;
  if (ui.text.value !== next.text) ui.text.value = next.text;
  if (ui.replaceInput.value !== next.replacement) ui.replaceInput.value = next.replacement;
  growFields();
}

function growFields() {
  autoGrow(ui.pattern);
  autoGrow(ui.text);
}

/* ---------- analysis ---------- */

function analyseState() {
  const request = toRequest(state);
  const key = JSON.stringify(request);
  if (key === lastRequestKey) return;
  lastRequestKey = key;
  const seq = ++analysisSeq;
  clearTimeout(staleTimer);
  if (isBuiltIn(state)) {
    showOutcome({ status: 'done', result: analyze(request) }, request);
    return;
  }
  staleTimer = setTimeout(showPending, STALE_DELAY_MS);
  runner.run(request).then((next) => {
    if (seq === analysisSeq && next.status !== 'superseded') showOutcome(next, request);
  });
}

/** Starts the worker early, so the first edit of a shipped state does not wait for it. */
function warmUpWorker() {
  if (isBuiltIn(state)) runner.run({ pattern: '' });
}

function showPending() {
  outcome = null;
  renderResults();
}

function showOutcome(next, request) {
  clearTimeout(staleTimer);
  outcome = next;
  shownRequest = request;
  hoveredMatch = null;
  pinnedMatch = null;
  renderResults();
}

/** The analysis result that belongs to the text on screen, or null. */
function currentResult() {
  const fresh = outcome?.status === 'done' && outcome.result.ok && shownRequest.text === state.text;
  return fresh ? outcome.result : null;
}

/* ---------- rendering ---------- */

function applyLanguage() {
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-placeholder]')) node.placeholder = t(node.dataset.i18nPlaceholder);
  for (const node of document.querySelectorAll('[data-i18n-label]')) node.setAttribute('aria-label', t(node.dataset.i18nLabel));
  for (const button of ui.flagList.querySelectorAll('[data-flag]')) button.title = FLAG_INFO[button.dataset.flag][lang];
  renderCheatSheet(ui.cheatSections, lang);
  renderExamples(ui.exampleList, lang, activeExample(state)?.id);
  refreshPattern();
  renderResults();
}

function buildFlagButtons() {
  ui.flagList.replaceChildren(
    ...FLAG_ORDER.map((flag) =>
      h('button', { type: 'button', className: 'flag', dataset: { flag }, 'aria-pressed': 'false' }, [
        h('span', { className: 'flag-key', text: flag }),
        h('span', { className: 'flag-name', dataset: { i18n: `flag.${flag}` } }),
      ]),
    ),
  );
}

/** Everything that depends on pattern, flags or language, but not on the analysis. */
function refreshPattern() {
  tokens = explain(state.pattern, state.flags, lang);
  const focus = currentTokenFocus();
  renderPatternMirror(ui.patternMirror, state.pattern, tokens, focus);
  renderTokenList(ui.tokenList, tokens, focus, pinnedToken);
  ui.tokensEmpty.hidden = tokens.length > 0;
  ui.flagEcho.textContent = state.flags;
  for (const button of ui.flagList.querySelectorAll('[data-flag]')) {
    button.setAttribute('aria-pressed', String(state.flags.includes(button.dataset.flag)));
  }
  renderInsertChips();
  renderExampleNote();
  autoGrow(ui.pattern);
}

function renderInsertChips() {
  const names = captureNames(state.pattern).slice(0, INSERT_CHIP_LIMIT);
  const snippets = ['$&', ...names.map((name, k) => (name === null ? `$${k + 1}` : `$<${name}>`))];
  ui.insertChips.replaceChildren(
    ...snippets.map((snippet) => h('button', { type: 'button', className: 'chip', dataset: { insert: snippet }, text: snippet })),
  );
}

function renderExampleNote() {
  const example = activeExample(state);
  ui.exampleNote.hidden = !example;
  if (example) ui.exampleNote.replaceChildren(h('strong', { text: example.name[lang] }), ` · ${example.note[lang]}`);
}

function renderTabs() {
  for (const name of TABS) {
    const selected = name === state.tab;
    const tab = byId(`tab-${name}`);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    byId(`panel-${name}`).hidden = !selected;
  }
}

function renderExplainOpen() {
  ui.explainPanel.hidden = !state.explainOpen;
  ui.layout.classList.toggle('has-explain', state.explainOpen);
  ui.explainBtn.setAttribute('aria-expanded', String(state.explainOpen));
  growFields();
}

function renderResults() {
  const summary = summarize(shownRequest?.flags ?? state.flags, outcome);
  renderStatus(summary);
  renderNotice(summary);
  ui.patternShell.classList.toggle('is-invalid', summary.kind === 'error');
  ui.resultsCard.classList.toggle('is-pending', summary.kind === 'pending');
  renderMirror();
  if (summary.kind === 'pending') return;
  const result = currentResult();
  renderLegend(ui.legend, result && !result.empty ? result.groupNames : null, t);
  renderMatchesPanel(result, summary);
  renderReplacePanel(result);
  renderSplitPanel(result);
}

/** Highlights the test text only with a result computed for exactly this text. */
function renderMirror() {
  const result = currentResult();
  if (result) renderTextMirror(ui.textMirror, state.text, result.matches, result.segments);
  else renderTextMirror(ui.textMirror, state.text, [], highlightSegments(state.text, []));
}

function renderStatus(summary) {
  ui.status.className = `status is-${summary.kind}`;
  ui.status.classList.toggle('is-none', summary.kind === 'ok' && summary.count === 0);
  ui.statusText.textContent = statusText(summary);
}

function statusText(summary) {
  switch (summary.kind) {
    case 'pending':
      return t('status.pending');
    case 'empty':
      return t('status.empty');
    case 'timeout':
      return t('status.timeout', { ms: summary.ms });
    case 'failed':
      return t('status.failed', { message: summary.message });
    case 'error':
      return t('status.error', { message: describeError(summary.error, lang) });
    default:
      return okStatus(summary);
  }
}

function okStatus({ count, groups, truncated, firstOnly }) {
  const parts = [count === 0 ? t('status.none') : tc('status.matches', count)];
  if (groups > 0) parts.push(tc('status.groups', groups));
  if (truncated) parts.push(t('status.truncated', { count }));
  if (firstOnly) parts.push(t('status.firstOnly'));
  return parts.join(' · ');
}

function renderNotice(summary) {
  const content = noticeContent(summary);
  ui.notice.hidden = content === null;
  if (content === null) return;
  ui.notice.className = `notice is-${summary.kind}`;
  ui.noticeTitle.textContent = content.title;
  ui.noticeBody.textContent = content.body;
}

function noticeContent(summary) {
  if (summary.kind === 'timeout') return { title: t('notice.timeoutTitle', { ms: summary.ms }), body: t('notice.timeoutBody') };
  if (summary.kind === 'failed') return { title: t('notice.failedTitle'), body: summary.message };
  if (summary.kind === 'error') return { title: t('notice.errorTitle'), body: describeError(summary.error, lang) };
  return null;
}

function renderMatchesPanel(result, summary) {
  const matches = result ? result.matches : [];
  ui.matchBadge.textContent = result ? `${matches.length}${result.truncated ? '+' : ''}` : '–';
  renderMatchList(ui.matchList, matches.slice(0, LIST_LIMIT), t);
  ui.matchesEmpty.hidden = !result || matches.length > 0;
  ui.matchesEmpty.textContent = summary.kind === 'empty' ? t('status.empty') : t('matches.none');
  const unlisted = matches.length - LIST_LIMIT;
  ui.matchesMore.hidden = unlisted <= 0;
  if (unlisted > 0) ui.matchesMore.textContent = tc('matches.more', unlisted);
}

function renderReplacePanel(result) {
  const replace = result?.replace ?? null;
  ui.replaceCount.textContent = replace ? tc('replace.count', replace.count) : '';
  renderReplaceOutput(ui.replaceOutput, replace ? replace.segments : []);
  ui.copyOutput.disabled = replace === null;
}

function renderSplitPanel(result) {
  const split = result?.split ?? null;
  ui.splitCount.textContent = split ? tc('split.count', split.parts.length) + (split.truncated ? '+' : '') : '';
  renderSplitParts(ui.partList, split ? split.parts.slice(0, LIST_LIMIT) : [], t);
}

/* ---------- token and match highlighting ---------- */

function currentTokenFocus() {
  return tokenFocus(tokens, hoveredToken ?? pinnedToken);
}

function paintTokens() {
  paintTokenFocus([ui.patternMirror, ui.tokenList], currentTokenFocus());
}

function setHoveredToken(index) {
  if (hoveredToken === index) return;
  hoveredToken = index;
  paintTokens();
}

function togglePinnedToken(index) {
  pinnedToken = pinnedToken === index || index < 0 ? null : index;
  paintPinnedToken(ui.tokenList, pinnedToken);
  paintTokens();
}

function paintMatches() {
  paintActiveMatch(ui.textMirror, ui.matchList, hoveredMatch ?? pinnedMatch, pinnedMatch);
}

function setHoveredMatch(k) {
  if (hoveredMatch === k) return;
  hoveredMatch = k;
  paintMatches();
}

function togglePinnedMatch(k) {
  pinnedMatch = pinnedMatch === k ? null : k;
  paintMatches();
  if (pinnedMatch !== null) revealMatch(k);
}

/** Scrolls the page (never the mirror itself) so the pinned match is on screen. */
function revealMatch(k) {
  const mark = ui.textMirror.querySelector(`mark[data-match="${k}"]`);
  if (!mark) return;
  const box = mark.getBoundingClientRect();
  if (box.top >= 0 && box.bottom <= window.innerHeight) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollBy({ top: box.top - window.innerHeight / 3, behavior: reduce ? 'auto' : 'smooth' });
}

/**
 * Hovering an item with a mouse, or focusing it with the keyboard, previews it;
 * a click or a tap pins it (a second one unpins it).
 */
function wireHover(list, selector, key, onPreview, onPin) {
  const indexOf = (item) => (item ? Number(item.dataset[key]) : null);
  list.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'mouse') onPreview(indexOf(event.target.closest(selector)));
  });
  list.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') onPreview(null);
  });
  list.addEventListener('focusin', (event) => {
    const item = event.target.closest(selector);
    if (item?.matches(':focus-visible')) onPreview(indexOf(item));
  });
  list.addEventListener('focusout', () => onPreview(null));
  list.addEventListener('click', (event) => {
    const item = event.target.closest(selector);
    if (item) onPin(indexOf(item));
  });
}

/* ---------- events ---------- */

function wireEvents() {
  ui.pattern.addEventListener('input', onPatternInput);
  ui.pattern.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault();
  });
  ui.text.addEventListener('input', () => {
    autoGrow(ui.text);
    change({ text: ui.text.value });
  });
  ui.replaceInput.addEventListener('input', () => change({ replacement: ui.replaceInput.value }));
  ui.flagList.addEventListener('click', onFlagClick);
  ui.tabs.addEventListener('click', onTabClick);
  ui.tabs.addEventListener('keydown', onTabKey);
  ui.explainBtn.addEventListener('click', () => setExplainOpen(!state.explainOpen));
  ui.explainClose.addEventListener('click', () => {
    setExplainOpen(false);
    ui.explainBtn.focus();
  });
  ui.examplesBtn.addEventListener('click', openExamples);
  ui.exampleList.addEventListener('click', onExampleClick);
  ui.cheatsBtn.addEventListener('click', () => setCheatsOpen(true));
  ui.cheatSections.addEventListener('click', onCheatClick);
  setupDialog(ui.examplesDialog, () => ui.examplesBtn.focus());
  setupDialog(ui.cheatsDialog, () => setCheatsOpen(false));
  ui.insertChips.addEventListener('click', onInsertChip);
  ui.copyOutput.addEventListener('click', copyOutput);
  ui.shareBtn.addEventListener('click', share);
  ui.resetBtn.addEventListener('click', reset);
  ui.langBtn.addEventListener('click', toggleLanguage);
  wireHover(ui.tokenList, '.token-row', 'index', setHoveredToken, togglePinnedToken);
  wireHover(ui.matchList, '.match', 'match', setHoveredMatch, togglePinnedMatch);
  arrowNavigation(ui.tokenList, '.token-row');
  arrowNavigation(ui.matchList, '.match');
  arrowNavigation(ui.exampleList, '.example-item');
  arrowNavigation(ui.cheatSections, '.cheat-item');
  document.addEventListener('keydown', onGlobalKey);
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('resize', growFields);
}

function onPatternInput() {
  const { value, selectionStart } = ui.pattern;
  const clean = value.replace(/[\r\n]+/g, '');
  if (clean !== value) {
    const caret = value.slice(0, selectionStart).replace(/[\r\n]+/g, '').length;
    ui.pattern.value = clean;
    ui.pattern.setSelectionRange(caret, caret);
  }
  change({ pattern: clean });
}

function onFlagClick(event) {
  const button = event.target.closest('[data-flag]');
  if (button) commit(toggleStateFlag(state, button.dataset.flag));
}

function onTabClick(event) {
  const tab = event.target.closest('[role="tab"]');
  if (tab) change({ tab: tab.dataset.tab });
}

function onTabKey(event) {
  const steps = { ArrowRight: 1, ArrowLeft: -1 };
  let index = TABS.indexOf(state.tab);
  if (Object.hasOwn(steps, event.key)) index = (index + steps[event.key] + TABS.length) % TABS.length;
  else if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = TABS.length - 1;
  else return;
  event.preventDefault();
  change({ tab: TABS[index] });
  byId(`tab-${TABS[index]}`).focus();
}

function setExplainOpen(open) {
  storage.set('explainOpen', open);
  change({ explainOpen: open });
}

function openExamples() {
  renderExamples(ui.exampleList, lang, activeExample(state)?.id);
  ui.examplesDialog.showModal();
  const current = ui.exampleList.querySelector('[aria-current="true"]') ?? ui.exampleList.querySelector('.example-item');
  current.focus();
}

function onExampleClick(event) {
  const item = event.target.closest('.example-item');
  if (!item) return;
  const example = findExample(item.dataset.id);
  ui.examplesDialog.close();
  load(applyExample(state, example.id));
  toast(t('toast.example', { name: example.name[lang] }));
}

function setCheatsOpen(open) {
  if (open && !ui.cheatsDialog.open) {
    ui.cheatsDialog.showModal();
    ui.cheatsDialog.querySelector('[data-close]').focus();
  } else if (!open && ui.cheatsDialog.open) {
    ui.cheatsDialog.close();
  }
  if (state.cheatsOpen !== open) change({ cheatsOpen: open });
}

function onCheatClick(event) {
  const item = event.target.closest('.cheat-item');
  if (!item) return;
  const { kind, syntax, flags } = item.dataset;
  setCheatsOpen(false);
  if (kind === 'flag') {
    commit(toggleStateFlag(state, syntax));
    toast(t(state.flags.includes(syntax) ? 'toast.flagOn' : 'toast.flagOff', { flag: syntax }));
    return;
  }
  if (kind === 'replacement') {
    change({ tab: 'replace' });
    insertAtCaret(ui.replaceInput, syntax);
    change({ replacement: ui.replaceInput.value });
  } else {
    insertAtCaret(ui.pattern, syntax);
    change({ pattern: ui.pattern.value, flags: sanitizeFlags(state.flags + flags) });
  }
  toast(t('toast.inserted', { syntax }));
}

function onInsertChip(event) {
  const chip = event.target.closest('[data-insert]');
  if (!chip) return;
  insertAtCaret(ui.replaceInput, chip.dataset.insert);
  change({ replacement: ui.replaceInput.value });
}

async function copyOutput() {
  const output = currentResult()?.replace?.output;
  if (output === undefined) return;
  toast(t((await copyText(output)) ? 'toast.outputCopied' : 'toast.outputCopyFailed'));
}

async function share() {
  writeHash();
  const url = location.href;
  if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: document.title, url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  toast(t((await copyText(url)) ? 'toast.copied' : 'toast.copyFailed'));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function reset() {
  load(createState({ explainOpen: state.explainOpen }));
  writeHash();
  toast(t('toast.reset'));
}

function toggleLanguage() {
  lang = otherLang(lang);
  storage.set('lang', lang);
  applyLanguage();
}

function onGlobalKey(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if (document.querySelector('dialog[open]') || event.target.closest?.('input, textarea, select')) return;
  if (event.key === '/') {
    event.preventDefault();
    ui.pattern.focus();
  } else if (event.key === '?') {
    event.preventDefault();
    setCheatsOpen(true);
  }
}

function onHashChange() {
  const patch = decodeHash(location.hash);
  if (!patch) return;
  const next = createState({ ...patch, explainOpen: state.explainOpen });
  if (encodeHash(next) !== encodeHash(state)) load(next);
}

/* ---------- share link and toast ---------- */

function scheduleHashWrite() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(writeHash, HASH_DELAY_MS);
}

/** Keeps the address bar in step with the state; the start state needs no hash. */
function writeHash() {
  clearTimeout(hashTimer);
  const hash = isDefaultShare(state) ? '' : encodeHash(state);
  if (hash === location.hash) return;
  history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('is-visible'), TOAST_MS);
}
