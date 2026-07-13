/**
 * Global axios diagnostics for the whole app.
 *
 * Every page in this project calls the bare `axios` import directly with
 * relative paths (e.g. `axios.post('/api/auth/login', ...)`). In dev, Next's
 * rewrite in next.config.ts ("/api/:path*" -> the Express backend) proxies
 * these server-to-server — the browser never talks cross-origin to the
 * backend directly, so a real CORS failure is not what's happening when a
 * login/signup call comes back as a plain 500 with no useful message.
 *
 * The much more common cause of "500, no error body" here is that the proxy
 * itself couldn't reach the backend at all — e.g. the Express server on
 * :5000 isn't running, crashed on boot, or PORT doesn't match the rewrite's
 * destination. When that happens axios gets `error.request` but no
 * `error.response`, so every call site's existing
 * `err.response?.data?.error || 'fallback text'` pattern falls through to
 * the generic fallback. This interceptor fills in `error.response` with a
 * clear, actionable message in that specific case, so the SAME existing
 * error-handling code in every component surfaces something useful without
 * needing to be rewritten.
 *
 * Import this once for its side effect (see app/layout.tsx) — nothing here
 * needs to be called directly.
 */
import axios from 'axios';

const BACKEND_HINT_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && !error.response) {
      const reason = error.request
        ? `Could not reach the backend server (is it running on ${BACKEND_HINT_URL}? underlying error: ${error.message})`
        : `Request could not be sent: ${error.message}`;

      // Synthesize a response body so existing `err.response?.data?.error`
      // call sites throughout the app pick this message up automatically.
      error.response = {
        data: { error: reason },
        status: 0,
        statusText: 'Network Error',
        headers: {},
        config: error.config,
      };
    }
    return Promise.reject(error);
  }
);

export default axios;
