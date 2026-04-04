/**
 * mediasoup-client wrapper for Harmony voice.
 *
 * This module wraps the mediasoup-client Device, send/recv transports,
 * producers, and consumers behind a clean API that the voice store consumes.
 *
 * NOTE: mediasoup-client must be installed as a dependency:
 *   npm install mediasoup-client
 *
 * The `ws` import is used to signal the SFU (Selective Forwarding Unit)
 * via the WebSocket protocol events defined in ws-events.ts.
 */

import { ws } from '$lib/api/ws';
import type {
  MediaServerTransport,
  ProducerInfo,
  ConsumerInfo,
} from '@harmony/shared/types/voice';
import type {
  VoiceTransportCreatedPayload,
  VoiceProducedPayload,
  VoiceConsumedPayload,
  VoiceNewProducerPayload,
  VoiceProducerClosedPayload,
} from '@harmony/shared/types/ws-events';
import type { DtlsParameters, RtpParameters, AppData, MediaKind } from 'mediasoup-client/types';

// Lazy-import mediasoup-client at runtime to avoid SSR issues
type MediasoupDevice = import('mediasoup-client').types.Device;
type Transport = import('mediasoup-client').types.Transport;
type Producer = import('mediasoup-client').types.Producer;
type Consumer = import('mediasoup-client').types.Consumer;
type RtpCapabilities = import('mediasoup-client').types.RtpCapabilities;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let device: MediasoupDevice | null = null;
let sendTransport: Transport | null = null;
let recvTransport: Transport | null = null;

const producers = new Map<string, Producer>(); // kind → Producer
const consumers = new Map<string, Consumer>(); // consumerId → Consumer
const remoteStreams = new Map<string, MediaStream>(); // userId → MediaStream

// Callbacks the voice store can subscribe to
let onNewStream: ((userId: string, stream: MediaStream) => void) | null = null;
let onStreamRemoved: ((userId: string) => void) | null = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the mediasoup Device with server RTP capabilities.
 * Must be called after joining a voice channel and receiving capabilities.
 */
export async function initDevice(rtpCapabilities: RtpCapabilities): Promise<void> {
  const { Device } = await import('mediasoup-client');
  device = new Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });
}

/**
 * Set callbacks for new/removed remote streams.
 */
export function setStreamCallbacks(
  onNew: (userId: string, stream: MediaStream) => void,
  onRemoved: (userId: string) => void
): void {
  onNewStream = onNew;
  onStreamRemoved = onRemoved;
}

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

/**
 * Creates the send (upstream) transport.
 * Listens for voice:transport-created events with direction 'send'.
 */
export async function createSendTransport(serverTransport: MediaServerTransport): Promise<void> {
  if (!device) throw new Error('Device not initialized');

  sendTransport = device.createSendTransport({
    id: serverTransport.transportId,
    iceParameters: serverTransport.iceParameters as import('mediasoup-client').types.IceParameters,
    iceCandidates: serverTransport.iceCandidates as import('mediasoup-client').types.IceCandidate[],
    dtlsParameters: serverTransport.dtlsParameters as import('mediasoup-client').types.DtlsParameters,
  });

  sendTransport.on('connect', (
    { dtlsParameters }: { dtlsParameters: DtlsParameters },
    callback: () => void,
    errback: (err: Error) => void,
  ) => {
    try {
      ws.send({ type: 'voice:connect-transport', data: { transportId: serverTransport.transportId, dtlsParameters } });
      callback();
    } catch (e) { errback(e as Error); }
  });

  sendTransport.on('produce', (
    { kind, rtpParameters, appData }: { kind: MediaKind; rtpParameters: RtpParameters; appData: AppData },
    callback: (p: { id: string }) => void,
    errback: (err: Error) => void,
  ) => {
    try {
      const handler = ws.on<VoiceProducedPayload>('voice:produced', ({ producerId }) => {
        handler();
        callback({ id: producerId });
      });
      ws.send({ type: 'voice:produce', data: { transportId: serverTransport.transportId, kind, rtpParameters, appData: appData as Record<string, unknown> } });
    } catch (e) { errback(e as Error); }
  });
}

