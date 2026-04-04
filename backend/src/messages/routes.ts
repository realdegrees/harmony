import { json, error } from '../utils/response';
import {
  sendMessageSchema,
  editMessageSchema,
  searchMessagesSchema,
  reactionSchema,
} from '@harmony/shared/validation/message';
import { sendMessage, editMessage, deleteMessage, getMessages } from './service';
import { addReaction, removeReaction } from './reactions';
import { searchMessages } from './search';
import { canSendMessages } from '../channels/permissions';
import { db } from '../db/client';
import { Permissions, hasPermission } from '@harmony/shared/constants/permissions';

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

async function getUserBasePermissions(userId: string): Promise<bigint> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { permissions: true } } },
  });
  let perms = 0n;
  for (const ur of userRoles) {
    perms |= ur.role.permissions;
  }
  return perms;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Handles all /api/channels/:channelId/messages and /api/messages/* routes.
 * Returns a Response if the route matched, or null if it did not.
 */
export async function handleMessageRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();
  const url = new URL(req.url);

  // -------------------------------------------------------------------------
  // GET /api/messages/search
  // -------------------------------------------------------------------------
  if (path === '/api/messages/search' && method === 'GET') {
    const params = Object.fromEntries(url.searchParams.entries());

    // Coerce boolean/number query params
    const raw = {
      ...params,
      hasAttachment: params.hasAttachment === 'true' ? true : params.hasAttachment === 'false' ? false : undefined,
      hasLink: params.hasLink === 'true' ? true : params.hasLink === 'false' ? false : undefined,
      hasImage: params.hasImage === 'true' ? true : params.hasImage === 'false' ? false : undefined,
      limit: params.limit ? parseInt(params.limit, 10) : undefined,
    };

    const parsed = searchMessagesSchema.safeParse(raw);
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    try {
      const result = await searchMessages(parsed.data);
      return json(result);
    } catch (e) {
      console.error(e);
      return error('Search failed', 500);
    }
  }

  // -------------------------------------------------------------------------
  // Routes under /api/channels/:channelId/messages
  // -------------------------------------------------------------------------
  const channelMsgMatch = path.match(/^\/api\/channels\/([^/]+)\/messages(\/.*)?$/);
  if (channelMsgMatch) {
    const channelId = channelMsgMatch[1];
    const sub = channelMsgMatch[2] ?? '';

    // GET /api/channels/:channelId/messages
    if (sub === '' && method === 'GET') {
      const cursor = url.searchParams.get('cursor') ?? undefined;
      const limitParam = url.searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam, 10) : undefined;

      try {
        const result = await getMessages(channelId, { cursor, limit });
        return json(result);
      } catch (e) {
        console.error(e);
        return error('Failed to fetch messages', 500);
      }
    }

    // POST /api/channels/:channelId/messages
    if (sub === '' && method === 'POST') {
      const canSend = await canSendMessages(userId, channelId);
      if (!canSend) {
        return error('Missing SEND_MESSAGES permission for this channel', 403);
      }

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return error('Invalid JSON body');
      }

      const parsed = sendMessageSchema.safeParse(body);
      if (!parsed.success) {
        return error(parsed.error.errors[0]?.message ?? 'Validation error');
      }

      try {
        const message = await sendMessage(
          channelId,
          userId,
          parsed.data.content,
          parsed.data.replyToId,
          parsed.data.attachmentIds,
        );
        return json(message, 201);
      } catch (e) {
        console.error(e);
        return error('Failed to send message', 500);
      }
    }

    return null;
  }

  // -------------------------------------------------------------------------
  // Routes under /api/messages/:id
  // -------------------------------------------------------------------------
  const msgIdMatch = path.match(/^\/api\/messages\/([^/]+)(\/.*)?$/);
  if (!msgIdMatch) return null;

  const messageId = msgIdMatch[1];
  const sub = msgIdMatch[2] ?? '';

  // PATCH /api/messages/:id
  if (sub === '' && method === 'PATCH') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    const parsed = editMessageSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    try {
      const message = await editMessage(messageId, userId, parsed.data.content);
      return json(message);
    } catch (e: any) {
      const status = e?.statusCode ?? 500;
      return error(e?.message ?? 'Failed to edit message', status);
    }
  }

  // DELETE /api/messages/:id
  if (sub === '' && method === 'DELETE') {
    const basePerms = await getUserBasePermissions(userId);
    const hasDeleteAny = hasPermission(basePerms, Permissions.DELETE_ANY_MESSAGE);

    try {
      await deleteMessage(messageId, userId, hasDeleteAny);
      return json({ success: true });
    } catch (e: any) {
      const status = e?.statusCode ?? 500;
      return error(e?.message ?? 'Failed to delete message', status);
    }
  }

  // POST /api/messages/:id/reactions
  if (sub === '/reactions' && method === 'POST') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    // reactionSchema expects messageId — inject it
    const parsed = reactionSchema.safeParse({ messageId, ...(body as object) });
    if (!parsed.success) {
      return error(parsed.error.errors[0]?.message ?? 'Validation error');
    }

    try {
      const reaction = await addReaction(
        messageId,
        userId,
        parsed.data.emojiId,
        parsed.data.emojiUnicode,
      );
      return json(reaction, 201);
    } catch (e: any) {
      const status = e?.statusCode ?? 500;
      return error(e?.message ?? 'Failed to add reaction', status);
    }
  }

  // DELETE /api/messages/:id/reactions
  if (sub === '/reactions' && method === 'DELETE') {
    const emojiId = url.searchParams.get('emojiId') ?? undefined;
    const emojiUnicode = url.searchParams.get('emojiUnicode') ?? undefined;

    if (!emojiId && !emojiUnicode) {
      return error('Either emojiId or emojiUnicode query param is required');
    }

    try {
      await removeReaction(messageId, userId, emojiId, emojiUnicode);
      return json({ success: true });
    } catch (e) {
      console.error(e);
      return error('Failed to remove reaction', 500);
    }
  }

  return null;
}
