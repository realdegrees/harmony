/**
 * mediasoup-client WebRTC layer.
 */

import { Device } from 'mediasoup-client';
import type { Transport, Producer, Consumer, DtlsParameters, RtpParameters, AppData, MediaKind } from 'mediasoup-client/types';
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

  private producers = new Map<string, Producer>();
  private consumers = new Map<string, { consumer: Consumer; stream: MediaStream }>();
  remoteStreams = new Map<string, MediaStream>();

  private sendTransportData: MediaServerTransport | null = null;
  private recvTransportData: MediaServerTransport | null = null;
  private rtpCapabilities: unknown = null;

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

    const st = this.sendTransportData!;
    this.sendTransport = device.createSendTransport({
      id: st.transportId,
      iceParameters: st.iceParameters as any,
      iceCandidates: st.iceCandidates as any,
      dtlsParameters: st.dtlsParameters as any,
    });

    this.sendTransport.on('connect', (
      { dtlsParameters }: { dtlsParameters: DtlsParameters },
      callback: () => void,
      errback: (err: Error) => void,
    ) => {
      try {
        ws.send({
          type: 'voice:connect-transport',
          data: { transportId: st.transportId, dtlsParameters } satisfies VoiceConnectTransportPayload,
        });
        callback();
      } catch (err) {
        errback(err as Error);
      }
    });

    this.sendTransport.on('produce', (
      { kind, rtpParameters, appData }: { kind: MediaKind; rtpParameters: RtpParameters; appData: AppData },
      callback: (p: { id: string }) => void,
      errback: (err: Error) => void,
    ) => {
      try {
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

    const rt = this.recvTransportData!;
    this.recvTransport = device.createRecvTransport({
      id: rt.transportId,
      iceParameters: rt.iceParameters as any,
      iceCandidates: rt.iceCandidates as any,
      dtlsParameters: rt.dtlsParameters as any,
    });

    this.recvTransport.on('connect', (
      { dtlsParameters }: { dtlsParameters: DtlsParameters },
      callback: () => void,
      errback: (err: Error) => void,
    ) => {
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

  async produceMic(stream: MediaStream): Promise<string> {
    if (!this.sendTransport) throw new Error('[rtc] send transport not ready');
    const track = stream.getAudioTracks()[0];
    if (!track) throw new Error('[rtc] no audio track in mic stream');
    const producer = await this.sendTransport.produce({
      track,
      appData: { streamType: 'mic', trackKind: 'audio' },
    });
    this.producers.set(producer.id, producer);
    producer.on('trackended', () => {
      producer.close();
      this.producers.delete(producer.id);
    });
    return producer.id;
  }

  async produce(stream: MediaStream): Promise<string[]> {
    if (!this.sendTransport) throw new Error('[rtc] send transport not ready');
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

  async consume(info: ProducerInfo, userId: string): Promise<MediaStream> {
    if (!this.recvTransport || !this.device) throw new Error('[rtc] recv transport not ready');

    ws.send({ type: 'voice:consume', data: { producerId: info.producerId, rtpCapabilities: this.device.rtpCapabilities } });

    const consumerInfo = await new Promise<ConsumerInfo>((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error('[rtc] consume timeout')); }, 10_000);
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
      rtpParameters: consumerInfo.rtpParameters as any,
      appData: consumerInfo.appData as Record<string, unknown>,
    });

    ws.send({ type: 'voice:resume-consumer', data: { consumerId: consumer.id } });

    const stream = new MediaStream([consumer.track]);
    this.consumers.set(consumer.id, { consumer, stream });

    const existing = this.remoteStreams.get(userId) ?? new MediaStream();
    existing.addTrack(consumer.track);
    this.remoteStreams.set(userId, existing);

    consumer.on('trackended', () => {
      this.consumers.delete(consumer.id);
      const tracks = Array.from(this.consumers.values())
        .filter(c => c.consumer.appData?.['userId'] === userId)
        .flatMap(c => c.consumer.track ? [c.consumer.track] : []);
      if (tracks.length === 0) {
        this.remoteStreams.delete(userId);
      } else {
        this.remoteStreams.set(userId, new MediaStream(tracks));
      }
    });

    return stream;
  }

  dispose(): void {
    for (const producer of this.producers.values()) { try { producer.close(); } catch {} }
    this.producers.clear();
    for (const { consumer } of this.consumers.values()) { try { consumer.close(); } catch {} }
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
