import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer } from 'vite';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

test('Major consumer requests the approved endpoint and parses its response', async () => {
  const originalFetch = globalThis.fetch;
  let requestedPath;
  let requestOptions;
  const vite = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    root: frontendRoot,
    server: { middlewareMode: true },
  });

  globalThis.fetch = async (input, init) => {
    requestedPath = String(input);
    requestOptions = init;
    return new Response(
      JSON.stringify({
        items: [{ id: 12, name: 'Kỹ thuật phần mềm', type: 'Major' }],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    const { getMajorOptions } = await vite.ssrLoadModule(
      '/src/features/opportunities/api.ts',
    );
    const controller = new AbortController();

    assert.deepEqual(await getMajorOptions(controller.signal), [
      { id: 12, name: 'Kỹ thuật phần mềm', type: 'Major' },
    ]);
    assert.equal(requestedPath, '/api/categories?type=Major');
    assert.equal(requestOptions.method, 'GET');
    assert.equal(requestOptions.signal, controller.signal);
    assert.equal(requestOptions.headers.get('Accept'), 'application/json');
  } finally {
    globalThis.fetch = originalFetch;
    await vite.close();
  }
});
