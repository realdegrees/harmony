import type { VoiceState, VoiceParticipant } from '@harmony/shared/types/voice';
import { db } from '../db/client';

// In-memory map: userId -> VoiceState
const voiceStateMap = new Map<string, VoiceState>();

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

export async function joinVoiceChannel(userId: string, channelId: string): Promise<VoiceState> {
  const existing = voiceStateMap.get(userId);
  if (existing && existing.channelId !== channelId) {
    await leaveVoiceChannel(userId);
  }

  const state = defaultVoiceState(userId, channelId);
  voiceStateMap.set(userId, state);
  return state;
}

export async function leaveVoiceChannel(userId: string): Promise<{ channelId: string } | null> {
  const state = voiceStateMap.get(userId);
  if (!state) return null;

  const { channelId } = state;
  voiceStateMap.delete(userId);
  return { channelId };
}

export async function getVoiceChannelParticipants(channelId: string): Promise<VoiceParticipant[]> {
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
  const state = voiceStateMap.get(userId);
  if (!state) return null;

  const updated: VoiceState = { ...state, ...update, userId };
  voiceStateMap.set(userId, updated);
  return updated;
}

export async function getUserVoiceState(userId: string): Promise<VoiceState | null> {
  return voiceStateMap.get(userId) ?? null;
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

export async function getAllVoiceParticipants(): Promise<Record<string, VoiceParticipant[]>> {
  // Gather all unique channelIds with participants
  const channelIds = new Set<string>();
  for (const state of voiceStateMap.values()) {
    channelIds.add(state.channelId);
  }

  const result: Record<string, VoiceParticipant[]> = {};
  for (const channelId of channelIds) {
    result[channelId] = await getVoiceChannelParticipants(channelId);
  }

  return result;
}
