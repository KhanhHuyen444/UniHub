import { app } from './app.js';
import { readPort } from './config/env.js';

const port = readPort();
const host = '127.0.0.1';

const server = app.listen(port, host, () => {
  console.info(`UniHub HTTP server: http://${host}:${port}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`Không thể mở HTTP server (${error.code ?? 'UNKNOWN'}).`);
  process.exitCode = 1;
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info('Đang dừng HTTP server…');

  const timeout = setTimeout(() => {
    console.error('Hết thời gian chờ; đóng các kết nối HTTP còn lại.');
    process.exitCode = 1;
    server.closeAllConnections();
  }, 10_000);
  timeout.unref();

  server.close((error) => {
    clearTimeout(timeout);
    if (error) {
      console.error('Không thể dừng HTTP server bình thường.');
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
