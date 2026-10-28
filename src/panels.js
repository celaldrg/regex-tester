/**
 * The cheat sheet drawer and the example library: their content and the shared
 * behaviour of the native <dialog> elements that hold them.
 */
import { h } from './dom.js';
import { CHEAT_SHEET } from './cheatsheet.js';
import { EXAMPLES } from './library.js';

/**
 * Fills the cheat sheet. Every item is a button: pattern and replacement items are
 * inserted, flag items switch their flag.
 * @param {HTMLElement} container
 * @param {'en'|'tr'} lang
 */
export function renderCheatSheet(container, lang) {
  container.replaceChildren(
    ...CHEAT_SHEET.map((section) =>
      h('section', { className: 'cheat-section', 'aria-labelledby': `cheat-${section.id}` }, [
        h('h3', { id: `cheat-${section.id}`, text: section.title[lang] }),
        h(
          'ul',
          { className: 'cheat-list' },
          section.items.map((item) =>
            h('li', {}, [
              h('button', { type: 'button', className: 'cheat-item', dataset: { kind: section.kind, syntax: item.syntax, flags: item.flags ?? '' } }, [
                h('code', { text: item.syntax }),
                h('span', { text: item[lang] }),
              ]),
            ]),
          ),
        ),
      ]),
    ),
  );
}

/**
 * Fills the example library list.
 * @param {HTMLElement} list
 * @param {'en'|'tr'} lang
 * @param {string|undefined} activeId  the example currently loaded, if any
 */
export function renderExamples(list, lang, activeId) {
  list.replaceChildren(
    ...EXAMPLES.map((example) =>
      h('li', {}, [
        h('button', { type: 'button', className: 'example-item', dataset: { id: example.id }, 'aria-current': example.id === activeId ? 'true' : null }, [
          h('span', { className: 'example-name', text: example.name[lang] }),
          h('code', { className: 'example-pattern', text: `/${example.pattern}/${example.flags}` }),
          h('span', { className: 'example-note', text: example.note[lang] }),
        ]),
      ]),
    ),
  );
}

/**
 * Wires a native <dialog>: its [data-close] buttons and a click on the backdrop close
 * it, and onClose runs however it was closed (button, backdrop or Escape).
 * @param {HTMLDialogElement} dialog
 * @param {() => void} onClose
 */
export function setupDialog(dialog, onClose) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest('[data-close]')) dialog.close();
  });
  dialog.addEventListener('close', onClose);
}
