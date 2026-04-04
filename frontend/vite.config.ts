import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
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
