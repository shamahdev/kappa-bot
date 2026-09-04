import 'dotenv/config';

const role = process.env.BOT_ROLE ?? 'gateway';
if (role === 'worker') {
  const { startWorker } = await import('./worker');
  await startWorker();
  process.exitCode = 0; // no process.exit(): lets pino flush before drain
} else {
  const { startGateway } = await import('./app');
  await startGateway();
}
