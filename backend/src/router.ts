import { handleAuthRoute, handleAuthenticatedRoute } from './auth/routes';
import { handleUserRoute } from './users/routes';
import { handleRoleRoute } from './roles/routes';
import { handleChannelRoute, handleCategoryRoute } from './channels/routes';
import { handleMessageRoute } from './messages/routes';
import { handleDMRoute } from './dms/routes';
import { handleMediaRoute } from './media/routes';
import { handleNotificationRoute } from './notifications/routes';
import { authenticateRequest } from './auth/middleware';
import { rateLimitGeneral } from './ratelimit/middleware';
import { error } from './utils/response';

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function addCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS preflight — handled upstream in index.ts but guard here too
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // -------------------------------------------------------------------------
  // Auth routes — no authentication required
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/auth/')) {
    try {
      const result = await handleAuthRoute(req, path);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Auth route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Static uploads — served without authentication.
  // Filenames are unguessable UUIDs so security-through-obscurity is
  // sufficient here, and browser <img>/<video>/<a download> elements
  // cannot attach Authorization headers.
  // -------------------------------------------------------------------------
  if (req.method === 'GET' && path.startsWith('/api/uploads/')) {
    try {
      const result = await handleMediaRoute(req, path, '');
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Upload serve error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Health check — no authentication required (used by Docker/Traefik)
  // -------------------------------------------------------------------------
  if (path === '/api/health' && req.method === 'GET') {
    return addCors(new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }

  // -------------------------------------------------------------------------
  // All other routes require a valid Bearer token
  // -------------------------------------------------------------------------
  const auth = await authenticateRequest(req);
  if (!auth) {
    return addCors(error('Unauthorized', 401, 'UNAUTHORIZED'));
  }

  // General rate limiting
  const rateLimited = await rateLimitGeneral(auth.userId);
  if (rateLimited) return addCors(rateLimited);

  const { userId } = auth;

  // -------------------------------------------------------------------------
  // Authenticated auth routes — /api/auth/claim-admin etc.
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/auth')) {
    try {
      const result = await handleAuthenticatedRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Authenticated auth route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Presence route — /api/presence
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/presence') || path.startsWith('/api/users')) {
    try {
      const result = await handleUserRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] User route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Role routes — /api/roles/*
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/roles')) {
    try {
      const result = await handleRoleRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Role route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Category routes — /api/categories/*
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/categories')) {
    try {
      const result = await handleCategoryRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Category route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Channel + Message routes — /api/channels/*
  //
  // Messages live under channels (/api/channels/:id/messages/*) so we need to
  // try the message handler first for those sub-paths, then fall through to the
  // channel handler for everything else.
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/channels')) {
    // Try message handler first for /api/channels/:id/messages paths
    if (path.match(/^\/api\/channels\/[^/]+\/messages/)) {
      try {
        const result = await handleMessageRoute(req, path, userId);
        if (result) return addCors(result);
      } catch (err) {
        console.error('[router] Message (channel) route error:', err);
        return addCors(error('Internal server error', 500));
      }
    }

    // Then try the channel handler
    try {
      const result = await handleChannelRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Channel route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Standalone message routes — /api/messages/*
  // (edit, delete, search, reactions)
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/messages')) {
    try {
      const result = await handleMessageRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Message route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // DM routes — /api/dms/*
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/dms')) {
    try {
      const result = await handleDMRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] DM route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Media routes — /api/emojis, /api/sounds, /api/attachments,
  //               /api/uploads, /api/giphy
  // -------------------------------------------------------------------------
  if (
    path.startsWith('/api/emojis') ||
    path.startsWith('/api/sounds') ||
    path.startsWith('/api/attachments') ||
    path.startsWith('/api/uploads') ||
    path.startsWith('/api/giphy')
  ) {
    try {
      const result = await handleMediaRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Media route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  // -------------------------------------------------------------------------
  // Notification routes — /api/notifications/*
  // -------------------------------------------------------------------------
  if (path.startsWith('/api/notifications')) {
    try {
      const result = await handleNotificationRoute(req, path, userId);
      if (result) return addCors(result);
    } catch (err) {
      console.error('[router] Notification route error:', err);
      return addCors(error('Internal server error', 500));
    }
  }

  return addCors(error('Not Found', 404, 'NOT_FOUND'));
}
