import type * as mediasoup from 'mediasoup';

const producers = new Map<string, mediasoup.types.Producer>();

export async function createProducer(
  transport: mediasoup.types.WebRtcTransport,
  kind: mediasoup.types.MediaKind,
  rtpParameters: mediasoup.types.RtpParameters,
  appData: Record<string, unknown> = {},
): Promise<mediasoup.types.Producer> {
  const producer = await transport.produce({ kind, rtpParameters, appData });

  producers.set(producer.id, producer);

  producer.on('transportclose', () => {
    producers.delete(producer.id);
  });

  return producer;
}

export function getProducer(producerId: string): mediasoup.types.Producer | undefined {
  return producers.get(producerId);
}

export function closeProducer(producerId: string): void {
  const producer = producers.get(producerId);
  if (producer && !producer.closed) {
    producer.close();
  }
  producers.delete(producerId);
}

export function getAllProducers(): Map<string, mediasoup.types.Producer> {
  return producers;
}
