/**
 * Small DOM helpers shared by the UI modules. Text always goes in through text nodes
 * or textContent, never through HTML parsing.
 */

/**
 * Creates an element.
 * @param {string} tag
 * @param {object} [props]  className, text, dataset, style (CSS custom properties) or plain attributes;
 *   null, undefined and false values are skipped
 * @param {Array<Node|string|null|undefined|false>} [children]  strings become text nodes
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') for (const [name, css] of Object.entries(value)) node.style.setProperty(name, css);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

/**
 * getElementById that fails loudly, so a renamed id is caught on the first load.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function byId(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

/**
 * Lets the arrow keys (and Home / End) move focus between the items of a list.
 * @param {HTMLElement} container
 * @param {string} selector  the focusable items inside the container
 */
export function arrowNavigation(container, selector) {
  const steps = { ArrowDown: 1, ArrowUp: -1 };
  container.addEventListener('keydown', (event) => {
    if (!Object.hasOwn(steps, event.key) && event.key !== 'Home' && event.key !== 'End') return;
    const items = [...container.querySelectorAll(selector)];
    const current = items.indexOf(document.activeElement);
    if (current === -1) return;
    event.preventDefault();
    let next = current + (steps[event.key] ?? 0);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    items[Math.max(0, Math.min(items.length - 1, next))].focus();
  });
}

/**
 * Grows a textarea to fit its content, so it never needs its own scrollbar.
 * @param {HTMLTextAreaElement} field
 */
export function autoGrow(field) {
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight}px`;
}

/**
 * Inserts text at the caret (replacing any selection) and focuses the field.
 * @param {HTMLInputElement|HTMLTextAreaElement} field
 * @param {string} snippet
 */
export function insertAtCaret(field, snippet) {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  field.setRangeText(snippet, start, end, 'end');
  field.focus();
}
