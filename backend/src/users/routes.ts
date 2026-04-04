import { updateUserSchema } from '@harmony/shared/validation';
import { serializePermissions } from '@harmony/shared/constants';
import { getUserProfile, getAllUsers, updateUser } from './service';
import { json, error } from '../utils/response';

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

  // GET /api/users
  if (path === '/api/users' && method === 'GET') {
    return handleListUsers(req);
  }

  // GET /api/users/me
  if (path === '/api/users/me' && method === 'GET') {
    return handleGetMe(req, userId);
  }

  // PATCH /api/users/me
  if (path === '/api/users/me' && method === 'PATCH') {
    return handleUpdateMe(req, userId);
  }

  // GET /api/users/:id  — must come after /me check
  const userIdMatch = path.match(/^\/api\/users\/([^/]+)$/);
  if (userIdMatch && method === 'GET') {
    return handleGetUserById(req, userIdMatch[1]);
  }

  return null;
}
