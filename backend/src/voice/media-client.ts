import { env } from '../config/env';

const MEDIA_URL = env.MEDIA_SERVER_URL;

async function mediaRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${MEDIA_URL}/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Media server error' })) as { error?: string };
    throw new Error(err.error || `Media server returned ${res.status}`);
  }
  return res.json();
}

export const mediaClient = {
  // Router management
  createRouter: (roomId: string) => mediaRequest('POST', '/routers', { roomId }),
  closeRouter: (roomId: string) => mediaRequest('DELETE', `/routers/${roomId}`),

  // Transport management
  createTransport: (roomId: string) => mediaRequest('POST', `/routers/${roomId}/transports`),
  connectTransport: (transportId: string, dtlsParameters: unknown) =>
    mediaRequest('POST', `/transports/${transportId}/connect`, { dtlsParameters }),
  closeTransport: (transportId: string) => mediaRequest('DELETE', `/transports/${transportId}`),

  // Producer management
  produce: (transportId: string, kind: string, rtpParameters: unknown, appData?: unknown) =>
    mediaRequest('POST', `/transports/${transportId}/produce`, { kind, rtpParameters, appData }),
  pauseProducer: (producerId: string) => mediaRequest('POST', `/producers/${producerId}/pause`),
  resumeProducer: (producerId: string) => mediaRequest('POST', `/producers/${producerId}/resume`),
  closeProducer: (producerId: string) => mediaRequest('DELETE', `/producers/${producerId}`),

  // Consumer management
  consume: (transportId: string, producerId: string, rtpCapabilities: unknown, roomId: string) =>
    mediaRequest('POST', `/transports/${transportId}/consume`, { producerId, rtpCapabilities, roomId }),
  resumeConsumer: (consumerId: string) => mediaRequest('POST', `/consumers/${consumerId}/resume`),
  closeConsumer: (consumerId: string) => mediaRequest('DELETE', `/consumers/${consumerId}`),

  // Health
  health: () => mediaRequest('GET', '/health'),
};
