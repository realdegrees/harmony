import { env } from './config/env';

console.log(`Starting ${env.APP_NAME} on port ${env.PORT}...`);

// TODO: Initialize database, redis, routes, websocket handlers

const server = Bun.serve({
  port: env.PORT,

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, {
        data: { /* auth data will go here */ },
      });
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // REST API routes
    if (url.pathname.startsWith('/api/')) {
      // TODO: Route to handlers
      return new Response(JSON.stringify({ status: 'ok', app: env.APP_NAME }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  websocket: {
    open(ws) {
      console.log('WebSocket connected');
    },
    message(ws, message) {
      // TODO: Route to WS handlers
    },
    close(ws, code, reason) {
      console.log('WebSocket disconnected', code, reason);
    },
  },
});

console.log(`${env.APP_NAME} running at http://localhost:${server.port}`);
