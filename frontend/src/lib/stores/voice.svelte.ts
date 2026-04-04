import { ws } from '$lib/api/ws';
import { getStreamByType } from '$lib/voice/streaming';
import { RtcSession } from '$lib/voice/rtc';
import type { VoiceParticipant, StreamType, StreamConfig, MediaServerTransport } from '@harmony/shared/types/voice';
import type {
  VoiceUserJoinedPayload,
  VoiceUserLeftPayload,
  VoiceStateUpdatePayload,
  VoiceTransportCreatedPayload,
  VoiceNewProducerPayload,
  StreamStartedPayload,
  StreamStoppedPayload,
} from '@harmony/shared/types/ws-events';

const PREFS_KEY = 'harmony:audio-prefs';

interface AudioPrefs {
  microphoneId: string | null;
  speakerId: string | null;
}

function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as AudioPrefs;
  } catch {}
  return { microphoneId: null, speakerId: null };
}

class VoiceStore {
  currentChannelId = $state<string | null>(null);
  participants = $state(new Map<string, VoiceParticipant[]>());
  localMuted = $state(false);
  localDeafened = $state(false);
  isStreaming = $state(false);

  // Reactive map of userId → remote MediaStream (populated as consumers are set up)
  remoteStreams = $state(new Map<string, MediaStream>());

  // The local screen/camera capture stream
  private activeStream: MediaStream | null = null;

  // mediasoup session — one per voice channel connection
  private rtc: RtcSession | null = null;

  // Preferred audio device IDs (null = system default)
  preferredMicrophoneId = $state<string | null>(null);
  preferredSpeakerId = $state<string | null>(null);

  constructor() {
    if (typeof window !== 'undefined') {
      const prefs = loadAudioPrefs();
      this.preferredMicrophoneId = prefs.microphoneId;
      this.preferredSpeakerId = prefs.speakerId;
    }

    // ── Error handling ──────────────────────────────────────────────────────
    ws.on<{ code: string; message: string }>('error', (data) => {
      if (data.code === 'VOICE_JOIN_FAILED') {
        this.currentChannelId = null;
        this.localMuted = false;
        this.localDeafened = false;
      }
    });

    // ── Room presence ───────────────────────────────────────────────────────
    ws.on<VoiceUserJoinedPayload>('voice:user-joined', (data) => {
      const existing = this.participants.get(data.channelId) ?? [];
      if (!existing.some((p) => p.userId === data.participant.userId)) {
        this.participants = new Map(this.participants).set(data.channelId, [
          ...existing,
          data.participant,
        ]);
      }
    });

    ws.on<VoiceUserLeftPayload>('voice:user-left', (data) => {
      const existing = this.participants.get(data.channelId) ?? [];
      this.participants = new Map(this.participants).set(
        data.channelId,
        existing.filter((p) => p.userId !== data.userId),
      );
      // Clean up any remote stream for this user
      const streams = new Map(this.remoteStreams);
      streams.delete(data.userId);
      this.remoteStreams = streams;
    });

    ws.on<VoiceStateUpdatePayload>('voice:state-update', (data) => {
      const existing = this.participants.get(data.channelId);
      if (!existing) return;
      this.participants = new Map(this.participants).set(
        data.channelId,
        existing.map((p) => p.userId === data.userId ? { ...p, voiceState: data.voiceState } : p),
      );
    });

    // ── Transport setup ─────────────────────────────────────────────────────
    // The backend sends two voice:transport-created events after voice:join —
    // one for 'send' and one for 'recv'. We feed both into the RtcSession
    // which waits until it has both before initialising the mediasoup Device.
    ws.on<VoiceTransportCreatedPayload>('voice:transport-created', (data) => {
      if (!this.rtc) return;
      if (!data.transport) {
        // Media server unavailable — skip RTC init silently, voice room still works
        return;
      }
      if (data.direction === 'send') {
        this.rtc.setSendTransport(data.transport, data.rtpCapabilities);
      } else {
        this.rtc.setRecvTransport(data.transport);
      }
    });

    // The backend also sends rtpCapabilities inside the send transport payload.
    // mediasoup-client needs them to load the Device. We piggyback on the
    // voice:transport-created send event's transport object which contains them
    // under `rtpCapabilities` (set by the media server's createRouter response).
    // The RtcSession.maybeInit() handles the ordering automatically.

    // ── Producer / Consumer ─────────────────────────────────────────────────
    // When another participant starts producing (after stream:started), we
    // consume their track so we can display it.
    ws.on<VoiceNewProducerPayload>('voice:new-producer', async (data) => {
      if (!this.rtc) return;
      try {
        const stream = await this.rtc.consume(data.producerInfo, data.userId);
        const streams = new Map(this.remoteStreams);
        streams.set(data.userId, stream);
        this.remoteStreams = streams;
      } catch (err) {
        console.warn('[voice] Failed to consume producer from', data.userId, err);
      }
    });

    // ── Stream state ────────────────────────────────────────────────────────
    ws.on<StreamStartedPayload>('stream:started', (data) => {
      const existing = this.participants.get(data.channelId);
      if (!existing) return;
      this.participants = new Map(this.participants).set(
        data.channelId,
        existing.map((p) =>
          p.userId === data.userId
            ? { ...p, voiceState: { ...p.voiceState, streaming: true, streamType: data.streamType } }
            : p,
        ),
      );
    });

    ws.on<StreamStoppedPayload>('stream:stopped', (data) => {
      const existing = this.participants.get(data.channelId);
      if (!existing) return;
      this.participants = new Map(this.participants).set(
        data.channelId,
        existing.map((p) =>
          p.userId === data.userId
            ? { ...p, voiceState: { ...p.voiceState, streaming: false, streamType: null } }
            : p,
        ),
      );
      // Remove their remote stream when they stop
      const streams = new Map(this.remoteStreams);
      streams.delete(data.userId);
      this.remoteStreams = streams;
    });
  }

