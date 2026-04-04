/**
 * mediasoup-client WebRTC layer.
 *
 * Owns the Device, SendTransport, and RecvTransport for the current session.
 * All signaling goes through the `ws` singleton — this module translates
 * between mediasoup callbacks and WS events.
 *
 * Usage:
 *   const rtc = new RtcSession();
 *   await rtc.init(transportCreatedPayload);   // after voice:transport-created
 *   await rtc.produce(mediaStream);             // send audio/video track
 *   await rtc.consume(producerInfo);            // receive a remote track
 *   rtc.dispose();                              // on voice leave
 */

import { Device } from 'mediasoup-client';
import type { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';
import { ws } from '$lib/api/ws';
import type {
  MediaServerTransport,
  ProducerInfo,
  ConsumerInfo,
} from '@harmony/shared/types/voice';
import type {
  VoiceConnectTransportPayload,
  VoiceProducePayload,
  VoiceConsumedPayload,
} from '@harmony/shared/types/ws-events';

export class RtcSession {
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;

  // producerId → Producer
  private producers = new Map<string, Producer>();
  // consumerId → { consumer, stream }
  private consumers = new Map<string, { consumer: Consumer; stream: MediaStream }>();
  // userId → MediaStream (aggregate of all their consumer streams)
  remoteStreams = new Map<string, MediaStream>();

  private sendTransportData: MediaServerTransport | null = null;
  private recvTransportData: MediaServerTransport | null = null;
  private rtpCapabilities: unknown = null;

  /**
   * Call once per voice session after receiving voice:transport-created.
   * Collects both send and recv transport params, then loads the Device.
   */
  /**
   * Called with the send transport data and the router's RTP capabilities
   * (sent together in the direction='send' voice:transport-created event).
   */
  setSendTransport(data: MediaServerTransport, rtpCapabilities: unknown): void {
    this.sendTransportData = data;
    this.rtpCapabilities = rtpCapabilities;
    this.maybeInit();
  }

  setRecvTransport(data: MediaServerTransport): void {
    this.recvTransportData = data;
    this.maybeInit();
  }

  private async maybeInit(): Promise<void> {
    if (this.device || !this.sendTransportData || !this.recvTransportData || !this.rtpCapabilities) return;
    try {
      await this.init();
    } catch (err) {
      console.warn('[rtc] init failed:', err);
    }
  }

  private async init(): Promise<void> {
    const device = new Device();

    await device.load({ routerRtpCapabilities: this.rtpCapabilities as Parameters<typeof device.load>[0]['routerRtpCapabilities'] });
    this.device = device;

    // ── Send transport ──────────────────────────────────────────────────────
    const st = this.sendTransportData!;
    this.sendTransport = device.createSendTransport({
      id: st.transportId,
      iceParameters: st.iceParameters as Parameters<ReturnType<Device['createSendTransport']>['constructor']>[0]['iceParameters'],
      iceCandidates: st.iceCandidates as Parameters<ReturnType<Device['createSendTransport']>['constructor']>[0]['iceCandidates'],
      dtlsParameters: st.dtlsParameters as Parameters<ReturnType<Device['createSendTransport']>['constructor']>[0]['dtlsParameters'],
    });

    this.sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      try {
        ws.send({
          type: 'voice:connect-transport',
          data: { transportId: st.transportId, dtlsParameters } satisfies VoiceConnectTransportPayload,
        });
        // Resolve immediately; the server doesn't ack this
        callback();
      } catch (err) {
        errback(err as Error);
      }
    });

    this.sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        // The server will respond with voice:produced containing the producerId.
        // We register a one-shot handler here before sending the event.
        const off = ws.on<{ producerId: string }>('voice:produced', ({ producerId }) => {
          off();
          callback({ id: producerId });
        });

        ws.send({
          type: 'voice:produce',
          data: {
            transportId: st.transportId,
            kind,
            rtpParameters,
            appData: appData as Record<string, unknown>,
          } satisfies VoiceProducePayload,
        });
      } catch (err) {
        errback(err as Error);
      }
    });

    // ── Recv transport ──────────────────────────────────────────────────────
    const rt = this.recvTransportData!;
    this.recvTransport = device.createRecvTransport({
      id: rt.transportId,
      iceParameters: rt.iceParameters as Parameters<ReturnType<Device['createRecvTransport']>['constructor']>[0]['iceParameters'],
      iceCandidates: rt.iceCandidates as Parameters<ReturnType<Device['createRecvTransport']>['constructor']>[0]['iceCandidates'],
      dtlsParameters: rt.dtlsParameters as Parameters<ReturnType<Device['createRecvTransport']>['constructor']>[0]['dtlsParameters'],
    });

    this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      try {
        ws.send({
          type: 'voice:connect-transport',
          data: { transportId: rt.transportId, dtlsParameters } satisfies VoiceConnectTransportPayload,
        });
        callback();
      } catch (err) {
        errback(err as Error);
      }
    });
  }

  /**
   * Produce all tracks from a MediaStream on the send transport.
   * Returns the list of created producer IDs.
   */
  async produce(stream: MediaStream): Promise<string[]> {
    if (!this.sendTransport) {
      throw new Error('[rtc] send transport not ready');
    }

    const producerIds: string[] = [];

    for (const track of stream.getTracks()) {
      const producer = await this.sendTransport.produce({
        track,
        appData: { streamType: 'screen', trackKind: track.kind },
      });
      this.producers.set(producer.id, producer);
      producerIds.push(producer.id);

      producer.on('trackended', () => {
        producer.close();
        this.producers.delete(producer.id);
      });
    }

    return producerIds;
  }

  /**
   * Consume a remote producer. Resolves to the MediaStream once the
   * consumer is set up and resumed on the server.
   */
  async consume(info: ProducerInfo, userId: string): Promise<MediaStream> {
    if (!this.recvTransport || !this.device) {
      throw new Error('[rtc] recv transport not ready');
    }

    // Ask the server to create a consumer for us
    ws.send({
      type: 'voice:consume',
      data: { producerId: info.producerId },
    });

    // Wait for voice:consumed with the matching producerId
    const consumerInfo = await new Promise<ConsumerInfo>((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('[rtc] consume timeout'));
      }, 10_000);

      const off = ws.on<VoiceConsumedPayload>('voice:consumed', (payload) => {
        if (payload.consumerInfo.producerId === info.producerId) {
          clearTimeout(timer);
          off();
          resolve(payload.consumerInfo);
        }
      });
    });

    const consumer = await this.recvTransport.consume({
      id: consumerInfo.consumerId,
      producerId: consumerInfo.producerId,
      kind: consumerInfo.kind,
      rtpParameters: consumerInfo.rtpParameters as Parameters<typeof this.recvTransport.consume>[0]['rtpParameters'],
      appData: consumerInfo.appData as Record<string, unknown>,
    });

    // Resume the consumer on the server side
    ws.send({ type: 'voice:resume-consumer', data: { consumerId: consumer.id } });

    const stream = new MediaStream([consumer.track]);
    this.consumers.set(consumer.id, { consumer, stream });

    // Aggregate into the userId → MediaStream map
    const existing = this.remoteStreams.get(userId) ?? new MediaStream();
    existing.addTrack(consumer.track);
    this.remoteStreams.set(userId, existing);

    consumer.on('trackended', () => {
      this.consumers.delete(consumer.id);
      // Rebuild the userId stream without this track
      const tracks = Array.from(this.consumers.values())
        .filter(c => c.consumer.appData?.userId === userId)
        .flatMap(c => c.consumer.track ? [c.consumer.track] : []);
      if (tracks.length === 0) {
        this.remoteStreams.delete(userId);
      } else {
        this.remoteStreams.set(userId, new MediaStream(tracks));
      }
    });

    return stream;
  }

  /**
   * Close all producers and consumers, tear down transports.
   */
  dispose(): void {
    for (const producer of this.producers.values()) {
      try { producer.close(); } catch {}
    }
    this.producers.clear();

    for (const { consumer } of this.consumers.values()) {
      try { consumer.close(); } catch {}
    }
    this.consumers.clear();
    this.remoteStreams.clear();

    try { this.sendTransport?.close(); } catch {}
    try { this.recvTransport?.close(); } catch {}

    this.sendTransport = null;
    this.recvTransport = null;
    this.device = null;
    this.sendTransportData = null;
    this.recvTransportData = null;
    this.rtpCapabilities = null;
  }
}
