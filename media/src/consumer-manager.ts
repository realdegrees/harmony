import type * as mediasoup from 'mediasoup';

const consumers = new Map<string, mediasoup.types.Consumer>();

export async function createConsumer(
  transport: mediasoup.types.WebRtcTransport,
  producer: mediasoup.types.Producer,
  rtpCapabilities: mediasoup.types.RtpCapabilities,
  router: mediasoup.types.Router,
): Promise<mediasoup.types.Consumer | null> {
  if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
    console.warn(`Cannot consume producer ${producer.id}`);
    return null;
  }

  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: true, // Start paused, client resumes after setup
  });

  consumers.set(consumer.id, consumer);

  consumer.on('transportclose', () => {
    consumers.delete(consumer.id);
  });

  consumer.on('producerclose', () => {
    consumers.delete(consumer.id);
  });

  return consumer;
}

export function getConsumer(consumerId: string): mediasoup.types.Consumer | undefined {
  return consumers.get(consumerId);
}

export async function resumeConsumer(consumerId: string): Promise<void> {
  const consumer = consumers.get(consumerId);
  if (consumer && !consumer.closed) {
    await consumer.resume();
  }
}

export function closeConsumer(consumerId: string): void {
  const consumer = consumers.get(consumerId);
  if (consumer && !consumer.closed) {
    consumer.close();
  }
  consumers.delete(consumerId);
}
