export enum StreamType {
  CAMERA = 'camera',
  SCREEN = 'screen',
  WINDOW = 'window',
}

export interface VoiceState {
  userId: string;
  channelId: string;
  muted: boolean;
  deafened: boolean;
  serverMuted: boolean;
  serverDeafened: boolean;
  streaming: boolean;
  streamType: StreamType | null;
}

export interface VoiceParticipant {
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarPath: string | null;
  };
  voiceState: VoiceState;
}

export interface MediaServerTransport {
  transportId: string;
  iceParameters: unknown;
  iceCandidates: unknown;
  dtlsParameters: unknown;
}

export interface ProducerInfo {
  producerId: string;
  kind: 'audio' | 'video';
  appData: Record<string, unknown>;
}

export interface ConsumerInfo {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: unknown;
  appData: Record<string, unknown>;
}

export interface StreamConfig {
  type: StreamType;
  maxBitrate: number;
  maxFramerate: number;
  width?: number;
  height?: number;
}
