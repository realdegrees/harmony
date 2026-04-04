import { ws } from '$lib/api/ws';
import type { VoiceParticipant, StreamType, StreamConfig } from '@harmony/shared/types/voice';
import type {
  VoiceUserJoinedPayload,
  VoiceUserLeftPayload,
  VoiceStateUpdatePayload,
  StreamStartedPayload,
  StreamStoppedPayload,
} from '@harmony/shared/types/ws-events';

class VoiceStore {
  currentChannelId = $state<string | null>(null);
  participants = $state(new Map<string, VoiceParticipant[]>());
  localMuted = $state(false);
  localDeafened = $state(false);
  isStreaming = $state(false);

  constructor() {
    ws.on<VoiceUserJoinedPayload>('voice:user-joined', (data) => {
      const existing = this.participants.get(data.channelId) ?? [];
      // Avoid duplicates
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
        existing.filter((p) => p.userId !== data.userId)
      );
    });

    ws.on<VoiceStateUpdatePayload>('voice:state-update', (data) => {
      const existing = this.participants.get(data.channelId);
      if (!existing) return;

      this.participants = new Map(this.participants).set(
        data.channelId,
        existing.map((p) =>
          p.userId === data.userId ? { ...p, voiceState: data.voiceState } : p
        )
      );
    });

    ws.on<StreamStartedPayload>('stream:started', (data) => {
      // Mark streaming state for the user in that channel
      const existing = this.participants.get(data.channelId);
      if (!existing) return;
      this.participants = new Map(this.participants).set(
        data.channelId,
        existing.map((p) =>
          p.userId === data.userId
            ? { ...p, voiceState: { ...p.voiceState, streaming: true, streamType: data.streamType } }
            : p
        )
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
            : p
        )
      );
    });
  }

  joinChannel(id: string): void {
    this.currentChannelId = id;
    ws.send({ type: 'voice:join', data: { channelId: id } });
  }

  leaveChannel(): void {
    if (!this.currentChannelId) return;
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
    // Deafening also mutes
    if (this.localDeafened && !this.localMuted) {
      this.localMuted = true;
      ws.send({ type: 'voice:mute', data: { muted: true } });
    }
    ws.send({ type: 'voice:deafen', data: { deafened: this.localDeafened } });
  }

  startStream(type: StreamType, config: StreamConfig): void {
    this.isStreaming = true;
    ws.send({ type: 'stream:start', data: { type, config } });
  }

  stopStream(): void {
    this.isStreaming = false;
    ws.send({ type: 'stream:stop', data: {} });
  }

  getChannelParticipants(channelId: string): VoiceParticipant[] {
    return this.participants.get(channelId) ?? [];
  }
}

export const voice = new VoiceStore();
