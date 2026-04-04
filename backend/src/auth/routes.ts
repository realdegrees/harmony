import { registerSchema, loginSchema } from '@harmony/shared/validation';
import { hashPassword, verifyPassword } from './hash';
import { generateTokenPair, verifyRefreshToken } from './jwt';
import { db } from '../db/client';
import { json, error } from '../utils/response';
import { sanitizeUser } from '../users/service';
import { validateAndClaimToken } from './admin-token';
import { assignRole, getAdminRole } from '../roles/service';

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

async function handleRegister(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body', 400, 'INVALID_BODY');
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return error('Validation failed', 422, 'VALIDATION_ERROR');
  }

  const { username, displayName, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    return error('Username already taken', 409, 'USERNAME_TAKEN');
  }

  const passwordHash = await hashPassword(password);

  // Find the default role to assign on registration
  const defaultRole = await db.role.findFirst({ where: { isDefault: true } });

  const user = await db.user.create({
    data: {
      username,
      displayName,
      passwordHash,
      ...(defaultRole
        ? { roles: { create: { roleId: defaultRole.id } } }
        : {}),
    },
  });

  const tokens = await generateTokenPair(user.id);

  return json(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: sanitizeUser(user),
    },
    201,
  );
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

async function handleLogin(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body', 400, 'INVALID_BODY');
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return error('Validation failed', 422, 'VALIDATION_ERROR');
  }

  const { username, password } = parsed.data;

  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    return error('Invalid username or password', 401, 'INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return error('Invalid username or password', 401, 'INVALID_CREDENTIALS');
  }

  const tokens = await generateTokenPair(user.id);

  return json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: sanitizeUser(user),
  });
}

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

async function handleRefresh(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body', 400, 'INVALID_BODY');
  }

  const refreshToken =
    body !== null &&
    typeof body === 'object' &&
    'refreshToken' in body &&
    typeof (body as Record<string, unknown>).refreshToken === 'string'
      ? (body as Record<string, string>).refreshToken
      : null;

  if (!refreshToken) {
    return error('refreshToken is required', 400, 'MISSING_TOKEN');
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return error('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
  }

  const tokens = await generateTokenPair(payload.userId);

  return json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
}

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------

// Stateless implementation: the client discards tokens.
// A Redis-based blacklist can be wired in here later.
async function handleLogout(_req: Request): Promise<Response> {
  return json({ message: 'Logged out successfully' });
}

// ---------------------------------------------------------------------------
// POST /api/auth/claim-admin   (authenticated — token in body)
// ---------------------------------------------------------------------------
async function handleClaimAdmin(req: Request, userId: string): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body', 400, 'INVALID_BODY');
  }

  const token = (body as { token?: unknown }).token;
  if (typeof token !== 'string' || !token.trim()) {
    return error('token is required', 400, 'MISSING_TOKEN');
  }

  const result = validateAndClaimToken(token.trim());

  if (result === 'invalid') {
    return error('Invalid admin token', 403, 'INVALID_TOKEN');
  }
  if (result === 'already_claimed') {
    return error('Admin token has already been claimed. Restart the server to generate a new one.', 403, 'TOKEN_USED');
  }

  // Assign the Admin role to this user
  const adminRole = await getAdminRole();
  if (!adminRole) {
    return error('Admin role not found — ensure ensureDefaultRoles() ran at startup', 500, 'NO_ADMIN_ROLE');
  }

  await assignRole(userId, adminRole.id);

  return json({ message: 'Admin privileges granted.' });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Routes auth-prefixed paths to the correct handler.
 * Returns `null` if the path is not handled here.
 */
export async function handleAuthRoute(
  req: Request,
  path: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  if (path === '/api/auth/register' && method === 'POST') {
    return handleRegister(req);
  }

  if (path === '/api/auth/login' && method === 'POST') {
    return handleLogin(req);
  }

  if (path === '/api/auth/refresh' && method === 'POST') {
    return handleRefresh(req);
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    return handleLogout(req);
  }

  return null;
}

/**
 * Handles authenticated auth routes (requires userId from middleware).
 */
export async function handleAuthenticatedRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  if (path === '/api/auth/claim-admin' && method === 'POST') {
    return handleClaimAdmin(req, userId);
  }

  return null;
}