/**
 * Creates the receive (downstream) transport.
 */
export async function createRecvTransport(serverTransport: MediaServerTransport): Promise<void> {
  if (!device) throw new Error('Device not initialized');

  recvTransport = device.createRecvTransport({
    id: serverTransport.transportId,
    iceParameters: serverTransport.iceParameters as import('mediasoup-client').types.IceParameters,
    iceCandidates: serverTransport.iceCandidates as import('mediasoup-client').types.IceCandidate[],
    dtlsParameters: serverTransport.dtlsParameters as import('mediasoup-client').types.DtlsParameters,
  });

  recvTransport.on('connect', (
    { dtlsParameters }: { dtlsParameters: DtlsParameters },
    callback: () => void,
    errback: (err: Error) => void,
  ) => {
    try {
      ws.send({ type: 'voice:connect-transport', data: { transportId: serverTransport.transportId, dtlsParameters } });
      callback();
    } catch (e) { errback(e as Error); }
  });
}

// ---------------------------------------------------------------------------
// Producing (sending local media)
// ---------------------------------------------------------------------------

/**
 * Produce audio from a local MediaStream track.
 */
export async function produceAudio(stream: MediaStream): Promise<void> {
  if (!sendTransport) throw new Error('Send transport not ready');
  const track = stream.getAudioTracks()[0];
  if (!track) throw new Error('No audio track in stream');

  const producer = await sendTransport.produce({ track, appData: { kind: 'audio' } });
  producers.set('audio', producer);

  producer.on('trackended', () => {
    stopProducer('audio');
  });
}

/**
 * Produce video from a local MediaStream track (camera or screen).
 */
export async function produceVideo(stream: MediaStream, appData: Record<string, unknown> = {}): Promise<void> {
  if (!sendTransport) throw new Error('Send transport not ready');
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error('No video track in stream');

  const producer = await sendTransport.produce({
    track,
    encodings: [
      { rid: 'r0', scaleResolutionDownBy: 4, maxBitrate: 100_000 },
      { rid: 'r1', scaleResolutionDownBy: 2, maxBitrate: 300_000 },
      { rid: 'r2', scaleResolutionDownBy: 1, maxBitrate: 1_000_000 },
    ],
    codecOptions: { videoGoogleStartBitrate: 1000 },
    appData: { kind: 'video', ...appData },
  });
  producers.set('video', producer);

  producer.on('trackended', () => {
    stopProducer('video');
  });
}

/**
 * Stop and close a producer by kind.
 */
export function stopProducer(kind: 'audio' | 'video'): void {
  const producer = producers.get(kind);
  if (!producer) return;
  producer.close();
  producers.delete(kind);
}

/**
 * Replace the video track (e.g., switching from camera to screen share).
 */
export async function replaceVideoTrack(newStream: MediaStream): Promise<void> {
  const producer = producers.get('video');
  if (!producer) throw new Error('No video producer');
  const track = newStream.getVideoTracks()[0];
  if (!track) throw new Error('No video track in stream');
  await producer.replaceTrack({ track });
}

// ---------------------------------------------------------------------------
// Consuming (receiving remote media)
// ---------------------------------------------------------------------------

/**
 * Consume a remote producer. Called in response to 'voice:new-producer' events.
 */
