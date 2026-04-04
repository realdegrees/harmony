import { getRedis } from '../utils/redis';
import type { UserStatus } from '@harmony/shared/types/user';

const PRESENCE_KEY = 'presence';
const PRESENCE_TTL = 300; // 5 minutes

export async function setPresence(userId: string, status: UserStatus): Promise<void> {
  const redis = getRedis();
  await redis.hset(PRESENCE_KEY, userId, status);
  if (status !== 'OFFLINE') {
    await redis.expire(PRESENCE_KEY, PRESENCE_TTL);
  }
}

export async function getPresence(userId: string): Promise<UserStatus> {
  const redis = getRedis();
  const status = await redis.hget(PRESENCE_KEY, userId);
  return (status as UserStatus) || 'OFFLINE';
}

export async function getAllPresence(): Promise<Map<string, UserStatus>> {
  const redis = getRedis();
  const all = await redis.hgetall(PRESENCE_KEY);
  return new Map(Object.entries(all ?? {}) as [string, UserStatus][]);
}

export async function removePresence(userId: string): Promise<void> {
  const redis = getRedis();
  await redis.hdel(PRESENCE_KEY, userId);
}
