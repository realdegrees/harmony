import { json, error } from '../utils/response';
import {
  getUnreadNotifications,
  getUnreadCounts,
  markNotificationRead,
  markAllRead,
} from './service';

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Handles all /api/notifications/* routes.
 * Returns a Response if the route matched, or null if it did not.
 */
export async function handleNotificationRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  // -------------------------------------------------------------------------
  // GET /api/notifications — get unread notifications
  // -------------------------------------------------------------------------
  if (path === '/api/notifications' && method === 'GET') {
    try {
      const notifications = await getUnreadNotifications(userId);
      return json(notifications);
    } catch (e) {
      console.error(e);
      return error('Failed to fetch notifications', 500);
    }
  }

  // -------------------------------------------------------------------------
  // GET /api/notifications/unread — get unread counts per channel
  // -------------------------------------------------------------------------
  if (path === '/api/notifications/unread' && method === 'GET') {
    try {
      const counts = await getUnreadCounts(userId);
      return json(counts);
    } catch (e) {
      console.error(e);
      return error('Failed to fetch unread counts', 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/notifications/read-all — mark all as read
  // -------------------------------------------------------------------------
  if (path === '/api/notifications/read-all' && method === 'POST') {
    let channelId: string | undefined;

    // Body is optional
    try {
      const body = await req.json();
      if (
        typeof body === 'object' &&
        body !== null &&
        typeof (body as Record<string, unknown>).channelId === 'string'
      ) {
        channelId = (body as Record<string, string>).channelId;
      }
    } catch {
      // No body or non-JSON body is fine here
    }

    try {
      await markAllRead(userId, channelId);
      return json({ success: true });
    } catch (e) {
      console.error(e);
      return error('Failed to mark notifications as read', 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/notifications/:id/read — mark single notification as read
  // -------------------------------------------------------------------------
  const readMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (readMatch && method === 'POST') {
    const notificationId = readMatch[1];

    try {
      await markNotificationRead(notificationId, userId);
      return json({ success: true });
    } catch (e) {
      console.error(e);
      return error('Failed to mark notification as read', 500);
    }
  }

  return null;
}
