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
import type { ServerWebSocket } from 'bun';

async function main() {
  console.log('Connecting to database...');
  await db.$connect();

  await ensureDefaultRoles();

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
      idleTimeout: 120, // 2 minutes
      sendPings: true,
    },
  });

  // Provide the server reference to the WS router for channel pub/sub
  setWsServer(server);

  console.log(`${env.APP_NAME} running at http://localhost:${server.port}`);
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
