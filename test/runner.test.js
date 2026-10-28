import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMainThread, parentPort, Worker } from 'node:worker_threads';
import { READY_MESSAGE, TIMEOUT_MS, createRunner, respond } from '../src/runner.js';
import { analyze } from '../src/regex.js';

// This file doubles as the worker script for the real-worker test: inside a worker
// thread it only answers requests, the way the browser's module worker does.
if (isMainThread) defineTests();
else serveRequests();

function serveRequests() {
  parentPort.on('message', (message) => parentPort.postMessage(respond(message)));
  parentPort.postMessage(READY_MESSAGE);
}

/** Wraps a node:worker_threads Worker in the browser Worker shape the runner expects. */
function nodeWorker() {
  const worker = new Worker(new URL(import.meta.url));
  const adapter = {
    onmessage: null,
    onerror: null,
    postMessage: (message) => worker.postMessage(message),
    terminate: () => {
      worker.terminate();
    },
  };
  worker.on('message', (data) => adapter.onmessage?.({ data }));
  worker.on('error', (error) => adapter.onerror?.(error));
  return adapter;
}

/** A scripted stand-in for workers and timers, so every path runs deterministically. */
function fakeRunner(options = {}) {
  const workers = [];
  const timers = new Map();
  let nextTimer = 1;
  const env = {
    workers,
    timers,
    fireTimers() {
      for (const [id, timer] of [...timers]) {
        timers.delete(id);
        timer.callback();
      }
    },
  };
  const runner = createRunner({
    ...options,
    spawn() {
      const worker = {
        posted: [],
        terminated: false,
        onmessage: null,
        onerror: null,
        postMessage: (message) => worker.posted.push(message),
        terminate: () => {
          worker.terminated = true;
        },
        send: (data) => worker.onmessage?.({ data }),
      };
      workers.push(worker);
      return worker;
    },
    setTimer(callback, ms) {
      const id = nextTimer++;
      timers.set(id, { callback, ms });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  return { env, runner };
}

/** Records how a promise settles, so tests can also check that it has not settled yet. */
function track(promise) {
  const state = { settled: false, value: undefined };
  promise.then((value) => {
    state.settled = true;
    state.value = value;
  });
  return state;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const request = (text) => ({ pattern: '\\w', flags: '', text, replacement: '', mode: 'matches' });

function defineTests() {
  test('respond answers a request message with the analysis', () => {
    const message = { id: 7, request: { pattern: '(?<n>\\d+)', flags: 'g', text: 'a12 b3', replacement: '<$<n>>', mode: 'replace' } };
    assert.deepEqual(respond(message), { id: 7, result: analyze(message.request) });
    assert.equal(respond({ id: 8, request: { ...message.request, pattern: '(' } }).result.ok, false);
  });

  test('a request waits for the ready message, then runs with a 500 ms limit', async () => {
    const { env, runner } = fakeRunner();
    const outcome = track(runner.run(request('a')));
    const [worker] = env.workers;
    assert.deepEqual(worker.posted, []);
    assert.equal(env.timers.size, 0, 'start-up time is not counted');
    worker.send(READY_MESSAGE);
    assert.deepEqual(worker.posted, [{ id: 1, request: request('a') }]);
    assert.equal(TIMEOUT_MS, 500);
    assert.deepEqual([...env.timers.values()].map((timer) => timer.ms), [TIMEOUT_MS]);
    worker.send(respond(worker.posted[0]));
    await flush();
    assert.deepEqual(outcome.value, { status: 'done', result: analyze(request('a')) });
    assert.equal(env.timers.size, 0);
    assert.equal(env.workers.length, 1);
  });

  test('a timeout terminates the worker and the next request gets a fresh one', async () => {
    const { env, runner } = fakeRunner({ timeoutMs: 1234 });
    const slow = track(runner.run(request('a')));
    const [first] = env.workers;
    first.send(READY_MESSAGE);
    assert.equal([...env.timers.values()][0].ms, 1234);
    env.fireTimers();
    await flush();
    assert.deepEqual(slow.value, { status: 'timeout' });
    assert.equal(first.terminated, true);

    const next = track(runner.run(request('b')));
    assert.equal(env.workers.length, 2);
    const second = env.workers[1];
    first.send(READY_MESSAGE);
    first.send({ id: 1, result: 'late answer' });
    assert.deepEqual(second.posted, [], 'messages from the stopped worker are ignored');
    second.send(READY_MESSAGE);
    assert.equal(second.posted[0].id, 2);
    second.send(respond(second.posted[0]));
    await flush();
    assert.equal(next.value.status, 'done');
    assert.equal(next.value.result.matches[0].value, 'b');
  });

  test('only the newest request is answered; older ones resolve as superseded', async () => {
    const { env, runner } = fakeRunner();
    const a = track(runner.run(request('a')));
    const b = track(runner.run(request('b')));
    await flush();
    assert.deepEqual(a.value, { status: 'superseded' });
    assert.equal(b.settled, false);
    const [worker] = env.workers;
    worker.send(READY_MESSAGE);
    assert.deepEqual(worker.posted.map((message) => message.request.text), ['b']);

    const c = track(runner.run(request('c')));
    const d = track(runner.run(request('d')));
    await flush();
    assert.deepEqual(c.value, { status: 'superseded' });
    assert.equal(worker.posted.length, 1, 'the newest request waits for the running one');
    worker.send(respond(worker.posted[0]));
    await flush();
    assert.deepEqual(b.value, { status: 'superseded' }, 'an outdated answer is dropped');
    assert.deepEqual(worker.posted.map((message) => message.request.text), ['b', 'd']);
    worker.send(respond(worker.posted[1]));
    await flush();
    assert.equal(d.value.status, 'done');
    assert.equal(d.value.result.matches[0].value, 'd');
  });

  test('a timeout while a newer request waits restarts the worker for the newer one', async () => {
    const { env, runner } = fakeRunner();
    const slow = track(runner.run(request('a')));
    env.workers[0].send(READY_MESSAGE);
    const newer = track(runner.run(request('b')));
    env.fireTimers();
    await flush();
    assert.deepEqual(slow.value, { status: 'superseded' });
    assert.equal(env.workers[0].terminated, true);
    assert.equal(env.workers.length, 2);
    env.workers[1].send(READY_MESSAGE);
    env.workers[1].send(respond(env.workers[1].posted[0]));
    await flush();
    assert.equal(newer.value.status, 'done');
  });

  test('unrelated messages and repeated ready messages are ignored', async () => {
    const { env, runner } = fakeRunner();
    const outcome = track(runner.run(request('a')));
    const [worker] = env.workers;
    worker.send(null);
    worker.send('noise');
    worker.send(READY_MESSAGE);
    worker.send({ id: 99, result: {} });
    worker.send(READY_MESSAGE);
    await flush();
    assert.equal(outcome.settled, false);
    assert.equal(worker.posted.length, 1);
    worker.send(respond(worker.posted[0]));
    await flush();
    assert.equal(outcome.value.status, 'done');
  });

  test('worker errors resolve the request with an error and stop the worker', async () => {
    const { env, runner } = fakeRunner();
    const running = track(runner.run(request('a')));
    env.workers[0].send(READY_MESSAGE);
    env.workers[0].onerror({ message: 'boom' });
    await flush();
    assert.deepEqual(running.value, { status: 'error', message: 'boom' });
    assert.equal(env.workers[0].terminated, true);
    assert.equal(env.timers.size, 0);

    const loading = track(runner.run(request('b')));
    env.workers[1].onerror(new Error('failed to load'));
    await flush();
    assert.deepEqual(loading.value, { status: 'error', message: 'failed to load' });

    const unnamed = track(runner.run(request('c')));
    env.workers[2].onerror({});
    await flush();
    assert.deepEqual(unnamed.value, { status: 'error', message: 'Worker error' });
  });

  test('a worker that cannot be created resolves as an error, and the next request tries again', async () => {
    let calls = 0;
    const runner = createRunner({
      spawn: () => {
        calls++;
        throw new Error('Workers are not available');
      },
    });
    const failure = { status: 'error', message: 'Workers are not available' };
    assert.deepEqual(await runner.run(request('a')), failure);
    assert.deepEqual(await runner.run(request('b')), failure);
    assert.equal(calls, 2);
  });

  test('dispose stops the worker and settles every pending request', async () => {
    const { env, runner } = fakeRunner();
    const running = track(runner.run(request('a')));
    env.workers[0].send(READY_MESSAGE);
    const waiting = track(runner.run(request('b')));
    runner.dispose();
    await flush();
    assert.deepEqual(running.value, { status: 'superseded' });
    assert.deepEqual(waiting.value, { status: 'superseded' });
    assert.equal(env.workers[0].terminated, true);
    assert.equal(env.timers.size, 0);
    env.workers[0].send(respond(env.workers[0].posted[0]));
    assert.equal(env.workers.length, 1);
  });

  test('a real worker answers, is stopped on catastrophic backtracking and recovers', async () => {
    let spawned = 0;
    const runner = createRunner({
      spawn: () => {
        spawned++;
        return nodeWorker();
      },
    });
    const text = `${'a'.repeat(32)}b`;
    try {
      const quick = await runner.run({ pattern: '(?<d>\\d)', flags: 'g', text: 'a1b2', mode: 'matches' });
      assert.equal(quick.status, 'done');
      assert.deepEqual(quick.result.matches.map((match) => match.value), ['1', '2']);

      const started = performance.now();
      const slow = await runner.run({ pattern: '^(a+)+$', flags: '', text, mode: 'matches' });
      const elapsed = performance.now() - started;
      assert.equal(slow.status, 'timeout');
      assert.ok(elapsed >= TIMEOUT_MS - 25 && elapsed < TIMEOUT_MS + 2500, `${Math.round(elapsed)} ms`);

      const again = await runner.run({ pattern: 'a+b$', flags: '', text, mode: 'matches' });
      assert.equal(again.status, 'done');
      assert.equal(again.result.matches[0].value, text);
      assert.equal(spawned, 2);
    } finally {
      runner.dispose();
    }
  });
}
