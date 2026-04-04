import { getUserVoiceState, updateVoiceState } from './rooms';
import type { StreamType, StreamConfig } from '@harmony/shared/types/voice';

interface StreamState {
  userId: string;
  channelId: string;
  streamType: StreamType;
  config: StreamConfig;
  startedAt: Date;
}

// In-memory map of userId -> StreamState
const activeStreams = new Map<string, StreamState>();

export async function startStream(
  userId: string,
  type: StreamType,
  config: StreamConfig,
): Promise<void> {
  const voiceState = await getUserVoiceState(userId);
  if (!voiceState) {
    throw new Error('User is not in a voice channel');
  }

  const streamState: StreamState = {
    userId,
    channelId: voiceState.channelId,
    streamType: type,
    config,
    startedAt: new Date(),
  };

  activeStreams.set(userId, streamState);

  await updateVoiceState(userId, {
    streaming: true,
    streamType: type,
  });
}

export async function stopStream(userId: string): Promise<void> {
  activeStreams.delete(userId);

  await updateVoiceState(userId, {
    streaming: false,
    streamType: null,
  });
}

export async function getActiveStreams(
  channelId: string,
): Promise<Array<{ userId: string; streamType: StreamType }>> {
  const result: Array<{ userId: string; streamType: StreamType }> = [];

  for (const [userId, stream] of activeStreams) {
    if (stream.channelId === channelId) {
      result.push({ userId, streamType: stream.streamType });
    }
  }

  return result;
}
