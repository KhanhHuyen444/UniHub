import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const require = createRequire(import.meta.url);
export let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  /* optional environment runner */
}
const root = fileURLToPath(new URL('..', import.meta.url)).replaceAll(
  '\\',
  '/',
);
export async function startRecommendationsHarness({
  backendTarget,
  authenticated = true,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'unihub-recommendations-fr-'));
  let vite, browser;
  const close = async () => {
    await browser?.close();
    await vite?.close();
    await rm(directory, { recursive: true, force: true });
  };
  try {
    const entry = join(directory, 'entry.js');
    await writeFile(
      entry,
      `
      import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router';
      import {RecommendationsPage} from ${JSON.stringify(root + '/src/features/recommendations/RecommendationsPage.tsx')};
      import {setAccessToken} from ${JSON.stringify(root + '/src/features/auth/auth-state.ts')};
      setAccessToken(${authenticated ? "'student-test-token'" : 'null'});
      const e=React.createElement;
      function Harness(){const [token,updateToken]=useState(${authenticated ? "'student-test-token'" : 'null'});const [role,setRole]=useState(${authenticated ? "'Student'" : 'null'});const [visible,setVisible]=useState(true);
        const setToken=(value)=>{setAccessToken(value);updateToken(value);};
        window.recommendationTest={setToken,setRole,setVisible};
        return visible?e(RecommendationsPage,{accessToken:token,role,onCompleteProfile:()=>{window.profileRequested=true;},onSignIn:()=>{window.signInRequested=true;}}):e('p',null,'Unmounted');}
      createRoot(document.getElementById('root')).render(e(BrowserRouter,null,e(Harness)));
    `,
    );
    vite = await createServer({
      root,
      cacheDir: join(directory, 'vite-cache'),
      configFile: false,
      plugins: [
        react(),
        {
          name: 'recommendations-test-only-document',
          configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
              if (!backendTarget && request.url === '/api/auth/refresh') {
                response.statusCode = 401;
                response.setHeader('Content-Type', 'application/json');
                response.end(
                  JSON.stringify({
                    error: {
                      code: 'UNAUTHORIZED',
                      message: 'Fixture session expired',
                    },
                  }),
                );
                return;
              }
              if (request.url !== '/recommendations-test') return next();
              response.setHeader('Content-Type', 'text/html');
              response.end(
                await server.transformIndexHtml(
                  request.url,
                  `<div id="root"></div><script type="module" src="/@fs/${entry}"></script>`,
                ),
              );
            });
          },
        },
      ],
      resolve: { dedupe: ['react', 'react-dom', 'react-router'] },
      server: {
        host: '127.0.0.1',
        port: 0,
        fs: { allow: [root, directory] },
        ...(backendTarget
          ? { proxy: { '/api': { target: backendTarget, changeOrigin: true } } }
          : {}),
      },
      logLevel: 'silent',
    });
    await vite.listen();
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (existsSync('/usr/bin/chromium')
          ? '/usr/bin/chromium'
          : chromium.executablePath()),
    });
    return {
      browser,
      base: `http://127.0.0.1:${vite.httpServer.address().port}`,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