  // ── Public actions ──────────────────────────────────────────────────────

  joinChannel(id: string): void {
    this.rtc = new RtcSession();
    this.currentChannelId = id;
    ws.send({ type: 'voice:join', data: { channelId: id } });
  }

  leaveChannel(): void {
    if (!this.currentChannelId) return;

    if (this.activeStream) {
      this.activeStream.getTracks().forEach((t) => t.stop());
      this.activeStream = null;
    }

    this.rtc?.dispose();
    this.rtc = null;
    this.remoteStreams = new Map();

    ws.send({ type: 'voice:leave', data: {} });
    this.currentChannelId = null;
    this.localMuted = false;
    this.localDeafened = false;
    this.isStreaming = false;
  }

  toggleMute(): void {
    this.localMuted = !this.localMuted;
    ws.send({ type: 'voice:mute', data: { muted: this.localMuted } });
  }

  toggleDeafen(): void {
    this.localDeafened = !this.localDeafened;
    if (this.localDeafened && !this.localMuted) {
      this.localMuted = true;
      ws.send({ type: 'voice:mute', data: { muted: true } });
    }
    ws.send({ type: 'voice:deafen', data: { deafened: this.localDeafened } });
  }

  async startStream(type: StreamType, config: StreamConfig): Promise<void> {
    // Open the browser screen/camera picker — throws if user cancels
    const stream = await getStreamByType(config);

    // Stop stream automatically if the user clicks the browser's "Stop sharing" button
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (this.isStreaming) this.stopStream();
      }, { once: true });
    }

    this.activeStream = stream;
    this.isStreaming = true;

    // Notify server that streaming has started (broadcasts stream:started to channel)
    ws.send({ type: 'stream:start', data: { type, config } });

    // Produce the tracks over WebRTC so other clients can consume them
    if (this.rtc) {
      try {
        await this.rtc.produce(stream);
      } catch (err) {
        console.warn('[voice] RTC produce failed (media server may be down):', err);
        // Stream state / LIVE badge still works via WS broadcast even without WebRTC
      }
    }
  }

  stopStream(): void {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((t) => t.stop());
      this.activeStream = null;
    }
    this.isStreaming = false;
    ws.send({ type: 'stream:stop', data: {} });
  }

  getChannelParticipants(channelId: string): VoiceParticipant[] {
    return this.participants.get(channelId) ?? [];
  }

  setPreferredMicrophone(deviceId: string | null): void {
    this.preferredMicrophoneId = deviceId;
    this.saveAudioPrefs();
  }

  setPreferredSpeaker(deviceId: string | null): void {
    this.preferredSpeakerId = deviceId;
    this.saveAudioPrefs();
  }

  private saveAudioPrefs(): void {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          microphoneId: this.preferredMicrophoneId,
          speakerId: this.preferredSpeakerId,
        } satisfies AudioPrefs),
      );
    } catch {}
  }
}

export const voice = new VoiceStore();
