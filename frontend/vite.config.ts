import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

// Silences the Chrome DevTools automatic project-settings request.
// Chrome asks for this file; without it Vite logs an annoying info message.
function chromeDevtoolsJson(): Plugin {
  return {
    name: 'chrome-devtools-json',
    configureServer(server) {
      server.middlewares.use('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ workspace: { root: process.cwd(), uuid: 'harmony-dev' } }));
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), chromeDevtoolsJson()],
  server: {
    fs: {
      allow: ['..'],
    },
    proxy: {
      // REST API only — WebSocket connections bypass Vite entirely and go
      // directly to the backend. SvelteKit's Vite plugin hooks into the
      // HTTP server's upgrade event for HMR, which prevents http-proxy from
      // ever receiving WS upgrade requests.
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
