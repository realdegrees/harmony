import * as mediasoup from 'mediasoup';
import { getNextWorker } from './worker-pool.js';
import { mediaCodecs } from './config.js';

const routers = new Map<string, mediasoup.types.Router>();

export async function getOrCreateRouter(roomId: string): Promise<mediasoup.types.Router> {
  let router = routers.get(roomId);
  if (router && !router.closed) return router;

  const worker = getNextWorker();
  router = await worker.createRouter({ mediaCodecs });
  routers.set(roomId, router);
  console.log(`Router created for room ${roomId}`);
  return router;
}

export function getRouter(roomId: string): mediasoup.types.Router | undefined {
  const router = routers.get(roomId);
  if (router?.closed) {
    routers.delete(roomId);
    return undefined;
  }
  return router;
}

export function closeRouter(roomId: string): void {
  const router = routers.get(roomId);
  if (router && !router.closed) {
    router.close();
  }
  routers.delete(roomId);
  console.log(`Router closed for room ${roomId}`);
}

export function getAllRouters(): Map<string, mediasoup.types.Router> {
  return routers;
}
