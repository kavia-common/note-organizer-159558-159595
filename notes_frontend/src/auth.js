const AUTH_KEY = 'notes_auth_v1';

// PUBLIC_INTERFACE
export function getSession() {
  /** Returns the currently stored session (user and token) or null. */
  try {
    const raw = globalThis.localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export function setSession(session) {
  /** Stores the session { user: {...}, token: string } in localStorage. */
  if (!session) {
    globalThis.localStorage.removeItem(AUTH_KEY);
    return;
  }
  globalThis.localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

// PUBLIC_INTERFACE
export function clearSession() {
  /** Removes any stored session. */
  globalThis.localStorage.removeItem(AUTH_KEY);
}

// PUBLIC_INTERFACE
export function isAuthenticated() {
  /** Returns true if a session token is present. */
  const s = getSession();
  return Boolean(s && s.token);
}
