import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shutdownServer, SHUTDOWN_TIMEOUT_MS } from '../dist/shutdown.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup() {
  const scheduler = deferred();
  const http = deferred();
  const actions = [];
  let expire;
  const done = shutdownServer({
    stopScheduler: () => {
      actions.push('stop');
      return scheduler.promise;
    },
    closeHttp: () => {
      actions.push('close');
      return http.promise;
    },
    disconnectDatabase: async () => {
      actions.push('disconnect');
    },
    forceCloseHttp: () => actions.push('force-close'),
    forceExit: () => actions.push('exit'),
    reportError: () => actions.push('error'),
    setTimeout: (callback, delay) => {
      assert.equal(delay, SHUTDOWN_TIMEOUT_MS);
      expire = callback;
      return {};
    },
    clearTimeout: () => actions.push('clear'),
  });
  return { scheduler, http, actions, done, expire: () => expire() };
}

test('shutdown disables scheduler before closing HTTP and drains both before disconnect', async () => {
  for (const first of ['http', 'scheduler']) {
    const f = setup();
    assert.deepEqual(f.actions, ['stop', 'close']);
    f[first].resolve();
    await flush();
    assert.ok(!f.actions.includes('disconnect'));
    f.http.resolve();
    f.scheduler.resolve();
    await f.done;
    assert.deepEqual(f.actions, ['stop', 'close', 'disconnect', 'clear']);
  }
});

test('shutdown hard deadline terminates without disconnecting an in-flight transaction', async () => {
  const f = setup();
  f.http.resolve();
  await flush();
  f.expire();
  assert.deepEqual(f.actions, [
    'stop',
    'close',
    'error',
    'force-close',
    'exit',
  ]);
  f.scheduler.resolve();
  await f.done;
  assert.ok(!f.actions.includes('disconnect'));
});

test('shutdown failure leaves deadline armed and does not disconnect active work', async () => {
  let expire;
  const actions = [];
  await shutdownServer({
    stopScheduler: async () => {
      throw new Error('stop failure');
    },
    closeHttp: async () => {},
    disconnectDatabase: async () => actions.push('disconnect'),
    forceCloseHttp: () => {},
    forceExit: () => actions.push('exit'),
    reportError: () => actions.push('error'),
    setTimeout: (callback) => {
      expire = callback;
      return {};
    },
    clearTimeout: () => actions.push('clear'),
  });
  assert.deepEqual(actions, ['error']);
  expire();
  assert.deepEqual(actions, ['error', 'error', 'exit']);
});
