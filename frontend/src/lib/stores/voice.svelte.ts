import { ws } from '$lib/api/ws';
import { getStreamByType } from '$lib/voice/streaming';
import { getMicrophoneStream, watchSpeaking, getAudioContext, toggleMute as setMicMuted } from '$lib/voice/audio';
import { RtcSession } from '$lib/voice/rtc';
import { auth } from '$lib/stores/auth.svelte';
import type { VoiceParticipant, StreamType, StreamConfig, MediaServerTransport } from '@harmony/shared/types/voice';
import type {
  VoiceStateSyncPayload,
  VoiceUserJoinedPayload,
  VoiceUserLeftPayload,
  VoiceStateUpdatePayload,
  VoiceTransportCreatedPayload,
  VoiceNewProducerPayload,
  StreamStartedPayload,
  StreamStoppedPayload,
  SoundboardPlayingPayload,
} from '@harmony/shared/types/ws-events';

const PREFS_KEY = 'harmony:audio-prefs';

interface AudioPrefs {
  microphoneId: string | null;
  speakerId: string | null;
  soundboardVolume: number;
}

function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as AudioPrefs;
  } catch {}
  return { microphoneId: null, speakerId: null, soundboardVolume: 1 };
}

class VoiceStore {
  currentChannelId = $state<string | null>(null);
  participants = $state(new Map<string, VoiceParticipant[]>());
  localMuted = $state(false);
  localDeafened = $state(false);
  isStreaming = $state(false);

  // Reactive map of userId → remote MediaStream (populated as consumers are set up)
  remoteStreams = $state(new Map<string, MediaStream>());

  // Hidden <audio> elements that play remote streams — one per remote user
  private audioElements = new Map<string, HTMLAudioElement>();

  // Per-user volume (0–2, where 1 = 100%). Persisted in-memory only.
  private userVolumes = new Map<string, number>();

  // The local screen/camera capture stream
  private activeStream: MediaStream | null = null;

  // Microphone stream used for speaking detection
  private micStream: MediaStream | null = null;

  // Cleanup functions for watchSpeaking pollers (keyed by userId)
  private speakingWatchers = new Map<string, () => void>();

  // Set of userIds currently speaking
  speakingUsers = $state(new Set<string>());

  // Map of userId → clip name for users currently playing a soundboard clip
  soundboardPlayingUsers = $state(new Map<string, string>());
  // Timers to auto-clear soundboard indicator after clip duration
  private soundboardTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Audio elements for incoming soundboard clips (keyed by userId)
  private soundboardAudios = new Map<string, HTMLAudioElement>();

  // mediasoup session — one per voice channel connection
  private rtc: RtcSession | null = null;

  // Preferred audio device IDs (null = system default)
  preferredMicrophoneId = $state<string | null>(null);
  preferredSpeakerId = $state<string | null>(null);
  // Volume for both outgoing and incoming soundboard audio (0–1)
  soundboardVolume = $state(1);

