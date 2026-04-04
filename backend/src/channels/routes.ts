import { json, error } from '../utils/response';
import {
  createChannelSchema,
  updateChannelSchema,
  channelPermissionOverrideSchema,
  createCategorySchema,
  updateCategorySchema,
  moveChannelToCategorySchema,
} from '@harmony/shared/validation/channel';
import {
  createChannel,
  updateChannel,
  deleteChannel,
  getChannel,
  getAllChannels,
  getChannelsForUser,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoriesWithChannels,
  moveChannelToCategory,
} from './service';
import {
  canManageChannel,
  getChannelOverrides,
  setChannelPermissionOverride,
  removeChannelPermissionOverride,
} from './permissions';
import { db } from '../db/client';

// ---------------------------------------------------------------------------
// Route matcher
// ---------------------------------------------------------------------------

/**
 * Handles all /api/categories/* routes.
 * Returns a Response if the route matched, or null if it did not.
 */
export async function handleCategoryRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  // -------------------------------------------------------------------------
  // GET /api/categories
  // -------------------------------------------------------------------------
  if (path === '/api/categories' && method === 'GET') {
    try {
      const cats = await getCategoriesWithChannels(userId);
      return json(cats);
    } catch (e) {
      console.error(e);
      return error('Failed to fetch categories', 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/categories
  // -------------------------------------------------------------------------
  if (path === '/api/categories' && method === 'POST') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    try {
      const category = await createCategory(parsed.data.name);
      return json(category, 201);
    } catch (e) {
      console.error(e);
      return error('Failed to create category', 500);
    }
  }

  // -------------------------------------------------------------------------
  // Routes with /:id
  // -------------------------------------------------------------------------
  const idMatch = path.match(/^\/api\/categories\/([^/]+)$/);
  if (!idMatch) return null;

  const categoryId = idMatch[1];

  // -------------------------------------------------------------------------
  // PATCH /api/categories/:id
  // -------------------------------------------------------------------------
  if (method === 'PATCH') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    try {
      const category = await updateCategory(categoryId, parsed.data);
      return json(category);
    } catch (e) {
      console.error(e);
      return error('Failed to update category', 500);
    }
  }

  // -------------------------------------------------------------------------
  // DELETE /api/categories/:id
  // -------------------------------------------------------------------------
  if (method === 'DELETE') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    try {
      await deleteCategory(categoryId);
      return json({ success: true });
    } catch (e) {
      console.error(e);
      return error('Failed to delete category', 500);
    }
  }

  return null;
}

/**
 * Handles all /api/channels/* routes.
 * Returns a Response if the route matched, or null if it did not.
 */
