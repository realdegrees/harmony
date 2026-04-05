import type { UserStatus } from './user.ts';
import type { Message, MessageReaction } from './message.ts';
import type { Channel } from './channel.ts';
import type { User } from './user.ts';
import type { Notification } from './notification.ts';
import type {
  VoiceState,
  VoiceParticipant,
  MediaServerTransport,
  ProducerInfo,
  ConsumerInfo,
  StreamType,
  StreamConfig,
} from './voice.ts';

// ---------------------------------------------------------------------------
// Client-to-server payload types
// ---------------------------------------------------------------------------

export interface MessageSendPayload {
  channelId: string;
  content: string;
  replyToId?: string;
  attachmentIds?: string[];
}

export interface MessageEditPayload {
  messageId: string;
  content: string;
}

export interface MessageDeletePayload {
  messageId: string;
}

export interface TypingStartPayload {
  channelId: string;
}

export interface TypingStopPayload {
  channelId: string;
}

export interface PresenceUpdatePayload {
  status: UserStatus;
}

export interface VoiceJoinPayload {
  channelId: string;
}

export type VoiceLeavePayload = Record<string, never>;

export interface VoiceMutePayload {
  muted: boolean;
}

export interface VoiceDeafenPayload {
  deafened: boolean;
}

export interface VoiceProducePayload {
  transportId: string;
  kind: 'audio' | 'video';
  rtpParameters: unknown;
  appData: Record<string, unknown>;
}

export interface VoiceConsumePayload {
  producerId: string;
  rtpCapabilities: unknown;
}

export interface VoiceResumeConsumerPayload {
  consumerId: string;
}

export interface VoiceConnectTransportPayload {
  transportId: string;
  dtlsParameters: unknown;
}

export interface StreamStartPayload {
  type: StreamType;
  config: StreamConfig;
}

export type StreamStopPayload = Record<string, never>;

export interface SoundboardPlayPayload {
  clipId: string;
  /** Base64-encoded audio data for locally-sourced clips. */
  clipData?: string;
}

export interface ReactionAddPayload {
  messageId: string;
  emojiId?: string;
  emojiUnicode?: string;
}

export interface ReactionRemovePayload {
  messageId: string;
  emojiId?: string;
  emojiUnicode?: string;
}

export interface ChannelReadAckPayload {
  channelId: string;
  messageId: string;
}

// ---------------------------------------------------------------------------
// Server-to-client payload types
// ---------------------------------------------------------------------------

export interface MessageNewPayload {
  message: Message;
}

export interface MessageUpdatedPayload {
  message: Message;
}

export interface MessageDeletedPayload {
  messageId: string;
  channelId: string;
}

export interface TypingUpdatePayload {
  channelId: string;
  userId: string;
  username: string;
}

export interface PresenceChangedPayload {
  userId: string;
  status: UserStatus;
}

export interface VoiceStateSyncPayload {
  /** Map of channelId → participants currently in that channel. */
  channels: Record<string, VoiceParticipant[]>;
}

export interface VoiceUserJoinedPayload {
  channelId: string;
  participant: VoiceParticipant;
}

export interface VoiceUserLeftPayload {
  channelId: string;
  userId: string;
}

export interface VoiceStateUpdatePayload {
  channelId: string;
  userId: string;
  voiceState: VoiceState;
}

export interface VoiceTransportCreatedPayload {
  direction: 'send' | 'recv';
  transport: MediaServerTransport | null;
  /** Router RTP capabilities — only present on direction='send'. */
  rtpCapabilities?: unknown;
}

export interface VoiceProducedPayload {
  producerId: string;
}

export interface VoiceNewProducerPayload {
  userId: string;
  producerInfo: ProducerInfo;
}

export interface VoiceProducerClosedPayload {
  producerId: string;
}

export interface VoiceConsumedPayload {
  consumerInfo: ConsumerInfo;
}

export interface StreamStartedPayload {
  channelId: string;
  userId: string;
  streamType: StreamType;
}

export interface StreamStoppedPayload {
  channelId: string;
  userId: string;
}

