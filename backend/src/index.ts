import { env } from './config/env';
import { handleRequest } from './router';
import {
  handleWsUpgrade,
  handleWsOpen,
  handleWsClose,
  type WsData,
} from './ws/server';
import { handleWsMessage, setWsServer } from './ws/router';
import { ensureDefaultRoles } from './roles/service';
import { db } from './db/client';
import { startMediaServer, stopMediaServer } from './voice/media-process';
import type { ServerWebSocket } from 'bun';
import { join } from 'path';
import { existsSync } from 'fs';

// ---------------------------------------------------------------------------
// Static file serving — serves the frontend build when present.
// In production the built output lives at frontend/build next to this package.
// ---------------------------------------------------------------------------

const FRONTEND_BUILD = join(import.meta.dir, '../../frontend/build');
const SERVE_STATIC = existsSync(FRONTEND_BUILD);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
};

async function serveStatic(pathname: string): Promise<Response | null> {
  if (!SERVE_STATIC) return null;

  const safe = pathname.replace(/\.\./g, '').replace(/\/+/g, '/');
  const filePath = join(FRONTEND_BUILD, safe);
  const file = Bun.file(filePath);

  if (await file.exists()) {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    const isHashed = /\.[a-f0-9]{8,}\.(js|css|woff2?)$/.test(filePath);
    const cacheControl = isHashed
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';

    return new Response(file, {
      headers: { 'Content-Type': contentType, 'Cache-Control': cacheControl },
    });
  }

  // SPA fallback — serve index.html for any unmatched path
  const index = Bun.file(join(FRONTEND_BUILD, 'index.html'));
  if (await index.exists()) {
    return new Response(index, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }

  return null;
}

async function main() {
  console.log('Connecting to database...');
  await db.$connect();

  await ensureDefaultRoles();

  const { printAdminToken } = await import('./auth/admin-token');
  printAdminToken();

  // Start the mediasoup media server as a managed subprocess
  await startMediaServer();

  console.log(`Starting ${env.APP_NAME} on port ${env.PORT}...`);

  const server = Bun.serve<WsData>({
    port: env.PORT,

    async fetch(req, server) {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      // WebSocket upgrade
      if (url.pathname === '/ws') {
        return handleWsUpgrade(req, server) as Promise<Response>;
      }

      // REST API
      if (url.pathname.startsWith('/api/')) {
        return handleRequest(req);
      }

      // Static file serving
      const staticResponse = await serveStatic(url.pathname);
      if (staticResponse) return staticResponse;

      return handleRequest(req);
    },

    websocket: {
      open(ws: ServerWebSocket<WsData>) {
        handleWsOpen(ws).catch((err) => {
          console.error('[ws] open handler error:', err);
        });
      },
      message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
        handleWsMessage(ws, message, server).catch((err) => {
          console.error('[ws] message handler error:', err);
        });
      },
      close(ws: ServerWebSocket<WsData>, _code: number, _reason: string) {
        handleWsClose(ws).catch((err) => {
          console.error('[ws] close handler error:', err);
        });
      },
      perMessageDeflate: true,
      maxPayloadLength: 1024 * 1024, // 1 MB
      idleTimeout: 120,
      sendPings: true,
    },
  });

  setWsServer(server);

  console.log(`${env.APP_NAME} running at http://localhost:${server.port}`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    stopMediaServer();
    server.stop();
    db.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    stopMediaServer();
    server.stop();
    db.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