export async function handleChannelRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  const url = new URL(req.url);

  // -------------------------------------------------------------------------
  // GET /api/channels/search?q=...&limit=N
  // -------------------------------------------------------------------------
  if (path === '/api/channels/search' && method === 'GET') {
    const q = url.searchParams.get('q') ?? '';
    const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);
    if (!q.trim()) return json([]);

    try {
      const results = await db.channel.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
          type: { in: ['TEXT', 'VOICE'] },
        },
        select: { id: true, name: true, type: true },
        take: Math.min(limit, 25),
        orderBy: { name: 'asc' },
      });
      return json(results);
    } catch (e) {
      console.error(e);
      return error('Search failed', 500);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/channels
  // -------------------------------------------------------------------------
  if (path === '/api/channels' && method === 'GET') {
    try {
      const channels = await getChannelsForUser(userId);
      return json(channels);
    } catch (e) {
      console.error(e);
      return error('Failed to fetch channels', 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/channels
  // -------------------------------------------------------------------------
  if (path === '/api/channels' && method === 'POST') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    const parsed = createChannelSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    try {
      const channel = await createChannel(parsed.data as any);
      return json(channel, 201);
    } catch (e) {
      console.error(e);
      return error('Failed to create channel', 500);
    }
  }

  // -------------------------------------------------------------------------
  // Routes with /:id
  // -------------------------------------------------------------------------
  const idMatch = path.match(/^\/api\/channels\/([^/]+)(\/.*)?$/);
  if (!idMatch) return null;

  const channelId = idMatch[1];
  const sub = idMatch[2] ?? '';

  // -------------------------------------------------------------------------
  // GET /api/channels/:id
  // -------------------------------------------------------------------------
  if (sub === '' && method === 'GET') {
    try {
      const channel = await getChannel(channelId);
      if (!channel) return error('Channel not found', 404);
      return json(channel);
    } catch (e) {
      console.error(e);
      return error('Failed to fetch channel', 500);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/channels/:id/members — returns all server users (single-server model)
  // -------------------------------------------------------------------------
  if (sub === '/members' && method === 'GET') {
    try {
      const users = await db.user.findMany({
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarPath: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          roles: { include: { role: true } },
        },
        orderBy: { username: 'asc' },
      });
      const sanitized = users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarPath: u.avatarPath,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        roles: u.roles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          color: ur.role.color,
          position: ur.role.position,
          permissions: ur.role.permissions.toString(),
          isDefault: ur.role.isDefault,
        })),
      }));
      return json(sanitized);
    } catch (e) {
      console.error(e);
      return error('Failed to fetch members', 500);
    }
  }

  // -------------------------------------------------------------------------
  // PATCH /api/channels/:id
  // -------------------------------------------------------------------------
  if (sub === '' && method === 'PATCH') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    const parsed = updateChannelSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    try {
      const channel = await updateChannel(channelId, parsed.data);
      return json(channel);
    } catch (e) {
      console.error(e);
      return error('Failed to update channel', 500);
    }
  }

  // -------------------------------------------------------------------------
  // DELETE /api/channels/:id
  // -------------------------------------------------------------------------
  if (sub === '' && method === 'DELETE') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    // Ensure there is at least one other text channel
    const existing = await getChannel(channelId);
    if (!existing) return error('Channel not found', 404);

    if (existing.type === 'TEXT') {
      const textCount = await db.channel.count({ where: { type: 'TEXT' } });
      if (textCount <= 1) {
        return error('Cannot delete the last text channel', 400);
      }
    }

    try {
      await deleteChannel(channelId);
      return json({ success: true });
    } catch (e) {
      console.error(e);
      return error('Failed to delete channel', 500);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/channels/:id/permissions
  // -------------------------------------------------------------------------
  if (sub === '/permissions' && method === 'GET') {
    try {
      const overrides = await getChannelOverrides(channelId);
      // Serialize bigints for JSON transport
      const serialized = overrides.map((o) => ({
        ...o,
        allow: o.allow.toString(),
        deny: o.deny.toString(),
      }));
      return json(serialized);
    } catch (e) {
      console.error(e);
      return error('Failed to fetch channel permissions', 500);
    }
  }

  // -------------------------------------------------------------------------
  // PUT /api/channels/:id/permissions
  // -------------------------------------------------------------------------
  if (sub === '/permissions' && method === 'PUT') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    const parsed = channelPermissionOverrideSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    const { targetType, targetId, allow, deny } = parsed.data;

    try {
      await setChannelPermissionOverride(
        channelId,
        targetType as 'ROLE' | 'USER',
        targetId,
        BigInt(allow),
        BigInt(deny),
      );
      return json({ success: true });
    } catch (e) {
      console.error(e);
      return error('Failed to set channel permission override', 500);
    }
  }

  // -------------------------------------------------------------------------
  // DELETE /api/channels/:id/permissions/:targetType/:targetId
  // -------------------------------------------------------------------------
  const permDeleteMatch = sub.match(/^\/permissions\/(ROLE|USER)\/([^/]+)$/);
  if (permDeleteMatch && method === 'DELETE') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    const targetType = permDeleteMatch[1] as 'ROLE' | 'USER';
    const targetId = permDeleteMatch[2];

    try {
      await removeChannelPermissionOverride(channelId, targetType, targetId);
      return json({ success: true });
    } catch (e) {
      console.error(e);
      return error('Failed to remove channel permission override', 500);
    }
  }

  // -------------------------------------------------------------------------
  // PATCH /api/channels/:id/category
  // -------------------------------------------------------------------------
  if (sub === '/category' && method === 'PATCH') {
    if (!(await canManageChannel(userId))) {
      return error('Missing MANAGE_CHANNELS permission', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    const parsed = moveChannelToCategorySchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    try {
      await moveChannelToCategory(channelId, parsed.data.categoryId);
      return json({ success: true });
    } catch (e) {
      console.error(e);
      return error('Failed to move channel to category', 500);
    }
  }

  return null;
}
