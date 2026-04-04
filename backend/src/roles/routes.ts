import { createRoleSchema, updateRoleSchema } from '@harmony/shared/validation';
import { Permissions, serializePermissions } from '@harmony/shared/constants';
import type { Role } from '@harmony/shared/types';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
  removeRole,
} from './service';
import { checkPermission } from './permissions';
import { json, error } from '../utils/response';

// Serialize a Role so that BigInt permissions become a JSON-safe string.
function serializeRole(role: Role) {
  return {
    ...role,
    permissions: serializePermissions(role.permissions),
  };
}

// ---------------------------------------------------------------------------
// GET /api/roles
// ---------------------------------------------------------------------------

async function handleListRoles(_req: Request): Promise<Response> {
  const roles = await getAllRoles();
  return json(roles.map(serializeRole));
}

// ---------------------------------------------------------------------------
// POST /api/roles
// ---------------------------------------------------------------------------

async function handleCreateRole(
  req: Request,
  userId: string,
): Promise<Response> {
  const allowed = await checkPermission(userId, Permissions.MANAGE_ROLES);
  if (!allowed) {
    return error('Missing MANAGE_ROLES permission', 403, 'FORBIDDEN');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body', 400, 'INVALID_BODY');
  }

  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return error('Validation failed', 422, 'VALIDATION_ERROR');
  }

  const role = await createRole(parsed.data);
  return json(serializeRole(role), 201);
}

// ---------------------------------------------------------------------------
// PATCH /api/roles/:id
// ---------------------------------------------------------------------------

async function handleUpdateRole(
  req: Request,
  userId: string,
  roleId: string,
): Promise<Response> {
  const allowed = await checkPermission(userId, Permissions.MANAGE_ROLES);
  if (!allowed) {
    return error('Missing MANAGE_ROLES permission', 403, 'FORBIDDEN');
  }

  const existing = await getRoleById(roleId);
  if (!existing) {
    return error('Role not found', 404, 'NOT_FOUND');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body', 400, 'INVALID_BODY');
  }

  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return error('Validation failed', 422, 'VALIDATION_ERROR');
  }

  const updated = await updateRole(roleId, parsed.data);
  return json(serializeRole(updated));
}

// ---------------------------------------------------------------------------
// DELETE /api/roles/:id
// ---------------------------------------------------------------------------

async function handleDeleteRole(
  _req: Request,
  userId: string,
  roleId: string,
): Promise<Response> {
  const allowed = await checkPermission(userId, Permissions.MANAGE_ROLES);
  if (!allowed) {
    return error('Missing MANAGE_ROLES permission', 403, 'FORBIDDEN');
  }

  const existing = await getRoleById(roleId);
  if (!existing) {
    return error('Role not found', 404, 'NOT_FOUND');
  }

  if (existing.isDefault) {
    return error('Cannot delete the default role', 400, 'CANNOT_DELETE_DEFAULT');
  }

  await deleteRole(roleId);
  return json({ message: 'Role deleted' });
}

// ---------------------------------------------------------------------------
// POST /api/roles/:id/assign
// ---------------------------------------------------------------------------

async function handleAssignRole(
  req: Request,
  userId: string,
  roleId: string,
): Promise<Response> {
  const allowed = await checkPermission(userId, Permissions.MANAGE_ROLES);
  if (!allowed) {
    return error('Missing MANAGE_ROLES permission', 403, 'FORBIDDEN');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error('Invalid JSON body', 400, 'INVALID_BODY');
  }

  const targetUserId =
    body !== null &&
    typeof body === 'object' &&
    'userId' in body &&
    typeof (body as Record<string, unknown>).userId === 'string'
      ? (body as Record<string, string>).userId
      : null;

  if (!targetUserId) {
    return error('userId is required in request body', 400, 'MISSING_USER_ID');
  }

  const role = await getRoleById(roleId);
  if (!role) {
    return error('Role not found', 404, 'NOT_FOUND');
  }

  await assignRole(targetUserId, roleId);
  return json({ message: 'Role assigned' });
}

// ---------------------------------------------------------------------------
// DELETE /api/roles/:id/assign/:userId
// ---------------------------------------------------------------------------

async function handleRemoveRole(
  _req: Request,
  callerId: string,
  roleId: string,
  targetUserId: string,
): Promise<Response> {
  const allowed = await checkPermission(callerId, Permissions.MANAGE_ROLES);
  if (!allowed) {
    return error('Missing MANAGE_ROLES permission', 403, 'FORBIDDEN');
  }

  const role = await getRoleById(roleId);
  if (!role) {
    return error('Role not found', 404, 'NOT_FOUND');
  }

  await removeRole(targetUserId, roleId);
  return json({ message: 'Role removed from user' });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Routes role-prefixed paths to the correct handler.
 * `userId` is the authenticated caller's ID.
 * Returns `null` if the path is not handled here.
 */
export async function handleRoleRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  // GET /api/roles
  if (path === '/api/roles' && method === 'GET') {
    return handleListRoles(req);
  }

  // POST /api/roles
  if (path === '/api/roles' && method === 'POST') {
    return handleCreateRole(req, userId);
  }

  // POST /api/roles/:id/assign
  const assignMatch = path.match(/^\/api\/roles\/([^/]+)\/assign$/);
  if (assignMatch && method === 'POST') {
    return handleAssignRole(req, userId, assignMatch[1]);
  }

  // DELETE /api/roles/:id/assign/:userId
  const removeAssignMatch = path.match(/^\/api\/roles\/([^/]+)\/assign\/([^/]+)$/);
  if (removeAssignMatch && method === 'DELETE') {
    return handleRemoveRole(req, userId, removeAssignMatch[1], removeAssignMatch[2]);
  }

  // PATCH /api/roles/:id
  const patchMatch = path.match(/^\/api\/roles\/([^/]+)$/);
  if (patchMatch && method === 'PATCH') {
    return handleUpdateRole(req, userId, patchMatch[1]);
  }

  // DELETE /api/roles/:id
  const deleteMatch = path.match(/^\/api\/roles\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    return handleDeleteRole(req, userId, deleteMatch[1]);
  }

  return null;
}
