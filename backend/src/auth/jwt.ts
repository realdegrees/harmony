import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env';

/**
 * Parse a TTL string like "15m" or "7d" into seconds.
 */
function parseTtlToSeconds(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid TTL format: "${ttl}". Expected e.g. "15m", "7d".`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default:
      throw new Error(`Unknown TTL unit: "${unit}"`);
  }
}

function accessSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
}

function refreshSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_REFRESH_SECRET);
}

export async function generateAccessToken(userId: string): Promise<string> {
  const expirationTime = parseTtlToSeconds(env.JWT_ACCESS_TTL);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expirationTime}s`)
    .sign(accessSecret());
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const expirationTime = parseTtlToSeconds(env.JWT_REFRESH_TTL);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expirationTime}s`)
    .sign(refreshSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    if (typeof payload.sub !== 'string') return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string,
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    if (typeof payload.sub !== 'string') return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export async function generateTokenPair(
  userId: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId),
    generateRefreshToken(userId),
  ]);
  return { accessToken, refreshToken };
}
