/**
 * Backtracking guard: runs analysis requests in a worker with a time limit, so a
 * catastrophic pattern such as ^(a+)+$ cannot freeze the page.
 *
 * Protocol between this runner and the worker script:
 *   worker -> page  READY_MESSAGE once the worker has loaded
 *   page -> worker  { id, request }
 *   worker -> page  respond({ id, request }) = { id, result }
 *
 * The runner itself is pure: the worker factory and the timer functions are injected,
 * so tests drive it with fakes or with node:worker_threads.
 *
 * @typedef {{ postMessage(message: unknown): void, terminate(): void,
 *   onmessage: ((event: { data: any }) => void) | null, onerror: ((event: any) => void) | null }} WorkerLike
 * @typedef {{ status: 'done', result: object } | { status: 'timeout' } | { status: 'superseded' }
 *   | { status: 'error', message: string }} RunOutcome
 */
import { analyze } from './regex.js';

/** Time a single analysis may take before the worker is stopped. */
export const TIMEOUT_MS = 500;

/** First message a worker sends once its modules have loaded. */
export const READY_MESSAGE = Object.freeze({ type: 'ready' });

const TIMEOUT = Object.freeze({ status: 'timeout' });
const SUPERSEDED = Object.freeze({ status: 'superseded' });

/**
 * Worker side of the protocol: answers one request message.
 * @param {{ id: number, request: Parameters<typeof analyze>[0] }} message
 * @returns {{ id: number, result: ReturnType<typeof analyze> }}
 */
export function respond(message) {
  return { id: message.id, result: analyze(message.request) };
}

/**
 * Creates the page side of the guard. Only the newest request matters: a request
 * still waiting when a newer one arrives resolves as "superseded". A request that
 * runs longer than timeoutMs terminates the worker (a fresh one starts for the next
 * request) and resolves as "timeout". The time limit starts when the request is
 * posted to a ready worker, so worker start-up time is not counted. A worker that
 * cannot be created, fails to load or crashes resolves the request as "error".
 * @param {object} options
 * @param {() => WorkerLike} options.spawn  e.g. () => new Worker(url, { type: 'module' })
 * @param {number} [options.timeoutMs]
 * @param {(callback: () => void, ms: number) => unknown} [options.setTimer]
 * @param {(handle: unknown) => void} [options.clearTimer]
 * @returns {{ run(request: object): Promise<RunOutcome>, dispose(): void }}
 */
export function createRunner({ spawn, timeoutMs = TIMEOUT_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let worker = null;
  let ready = false;
  let active = null;
  let queued = null;
  let nextId = 1;

  function startWorker() {
    const current = spawn();
    worker = current;
    ready = false;
    current.onmessage = (event) => {
      if (current === worker) receive(event.data);
    };
    current.onerror = (event) => {
      if (current === worker) crash(event);
    };
  }

  function stopWorker() {
    worker?.terminate();
    worker = null;
    ready = false;
  }

  function receive(data) {
    if (data?.type === READY_MESSAGE.type) {
      ready = true;
      pump();
    } else if (active && data?.id === active.id) {
      finish({ status: 'done', result: data.result });
    }
  }

  function crash(event) {
    stopWorker();
    const outcome = { status: 'error', message: String(event?.message ?? 'Worker error') };
    if (active) {
      finish(outcome);
    } else if (queued) {
      queued.resolve(outcome);
      queued = null;
    }
  }

  function pump() {
    if (active || !queued) return;
    if (!worker) {
      try {
        startWorker();
      } catch (err) {
        crash(err);
        return;
      }
    }
    if (!ready) return;
    const job = { ...queued, id: nextId++ };
    queued = null;
    active = job;
    worker.postMessage({ id: job.id, request: job.request });
    job.timer = setTimer(() => {
      if (active !== job) return;
      stopWorker();
      finish(TIMEOUT);
    }, timeoutMs);
  }

  function finish(outcome) {
    const job = active;
    active = null;
    clearTimer(job.timer);
    job.resolve(queued ? SUPERSEDED : outcome);
    pump();
  }

  return {
    run(request) {
      return new Promise((resolve) => {
        queued?.resolve(SUPERSEDED);
        queued = { request, resolve };
        pump();
      });
    },
    dispose() {
      stopWorker();
      if (active) {
        clearTimer(active.timer);
        active.resolve(SUPERSEDED);
        active = null;
      }
      queued?.resolve(SUPERSEDED);
      queued = null;
    },
  };
}