export interface SoundboardPlayingPayload {
  channelId: string;
  userId: string;
  clipName: string;
  /** Duration of the clip in seconds. Used by clients to auto-clear the indicator. */
  duration?: number;
  /** Relative URL for server clips so receivers can fetch and play the audio. */
  clipUrl?: string;
  /** Base64-encoded audio data for locally-sourced clips. */
  clipData?: string;
  /** True when the user explicitly stopped playback. */
  stopped?: boolean;
}

export interface ReactionAddedPayload {
  messageId: string;
  channelId: string;
  reaction: MessageReaction;
}

export interface ReactionRemovedPayload {
  messageId: string;
  channelId: string;
  emojiId?: string;
  emojiUnicode?: string;
  userId: string;
}

export interface NotificationNewPayload {
  notification: Notification;
}

export interface ChannelCreatedPayload {
  channel: Channel;
}

export interface ChannelUpdatedPayload {
  channel: Channel;
}

export interface ChannelDeletedPayload {
  channelId: string;
}

export interface UserUpdatedPayload {
  user: User;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Discriminated union types
// ---------------------------------------------------------------------------

export type ClientEvent =
  | { type: 'message:send'; data: MessageSendPayload }
  | { type: 'message:edit'; data: MessageEditPayload }
  | { type: 'message:delete'; data: MessageDeletePayload }
  | { type: 'typing:start'; data: TypingStartPayload }
  | { type: 'typing:stop'; data: TypingStopPayload }
  | { type: 'presence:update'; data: PresenceUpdatePayload }
  | { type: 'voice:join'; data: VoiceJoinPayload }
  | { type: 'voice:leave'; data: VoiceLeavePayload }
  | { type: 'voice:mute'; data: VoiceMutePayload }
  | { type: 'voice:deafen'; data: VoiceDeafenPayload }
  | { type: 'voice:produce'; data: VoiceProducePayload }
  | { type: 'voice:consume'; data: VoiceConsumePayload }
  | { type: 'voice:resume-consumer'; data: VoiceResumeConsumerPayload }
  | { type: 'voice:connect-transport'; data: VoiceConnectTransportPayload }
  | { type: 'stream:start'; data: StreamStartPayload }
  | { type: 'stream:stop'; data: StreamStopPayload }
  | { type: 'soundboard:play'; data: SoundboardPlayPayload }
  | { type: 'reaction:add'; data: ReactionAddPayload }
  | { type: 'reaction:remove'; data: ReactionRemovePayload }
  | { type: 'channel:read-ack'; data: ChannelReadAckPayload };

export type ServerEvent =
  | { type: 'message:new'; data: MessageNewPayload }
  | { type: 'message:updated'; data: MessageUpdatedPayload }
  | { type: 'message:deleted'; data: MessageDeletedPayload }
  | { type: 'typing:update'; data: TypingUpdatePayload }
  | { type: 'presence:changed'; data: PresenceChangedPayload }
  | { type: 'voice:user-joined'; data: VoiceUserJoinedPayload }
  | { type: 'voice:user-left'; data: VoiceUserLeftPayload }
  | { type: 'voice:state-update'; data: VoiceStateUpdatePayload }
  | { type: 'voice:transport-created'; data: VoiceTransportCreatedPayload }
  | { type: 'voice:produced'; data: VoiceProducedPayload }
  | { type: 'voice:new-producer'; data: VoiceNewProducerPayload }
  | { type: 'voice:producer-closed'; data: VoiceProducerClosedPayload }
  | { type: 'voice:consumed'; data: VoiceConsumedPayload }
  | { type: 'stream:started'; data: StreamStartedPayload }
  | { type: 'stream:stopped'; data: StreamStoppedPayload }
  | { type: 'soundboard:playing'; data: SoundboardPlayingPayload }
  | { type: 'reaction:added'; data: ReactionAddedPayload }
  | { type: 'reaction:removed'; data: ReactionRemovedPayload }
  | { type: 'notification:new'; data: NotificationNewPayload }
  | { type: 'channel:created'; data: ChannelCreatedPayload }
  | { type: 'channel:updated'; data: ChannelUpdatedPayload }
  | { type: 'channel:deleted'; data: ChannelDeletedPayload }
  | { type: 'user:updated'; data: UserUpdatedPayload }
  | { type: 'error'; data: ErrorPayload };
