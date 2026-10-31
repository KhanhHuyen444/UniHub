import { app } from './app.js';
import { readPort } from './config/env.js';
import { disconnectPrismaClient } from './lib/prisma.js';
import { createReminderScheduler } from './modules/events/reminders.scheduler.js';
import { shutdownServer } from './shutdown.js';

const port = readPort();
const host = '127.0.0.1';
const reminderScheduler = createReminderScheduler();

const server = app.listen(port, host, () => {
  console.info(`UniHub HTTP server: http://${host}:${port}`);
  reminderScheduler.start();
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`Không thể mở HTTP server (${error.code ?? 'UNKNOWN'}).`);
  process.exitCode = 1;
});

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info('Đang dừng HTTP server…');
  await shutdownServer({
    stopScheduler: () => reminderScheduler.stop(),
    closeHttp: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    disconnectDatabase: disconnectPrismaClient,
    forceCloseHttp: () => server.closeAllConnections(),
    forceExit: () => process.exit(1),
    reportError: () => {
      console.error('Không thể hoàn tất shutdown trong thời gian cho phép.');
      process.exitCode = 1;
    },
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
