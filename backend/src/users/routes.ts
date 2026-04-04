import { updateUserSchema } from '@harmony/shared/validation';
import { serializePermissions } from '@harmony/shared/constants';
import { getUserProfile, getAllUsers, updateUser } from './service';
import { json, error } from '../utils/response';
import { db } from '../db/client';

// Serialize a UserProfile so that role permissions are JSON-safe strings.
function serializeProfile(profile: Awaited<ReturnType<typeof getUserProfile>>) {
  if (!profile) return null;
  return {
    ...profile,
    roles: profile.roles.map((r) => ({
      ...r,
      permissions: serializePermissions(r.permissions),
    })),
  };
}

// ---------------------------------------------------------------------------
// GET /api/users
// ---------------------------------------------------------------------------

async function handleListUsers(_req: Request): Promise<Response> {
  const users = await getAllUsers();
  return json(users);
}

// ---------------------------------------------------------------------------
// GET /api/users/me
// ---------------------------------------------------------------------------

async function handleGetMe(
  _req: Request,
  userId: string,
): Promise<Response> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    return error('User not found', 404, 'NOT_FOUND');
  }
  return json(serializeProfile(profile));
}

// ---------------------------------------------------------------------------
// PATCH /api/users/me
// ---------------------------------------------------------------------------

async function handleUpdateMe(
  req: Request,
  userId: string,
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body', 400, 'INVALID_BODY');
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return error('Validation failed', 422, 'VALIDATION_ERROR');
  }

  const user = await updateUser(userId, parsed.data);
  return json(user);
}

// ---------------------------------------------------------------------------
// GET /api/users/:id
// ---------------------------------------------------------------------------

async function handleGetUserById(
  _req: Request,
  targetId: string,
): Promise<Response> {
  const profile = await getUserProfile(targetId);
  if (!profile) {
    return error('User not found', 404, 'NOT_FOUND');
  }
  return json(serializeProfile(profile));
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Routes user-prefixed paths to the correct handler.
 * `userId` is the authenticated caller's ID.
 * Returns `null` if the path is not handled here.
 */
export async function handleUserRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();
  const url = new URL(req.url);

  // GET /api/users
  if (path === '/api/users' && method === 'GET') {
    return handleListUsers(req);
  }

  // GET /api/users/search?q=...&limit=N
  if (path === '/api/users/search' && method === 'GET') {
    const q = url.searchParams.get('q') ?? '';
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);
    if (!q.trim()) return json([]);

    try {
      const users = await db.user.findMany({
        where: {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, username: true, displayName: true, avatarPath: true },
        take: Math.min(limit, 25),
        orderBy: { username: 'asc' },
      });
      return json(users);
    } catch (e) {
      console.error(e);
      return error('Search failed', 500);
    }
  }

  // GET /api/users/me
  if (path === '/api/users/me' && method === 'GET') {
    return handleGetMe(req, userId);
  }

  // PATCH /api/users/me
  if (path === '/api/users/me' && method === 'PATCH') {
    return handleUpdateMe(req, userId);
  }

  // PATCH /api/users/me/status
  if (path === '/api/users/me/status' && method === 'PATCH') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body', 400);
    }

    const status = (body as Record<string, unknown>)?.status;
    if (!status || !['ONLINE', 'OFFLINE', 'APPEAR_OFFLINE', 'BUSY'].includes(status as string)) {
      return error('Invalid status', 400);
    }

    try {
      const updated = await db.user.update({
        where: { id: userId },
        data: { status: status as any },
        select: { id: true, username: true, displayName: true, avatarPath: true, status: true, createdAt: true, updatedAt: true },
      });
      return json({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (e) {
      console.error(e);
      return error('Failed to update status', 500);
    }
  }

  // GET /api/users/:id  — must come after /me check
  const userIdMatch = path.match(/^\/api\/users\/([^/]+)$/);
  if (userIdMatch && method === 'GET') {
    return handleGetUserById(req, userIdMatch[1]);
  }

  return null;
}
