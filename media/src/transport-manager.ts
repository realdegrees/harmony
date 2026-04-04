import type * as mediasoup from 'mediasoup';
import { config } from './config.js';

const transports = new Map<string, mediasoup.types.WebRtcTransport>();

export async function createWebRtcTransport(
  router: mediasoup.types.Router,
): Promise<mediasoup.types.WebRtcTransport> {
  const transport = await router.createWebRtcTransport({
    listenInfos: [
      {
        protocol: 'udp',
        ip: config.listenIp,
        announcedAddress: config.announcedIp,
      },
      {
        protocol: 'tcp',
        ip: config.listenIp,
        announcedAddress: config.announcedIp,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1_000_000,
  });

  transports.set(transport.id, transport);

  transport.on('routerclose', () => {
    transports.delete(transport.id);
  });

  return transport;
}

export function getTransport(transportId: string): mediasoup.types.WebRtcTransport | undefined {
  return transports.get(transportId);
}

export function closeTransport(transportId: string): void {
  const transport = transports.get(transportId);
  if (transport && !transport.closed) {
    transport.close();
  }
  transports.delete(transportId);
}