export async function consumeProducer(
  producerInfo: ProducerInfo,
  userId: string
): Promise<void> {
  if (!recvTransport || !device) throw new Error('Recv transport or device not ready');
  // canConsume may not be available depending on mediasoup-client version; guard safely
  const canConsume = (device as unknown as { canConsume?: (opts: unknown) => boolean }).canConsume;
  if (canConsume && !canConsume.call(device, { producerId: producerInfo.producerId, rtpCapabilities: device.rtpCapabilities })) {
    console.warn('[mediasoup] Cannot consume producer', producerInfo.producerId);
    return;
  }

  // Request consumer from server
  const handler = ws.on<VoiceConsumedPayload>('voice:consumed', async ({ consumerInfo }) => {
    if (consumerInfo.producerId !== producerInfo.producerId) return;
    handler(); // unsubscribe

    const consumer = await recvTransport!.consume({
      id: consumerInfo.consumerId,
      producerId: consumerInfo.producerId,
      kind: consumerInfo.kind,
      rtpParameters: consumerInfo.rtpParameters as import('mediasoup-client').types.RtpParameters,
      appData: consumerInfo.appData,
    });

    consumers.set(consumerInfo.consumerId, consumer);

    // Resume the consumer on server
    ws.send({ type: 'voice:resume-consumer', data: { consumerId: consumerInfo.consumerId } });

    // Attach track to a stream for the user
    let stream = remoteStreams.get(userId) ?? new MediaStream();
    stream.addTrack(consumer.track);
    remoteStreams.set(userId, stream);
    onNewStream?.(userId, stream);

    consumer.on('trackended', () => {
      removeConsumer(consumerInfo.consumerId, userId);
    });
  });

  ws.send({ type: 'voice:consume', data: { producerId: producerInfo.producerId } });
}

function removeConsumer(consumerId: string, userId: string): void {
  const consumer = consumers.get(consumerId);
  if (consumer) {
    consumer.close();
    consumers.delete(consumerId);
  }
  // Remove track from stream
  const stream = remoteStreams.get(userId);
  if (stream) {
    const track = stream.getTracks().find(t => t.id === consumer?.track.id);
    if (track) {
      stream.removeTrack(track);
    }
    if (stream.getTracks().length === 0) {
      remoteStreams.delete(userId);
      onStreamRemoved?.(userId);
    }
  }
}

// ---------------------------------------------------------------------------
// Event handlers — call these from the voice store
// ---------------------------------------------------------------------------

/**
 * Set up all mediasoup server-event listeners. Call after WS connects.
 */
export function setupListeners(): () => void {
  const unsubNewProducer = ws.on<VoiceNewProducerPayload>('voice:new-producer', ({ userId, producerInfo }) => {
    consumeProducer(producerInfo, userId).catch(console.error);
  });

  const unsubProducerClosed = ws.on<VoiceProducerClosedPayload>('voice:producer-closed', ({ producerId }) => {
    // Find consumer(s) with this producerId and close them
    for (const [consumerId, consumer] of consumers) {
      if ((consumer as { producerId?: string }).producerId === producerId) {
        consumer.close();
        consumers.delete(consumerId);
        break;
      }
    }
  });

  const unsubTransportCreated = ws.on<VoiceTransportCreatedPayload>('voice:transport-created', ({ direction, transport }) => {
    if (!transport) return;
    if (direction === 'send') {
      createSendTransport(transport).catch(console.error);
    } else {
      createRecvTransport(transport).catch(console.error);
    }
  });

  return () => {
    unsubNewProducer();
    unsubProducerClosed();
    unsubTransportCreated();
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Close all transports, producers, and consumers.
 */
export function cleanup(): void {
  for (const producer of producers.values()) producer.close();
  producers.clear();

  for (const consumer of consumers.values()) consumer.close();
  consumers.clear();

  sendTransport?.close();
  sendTransport = null;

  recvTransport?.close();
  recvTransport = null;

  remoteStreams.clear();
  device = null;
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export function getRemoteStream(userId: string): MediaStream | undefined {
  return remoteStreams.get(userId);
}

export function getAllRemoteStreams(): Map<string, MediaStream> {
  return new Map(remoteStreams);
}

export function isDeviceLoaded(): boolean {
  return device !== null && device.loaded;
}
