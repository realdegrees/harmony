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

  const multi = r.multi();
  multi.zremrangebyscore(key, 0, windowStart);  // Remove expired entries
  multi.zadd(key, now.toString(), `${now}-${Math.random()}`);  // Add current request
  multi.zcard(key);  // Count requests in window
  multi.expire(key, windowSeconds);  // Set TTL

  const results = await multi.exec();
  const count = (results?.[2]?.[1] as number) ?? 0;

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetIn: windowSeconds,
  };
}
