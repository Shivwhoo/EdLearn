import axios from 'axios';


export type SsoApp = 'edmentor' | 'edcompass' | 'edquiz';

/**
 * Calls the backend's /api/sso/handoff endpoint (Person 1's work) to mint a
 * short-lived signed token, then redirects the browser to the target app with
 * that token attached — the user stays logged in without re-entering
 * credentials. Shared by the AI Tutor chat's intent routing, the workspace
 * header's shortcut buttons, and the Hub dashboard's deep-link cards, so this
 * is the one place that needs to change if the handoff contract ever does.
 *
 * Returns true if the redirect was kicked off, false if it failed — callers
 * should show an error message rather than silently doing nothing.
 */
export async function redirectToApp(app: SsoApp, topic?: string): Promise<boolean> {
  try {
    // Read token from localStorage since this is a utility function outside React
    const token = typeof window !== 'undefined' ? localStorage.getItem('edlearn_token') : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await axios.post('/api/sso/handoff', { app, topic }, { headers });
    if (res.data?.success && res.data?.url) {
      window.location.href = res.data.url;
      return true;
    }
    return false;
  } catch (err) {
    console.error(`SSO handoff to ${app} failed:`, err);
    return false;
  }
}

/**
 * Maps an assistant intent label (from /api/assistant/classify) to the SSO
 * app it should route to. "learn" is intentionally absent — that case never
 * calls this, it stays in the normal /api/generate tutor flow.
 */
export function appForIntent(label: 'mentor' | 'career' | 'quiz'): SsoApp {
  if (label === 'mentor') return 'edmentor';
  if (label === 'career') return 'edcompass';
  return 'edquiz';
}
