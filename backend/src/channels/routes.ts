import { json, error } from '../utils/response';
import {
  createChannelSchema,
  updateChannelSchema,
  channelPermissionOverrideSchema,
} from '@harmony/shared/validation/channel';
import {
  createChannel,
  updateChannel,
  deleteChannel,
  getChannel,
  getAllChannels,
  getChannelsForUser,
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
 * Handles all /api/channels/* routes.
 * Returns a Response if the route matched, or null if it did not.
 */
export async function handleChannelRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

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

  return null;
}
