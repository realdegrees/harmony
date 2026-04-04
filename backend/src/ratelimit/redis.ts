import Redis from 'ioredis';
import { env } from '../config/env';

let redis: Redis;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL);
  }
  return redis;
}

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const r = getRedis();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // Step 1: Evict expired entries and count what's currently in the window,
  // WITHOUT adding the current request yet.
  const countPipeline = r.multi();
  countPipeline.zremrangebyscore(key, 0, windowStart);
  countPipeline.zcard(key);
  const countResults = await countPipeline.exec();
  const currentCount = (countResults?.[1]?.[1] as number) ?? 0;

  if (currentCount >= maxRequests) {
    // Rejected — do not record this request so it doesn't extend the window.
    return {
      allowed: false,
      remaining: 0,
      resetIn: windowSeconds,
    };
  }

  // Step 2: Request is allowed — record it now.
  const addPipeline = r.multi();
  addPipeline.zadd(key, now.toString(), `${now}-${Math.random()}`);
  addPipeline.expire(key, windowSeconds);
  await addPipeline.exec();

  return {
    allowed: true,
    remaining: maxRequests - (currentCount + 1),
    resetIn: windowSeconds,
  };
}
