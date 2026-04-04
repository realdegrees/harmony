import { json, error } from '../utils/response';
import { getOrCreateDM, getUserDMs } from './service';

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Handles all /api/dms/* routes.
 * Returns a Response if the route matched, or null if it did not.
 */
export async function handleDMRoute(
  req: Request,
  path: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  // -------------------------------------------------------------------------
  // GET /api/dms — list all DMs for the current user
  // -------------------------------------------------------------------------
  if (path === '/api/dms' && method === 'GET') {
    try {
      const dms = await getUserDMs(userId);
      return json(dms);
    } catch (e) {
      console.error(e);
      return error('Failed to fetch DMs', 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /api/dms — create or get a DM with another user
  // -------------------------------------------------------------------------
  if (path === '/api/dms' && method === 'POST') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error('Invalid JSON body');
    }

    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).userId !== 'string'
    ) {
      return error('Body must include userId (string)');
    }

    const targetUserId = (body as Record<string, string>).userId;

    if (targetUserId === userId) {
      return error('Cannot create a DM with yourself');
    }

    try {
      const result = await getOrCreateDM(userId, targetUserId);
      return json(result, result.isNew ? 201 : 200);
    } catch (e) {
      console.error(e);
      return error('Failed to get or create DM', 500);
    }
  }

  return null;
}
