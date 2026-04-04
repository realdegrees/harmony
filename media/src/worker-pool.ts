import * as mediasoup from 'mediasoup';
import { config } from './config.js';

const workers: mediasoup.types.Worker[] = [];
let nextWorkerIdx = 0;

export async function createWorkerPool(): Promise<void> {
  for (let i = 0; i < config.numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: config.rtcMinPort,
      rtcMaxPort: config.rtcMaxPort,
    });

    worker.on('died', (error) => {
      console.error(`mediasoup worker ${worker.pid} died:`, error);
      const idx = workers.indexOf(worker);
      if (idx !== -1) workers.splice(idx, 1);

      // Attempt to replace the dead worker
      setTimeout(async () => {
        try {
          const replacement = await mediasoup.createWorker({
            logLevel: 'warn',
            rtcMinPort: config.rtcMinPort,
            rtcMaxPort: config.rtcMaxPort,
          });
          workers.push(replacement);
          console.log(`Replacement worker ${replacement.pid} created`);
        } catch (err) {
          console.error('Failed to create replacement worker:', err);
        }
      }, 2000);
    });

    workers.push(worker);
    console.log(`mediasoup worker ${worker.pid} created [${i + 1}/${config.numWorkers}]`);
  }
}

export function getNextWorker(): mediasoup.types.Worker {
  if (workers.length === 0) throw new Error('No workers available');
  const worker = workers[nextWorkerIdx % workers.length];
  nextWorkerIdx++;
  return worker;
}

export function getWorkers(): mediasoup.types.Worker[] {
  return workers;
}
