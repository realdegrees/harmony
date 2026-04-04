import { getRedis } from '../utils/redis';
import type { VoiceState, VoiceParticipant } from '@harmony/shared/types/voice';
import { db } from '../db/client';

const REDIS_KEY_PREFIX = 'voice:state:';

// In-memory map: userId -> VoiceState
const voiceStateMap = new Map<string, VoiceState>();

function redisKey(userId: string): string {
  return `${REDIS_KEY_PREFIX}${userId}`;
}

function defaultVoiceState(userId: string, channelId: string): VoiceState {
  return {
    userId,
    channelId,
    muted: false,
    deafened: false,
    serverMuted: false,
    serverDeafened: false,
    streaming: false,
    streamType: null,
  };
}

async function persistToRedis(state: VoiceState): Promise<void> {
  const redis = getRedis();
  await redis.set(redisKey(state.userId), JSON.stringify(state), 'EX', 86400);
}

async function removeFromRedis(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(redisKey(userId));
}

async function loadFromRedis(userId: string): Promise<VoiceState | null> {
  const redis = getRedis();
  const raw = await redis.get(redisKey(userId));
  if (!raw) return null;
  return JSON.parse(raw) as VoiceState;
}

export async function joinVoiceChannel(userId: string, channelId: string): Promise<VoiceState> {
  // If already in a channel, leave it first
  const existing = voiceStateMap.get(userId);
  if (existing && existing.channelId !== channelId) {
    await leaveVoiceChannel(userId);
  }

  const state = defaultVoiceState(userId, channelId);
  voiceStateMap.set(userId, state);
  await persistToRedis(state);
  return state;
}

export async function leaveVoiceChannel(userId: string): Promise<{ channelId: string } | null> {
  const state = voiceStateMap.get(userId);
  if (!state) {
    // Try Redis for crash recovery
    const redisState = await loadFromRedis(userId);
    if (!redisState) return null;
    await removeFromRedis(userId);
    return { channelId: redisState.channelId };
  }

  const { channelId } = state;
  voiceStateMap.delete(userId);
  await removeFromRedis(userId);
  return { channelId };
}

export async function getVoiceChannelParticipants(channelId: string): Promise<VoiceParticipant[]> {
  // Collect all users in the given channel from memory
  const participants: VoiceParticipant[] = [];
  const userIds: string[] = [];

  for (const [uid, state] of voiceStateMap) {
    if (state.channelId === channelId) {
      userIds.push(uid);
    }
  }

  if (userIds.length === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, displayName: true, avatarPath: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  for (const userId of userIds) {
    const user = userMap.get(userId);
    const voiceState = voiceStateMap.get(userId);
    if (!user || !voiceState) continue;

    participants.push({
      userId,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarPath: user.avatarPath,
      },
      voiceState,
    });
  }

  return participants;
}

export async function updateVoiceState(
  userId: string,
  update: Partial<VoiceState>,
): Promise<VoiceState | null> {
  let state = voiceStateMap.get(userId);

  if (!state) {
    // Try restoring from Redis
    state = (await loadFromRedis(userId)) ?? undefined;
    if (!state) return null;
    voiceStateMap.set(userId, state);
  }

  const updated: VoiceState = { ...state, ...update, userId };
  voiceStateMap.set(userId, updated);
  await persistToRedis(updated);
  return updated;
}

export async function getUserVoiceState(userId: string): Promise<VoiceState | null> {
  const memState = voiceStateMap.get(userId);
  if (memState) return memState;

  // Fall back to Redis
  const redisState = await loadFromRedis(userId);
  if (redisState) {
    voiceStateMap.set(userId, redisState);
    return redisState;
  }

  return null;
}

export async function getAllVoiceStates(): Promise<Map<string, VoiceState[]>> {
  const result = new Map<string, VoiceState[]>();

  for (const state of voiceStateMap.values()) {
    const list = result.get(state.channelId) ?? [];
    list.push(state);
    result.set(state.channelId, list);
  }

  return result;
}