  constructor() {
    if (typeof window !== 'undefined') {
      const prefs = loadAudioPrefs();
      this.preferredMicrophoneId = prefs.microphoneId;
      this.preferredSpeakerId = prefs.speakerId;
      this.soundboardVolume = prefs.soundboardVolume ?? 1;
    }

    // ── Error handling ──────────────────────────────────────────────────────
    ws.on<{ code: string; message: string }>('error', (data) => {
      if (data.code === 'VOICE_JOIN_FAILED') {
        this.currentChannelId = null;
        this.localMuted = false;
        this.localDeafened = false;
      }
    });

    // ── Initial voice state snapshot ────────────────────────────────────────
    ws.on<VoiceStateSyncPayload>('voice:state-sync', (data) => {
      const map = new Map<string, VoiceParticipant[]>();
      for (const [channelId, participants] of Object.entries(data.channels)) {
        if (participants.length > 0) map.set(channelId, participants);
      }
      this.participants = map;
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
      // Clean up any remote stream and audio element for this user
      const streams = new Map(this.remoteStreams);
      streams.delete(data.userId);
      this.remoteStreams = streams;
      this.removeRemoteAudio(data.userId);
      // Stop their speaking watcher
      this.speakingWatchers.get(data.userId)?.();
      this.speakingWatchers.delete(data.userId);
      const next = new Set(this.speakingUsers);
      next.delete(data.userId);
      this.speakingUsers = next;
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
      // Don't consume our own producers
      if (data.userId === auth.user?.id) return;
      try {
        // Ensure the Device and transports are fully initialized before consuming
        await this.rtc.whenReady();
        const stream = await this.rtc.consume(data.producerInfo, data.userId);
        const streams = new Map(this.remoteStreams);
        streams.set(data.userId, stream);
        this.remoteStreams = streams;

        // Play audio via a hidden <audio> element
        if (data.producerInfo.kind === 'audio') {
          this.playRemoteStream(data.userId, stream);
          this.startSpeakingWatcher(data.userId, stream);
        }
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

    ws.on<SoundboardPlayingPayload>('soundboard:playing', (data) => {
      // Stop any existing audio for this user
      const existing = this.soundboardAudios.get(data.userId);
      if (existing) { existing.pause(); existing.src = ''; this.soundboardAudios.delete(data.userId); }
      if (this.soundboardTimers.has(data.userId)) {
        clearTimeout(this.soundboardTimers.get(data.userId)!);
        this.soundboardTimers.delete(data.userId);
      }

      // If this is a stop event, clear the indicator and bail
      if (data.stopped) {
        const m = new Map(this.soundboardPlayingUsers);
        m.delete(data.userId);
        this.soundboardPlayingUsers = m;
        return;
      }

      // Update the indicator map
      const next = new Map(this.soundboardPlayingUsers);
      next.set(data.userId, data.clipName);
      this.soundboardPlayingUsers = next;

      // Play audio for other users' clips (sender plays locally in Soundboard.svelte)
      if (data.userId !== auth.user?.id) {
        let audioUrl: string | null = null;
        let isObjectUrl = false;

        if (data.clipUrl) {
          audioUrl = data.clipUrl;
        } else if (data.clipData) {
          // Decode base64 local clip
          const binary = atob(data.clipData);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/ogg' });
          audioUrl = URL.createObjectURL(blob);
          isObjectUrl = true;
        }

        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.volume = this.soundboardVolume;
          audio.onended = () => {
            if (isObjectUrl) URL.revokeObjectURL(audioUrl!);
            this.soundboardAudios.delete(data.userId);
          };
          audio.play().catch(() => {});
          this.soundboardAudios.set(data.userId, audio);
        }
      }

      // Auto-clear indicator after duration
      const clearAfter = data.duration != null ? data.duration * 1000 + 500 : 30_000;
      this.soundboardTimers.set(data.userId, setTimeout(() => {
        const m = new Map(this.soundboardPlayingUsers);
        m.delete(data.userId);
        this.soundboardPlayingUsers = m;
        this.soundboardTimers.delete(data.userId);
      }, clearAfter));
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
    const rtc = new RtcSession();
    this.rtc = rtc;
    this.currentChannelId = id;
    ws.send({ type: 'voice:join', data: { channelId: id } });

    // Get mic once — use it for both speaking detection and audio production
    if (typeof navigator !== 'undefined') {
      // Resume the shared AudioContext now (we're inside a user gesture)
      getAudioContext().resume().catch(() => {});

      getMicrophoneStream(this.preferredMicrophoneId ?? undefined)
        .then(async (stream) => {
          this.micStream = stream;
          const selfId = auth.user?.id;
          if (selfId) {
            this.startSpeakingWatcher(selfId, stream);
          }
          // Wait for RTC transports to be fully ready, then produce mic audio
          await rtc.whenReady();
          await rtc.produceMic(stream);
        })
        .catch((err) => {
          console.warn('[voice] Mic setup failed:', err);
        });
    }
  }

  leaveChannel(): void {
    if (!this.currentChannelId) return;

    if (this.activeStream) {
      this.activeStream.getTracks().forEach((t) => t.stop());
      this.activeStream = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    // Stop all speaking watchers
    for (const cleanup of this.speakingWatchers.values()) cleanup();
    this.speakingWatchers.clear();
    this.speakingUsers = new Set();

    // Clear soundboard timers and stop any playing soundboard audio
    for (const t of this.soundboardTimers.values()) clearTimeout(t);
    this.soundboardTimers.clear();
    for (const audio of this.soundboardAudios.values()) { audio.pause(); audio.src = ''; }
    this.soundboardAudios.clear();
    this.soundboardPlayingUsers = new Map();

    this.rtc?.dispose();
    this.rtc = null;
    this.remoteStreams = new Map();

    // Remove all hidden audio elements
    for (const userId of this.audioElements.keys()) this.removeRemoteAudio(userId);

    ws.send({ type: 'voice:leave', data: {} });
    this.currentChannelId = null;
    this.localMuted = false;
    this.localDeafened = false;
    this.isStreaming = false;
  }

  private playRemoteStream(userId: string, stream: MediaStream): void {
    // Remove any existing audio element for this user
    const old = this.audioElements.get(userId);
    if (old) { old.srcObject = null; old.remove(); }
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.srcObject = stream;
    audio.volume = Math.min(1, this.userVolumes.get(userId) ?? 1);
    audio.muted = this.localDeafened;
    document.body.appendChild(audio);
    this.audioElements.set(userId, audio);
  }

  private removeRemoteAudio(userId: string): void {
    const audio = this.audioElements.get(userId);
    if (audio) { audio.srcObject = null; audio.remove(); this.audioElements.delete(userId); }
  }

  private startSpeakingWatcher(userId: string, stream: MediaStream): void {
    // Clean up any existing watcher for this user
    this.speakingWatchers.get(userId)?.();
    const cleanup = watchSpeaking(stream, (speaking) => {
      const next = new Set(this.speakingUsers);
      if (speaking) next.add(userId);
      else next.delete(userId);
      this.speakingUsers = next;
    });
    this.speakingWatchers.set(userId, cleanup);
  }

  toggleMute(): void {
    // If currently deafened, unmuting must also undeafen
    if (this.localDeafened && this.localMuted) {
      this.localDeafened = false;
      this.localMuted = false;
      if (this.micStream) setMicMuted(this.micStream, false);
      this.setRemoteAudioDeafened(false);
      ws.send({ type: 'voice:deafen', data: { deafened: false } });
      ws.send({ type: 'voice:mute', data: { muted: false } });
      return;
    }
    this.localMuted = !this.localMuted;
    if (this.micStream) setMicMuted(this.micStream, this.localMuted);
    ws.send({ type: 'voice:mute', data: { muted: this.localMuted } });
  }

  toggleDeafen(): void {
    this.localDeafened = !this.localDeafened;
    this.setRemoteAudioDeafened(this.localDeafened);
    // Deafening also mutes
    if (this.localDeafened && !this.localMuted) {
      this.localMuted = true;
      if (this.micStream) setMicMuted(this.micStream, true);
      ws.send({ type: 'voice:mute', data: { muted: true } });
    } else if (!this.localDeafened) {
      // Undeafening restores mic to current mute state
      if (this.micStream) setMicMuted(this.micStream, this.localMuted);
    }
    ws.send({ type: 'voice:deafen', data: { deafened: this.localDeafened } });
  }

  private setRemoteAudioDeafened(deafened: boolean): void {
    for (const audio of this.audioElements.values()) {
      audio.muted = deafened;
    }
  }

  setUserVolume(userId: string, volume: number): void {
    // volume is 0–2 (0–200%)
    this.userVolumes.set(userId, volume);
    const audio = this.audioElements.get(userId);
    if (audio) audio.volume = Math.min(1, volume); // HTMLAudioElement.volume clamps 0–1
    // For volumes above 100% we'd need a GainNode — skip for now, clamp at 1
  }

  getUserVolume(userId: string): number {
    return this.userVolumes.get(userId) ?? 1;
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

  setSoundboardVolume(volume: number): void {
    this.soundboardVolume = volume;
    // Update any currently playing incoming soundboard audios
    for (const audio of this.soundboardAudios.values()) {
      audio.volume = volume;
    }
    this.saveAudioPrefs();
  }

  private saveAudioPrefs(): void {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          microphoneId: this.preferredMicrophoneId,
          speakerId: this.preferredSpeakerId,
          soundboardVolume: this.soundboardVolume,
        } satisfies AudioPrefs),
      );
    } catch {}
  }
}

export const voice = new VoiceStore();
