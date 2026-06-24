/**
 * Base URL for the Flask API.
 *
 * Production (e.g. chonlife): set `VITE_API_URL` at build time to the real API origin
 * (Dockerfile passes it in). The browser calls that host for `/intro-stats`, `/intro-choice`, etc.
 * Dev-only: when `import.meta.env.DEV` and `VITE_API_URL` is unset, returns `/api` so Vite’s
 * proxy can reach a local Flask process — not used in production builds.
 *
 * Override at runtime: `window.__CHON_API_BASE__` before the app bundle loads.
 */
declare global {
  interface Window {
    __CHON_API_BASE__?: string;
  }
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.__CHON_API_BASE__) {
    return window.__CHON_API_BASE__.replace(/\/$/, '');
  }
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env && env.trim().length > 0) {
    return env.trim().replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    // Proxied by vite.config.ts → Flask :5000 (avoids browser CORS from :5173 → :5000).
    return '/api';
  }
  // Production without VITE_API_URL: same-origin `/api/*` must be reverse-proxied to Flask
  // (see frontend/nginx.config). Do NOT use bare `origin` — `/user-accounts/login` would hit the SPA (200 HTML)
  // and login would never verify passwords.
  if (typeof window !== 'undefined') {
    console.warn(
      '[CHON] VITE_API_URL was not set at build time; using same-origin /api — ensure nginx proxies /api to Flask.'
    );
    return '/api';
  }
  return 'http://localhost:5000';
}
