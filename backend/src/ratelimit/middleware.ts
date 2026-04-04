import { checkRateLimit } from './redis';
import { env } from '../config/env';
import { error } from '../utils/response';

/**
 * Returns an error Response if the user is rate limited, null if the request
 * is allowed to proceed.
 */
export async function rateLimitMessages(userId: string): Promise<Response | null> {
  const key = `rl:msg:${userId}`;
  const limit = env.RATE_LIMIT_MESSAGES_PER_MINUTE;
  const result = await checkRateLimit(key, limit, 60);

  if (!result.allowed) {
    return error(
      `Rate limit exceeded. You may send ${limit} messages per minute. Try again in ${result.resetIn}s.`,
      429,
      'RATE_LIMITED',
    );
  }
  return null;
}

export async function rateLimitUploads(userId: string): Promise<Response | null> {
  const key = `rl:upload:${userId}`;
  const limit = env.RATE_LIMIT_UPLOADS_PER_MINUTE;
  const result = await checkRateLimit(key, limit, 60);

  if (!result.allowed) {
    return error(
      `Rate limit exceeded. You may upload ${limit} files per minute. Try again in ${result.resetIn}s.`,
      429,
      'RATE_LIMITED',
    );
  }
  return null;
}

export async function rateLimitGeneral(userId: string): Promise<Response | null> {
  const key = `rl:general:${userId}`;
  // 300 requests per minute as a general API rate limit
  const limit = 300;
  const result = await checkRateLimit(key, limit, 60);

  if (!result.allowed) {
    return error(
      `Too many requests. Please slow down. Try again in ${result.resetIn}s.`,
      429,
      'RATE_LIMITED',
    );
  }
  return null;
}
