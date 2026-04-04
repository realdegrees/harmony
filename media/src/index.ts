import express from 'express';
import { createWorkerPool } from './worker-pool.js';
import { apiRouter } from './api.js';
import { config } from './config.js';

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

async function main() {
  console.log('Creating mediasoup worker pool...');
  await createWorkerPool();

  app.listen(config.mediaPort, () => {
    console.log(`Harmony Media Server running on port ${config.mediaPort}`);
    console.log(`RTC ports: ${config.rtcMinPort}-${config.rtcMaxPort}`);
    console.log(`Announced IP: ${config.announcedIp}`);
  });
}

main().catch((err) => {
  console.error('Failed to start media server:', err);
  process.exit(1);
});
