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
const root = fileURLToPath(new URL('..', import.meta.url));
export async function startAdminCategoriesHarness({
  backendTarget,
  authenticated = true,
} = {}) {
  const directory = await mkdtemp(
    join(tmpdir(), 'unihub-admin-categories-fr-'),
  );
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
      import React,{useState,useRef} from 'react';import {createRoot} from 'react-dom/client';
      import {AdminCategoriesPage} from ${JSON.stringify(root + '/src/features/admin/categories/AdminCategoriesPage.tsx')};
      import {setAuthenticated,setGuest} from ${JSON.stringify(root + '/src/features/auth/auth-state.ts')};
      const sync=(token,role,id=1)=>token&&role?setAuthenticated(token,{id,email:'test@example.com',fullName:'Test',avatarUrl:null,role}):setGuest();
      sync(${authenticated ? "'admin-test-token'" : 'null'},${authenticated ? "'Admin'" : 'null'});
      const e=React.createElement;
      function Harness(){const [token,setToken]=useState(${authenticated ? "'admin-test-token'" : 'null'});const [role,setRole]=useState(${authenticated ? "'Admin'" : 'null'});const [visible,setVisible]=useState(true);const current=useRef({token,role});
        window.adminTest={setToken:(value)=>{current.current.token=value;sync(value,current.current.role);setToken(value)},setRole:(value)=>{current.current.role=value;sync(current.current.token,value);setRole(value)},setVisible,setUser:(id)=>sync(token,role,id)};
        return visible?e(AdminCategoriesPage,{accessToken:token,role}):e('p',null,'Unmounted');}
      createRoot(document.getElementById('root')).render(e(Harness));
    `,
    );
    vite = await createServer({
      root,
      // Each browser harness owns its optimizer cache; concurrent Vite servers
      // must not replace the dependency cache used by existing Guidance tests.
      cacheDir: join(directory, 'vite-cache'),
      configFile: false,
      plugins: [
        react(),
        {
          name: 'admin-categories-test-only-document',
          configureServer(server) {
            server.middlewares.use(async (request, response, next) => {
              if (request.url !== '/admin-categories-test') return next();
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
      resolve: { dedupe: ['react', 'react-dom'] },
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
