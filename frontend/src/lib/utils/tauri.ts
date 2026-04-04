/**
 * Tauri environment detection and server URL management.
 *
 * When running as a Tauri desktop app, the frontend is loaded from local
 * files (file://) rather than a web server, so relative API URLs like /api/*
 * don't resolve. Instead, the user configures a server URL (e.g.
 * https://my-harmony-server.com) which is persisted in localStorage and
 * prepended to all API calls.
 */

const TAURI_SERVER_URL_KEY = 'harmony:serverUrl';

/**
 * Returns true when running inside a Tauri webview.
 * The `__TAURI_INTERNALS__` global is injected by the Tauri runtime.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Returns the configured server URL, or null if not set.
 * Only relevant in Tauri — in the browser the app is already served from
 * the same origin as the backend.
 */
export function getServerUrl(): string | null {
  if (!isTauri()) return null;
  return localStorage.getItem(TAURI_SERVER_URL_KEY);
}

/**
 * Persists the server URL for future launches.
 */
export function setServerUrl(url: string): void {
  // Normalise: strip trailing slash
  const normalised = url.replace(/\/$/, '');
  localStorage.setItem(TAURI_SERVER_URL_KEY, normalised);
}

/**
 * Clears the saved server URL (e.g. to switch servers).
 */
export function clearServerUrl(): void {
  localStorage.removeItem(TAURI_SERVER_URL_KEY);
}

/**
 * Resolves a full URL for an API path.
 *
 * - In the browser: returns the path as-is (e.g. "/api/auth/login")
 *   because the browser is already on the same origin.
 * - In Tauri: prepends the configured server URL
 *   (e.g. "https://harmony.example.com/api/auth/login").
 *   Returns null if no server URL is configured yet.
 */
export function resolveApiUrl(path: string): string | null {
  if (!isTauri()) return path;
  const base = getServerUrl();
  if (!base) return null;
  return `${base}${path}`;
}

/**
 * Resolves the WebSocket URL for the given server.
 *
 * Priority order:
 * 1. Tauri: builds from the user-configured server URL.
 * 2. VITE_WS_URL env var: explicit WS base (used in dev to bypass Vite's
 *    broken WS proxy and connect the browser directly to the backend).
 * 3. Same-origin fallback: derives the URL from window.location (production,
 *    where frontend and backend share the same host).
 */
export function resolveWsUrl(path: string = '/ws'): string | null {
  if (isTauri()) {
    const base = getServerUrl();
    if (!base) return null;
    const wsBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    return `${wsBase}${path}`;
  }

  // VITE_WS_URL lets dev environments point the browser directly at the
  // backend WebSocket port, bypassing Vite's proxy entirely.
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) {
    return `${explicit.replace(/\/$/, '')}${path}`;
  }

  // Production / same-origin: frontend is served from the same host as the backend.
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}
