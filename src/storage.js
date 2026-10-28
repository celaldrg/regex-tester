/**
 * Safe access to localStorage. Every read and write is wrapped in try/catch, so a
 * private window, blocked storage or a full quota never breaks the app. Values are
 * stored as JSON under a "regex-tester:" prefix. Nothing touches storage at import time.
 */

const PREFIX = 'regex-tester:';

/**
 * Creates a storage helper around a Storage-like backend.
 * @param {() => (Pick<Storage, 'getItem'|'setItem'> | undefined)} [getBackend]
 *   called on every access; defaults to the browser's localStorage
 * @returns {{ get(key: string, fallback: unknown): unknown, set(key: string, value: unknown): boolean }}
 */
export function createStorage(getBackend = () => globalThis.localStorage) {
  return {
    get(key, fallback) {
      try {
        const raw = getBackend().getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        getBackend().setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The app's storage helper, backed by localStorage. */
export const storage = createStorage();
