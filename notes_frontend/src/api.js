import { getConfig } from './config.js';
import { LocalStore } from './localStore.js';

// Utility: unwrap fetch responses
async function unwrap(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch { /* ignore parse error */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Remote API layer. If apiBaseUrl is not configured, calls will throw which the
 * DataService will handle by falling back to LocalStore.
 */
class RemoteAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  url(path) {
    return `${this.baseUrl}${path}`;
  }

  // PUBLIC_INTERFACE
  async login(email, password) {
    /** POST /auth/login -> { user, token } */
    const res = await globalThis.fetch(this.url('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async register(name, email, password) {
    /** POST /auth/register -> { user, token } */
    const res = await globalThis.fetch(this.url('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
      credentials: 'include',
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async logout(token) {
    /** POST /auth/logout -> 204 */
    const res = await globalThis.fetch(this.url('/auth/logout'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async getFolders(token) {
    /** GET /folders -> [{id,name,system?}] */
    const res = await globalThis.fetch(this.url('/folders'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async createFolder(token, name) {
    /** POST /folders -> {id,name} */
    const res = await globalThis.fetch(this.url('/folders'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async updateFolder(token, id, name) {
    /** PUT /folders/:id -> {id,name} */
    const res = await globalThis.fetch(this.url(`/folders/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async deleteFolder(token, id) {
    /** DELETE /folders/:id -> 204 */
    const res = await globalThis.fetch(this.url(`/folders/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async getNotes(token, { query = '', folderId = null } = {}) {
    /** GET /notes?query=...&folderId=... -> [note] */
    const params = new globalThis.URLSearchParams();
    if (query) params.set('query', query);
    if (folderId) params.set('folderId', folderId);
    const res = await globalThis.fetch(this.url(`/notes?${params.toString()}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async createNote(token, { title, content, folderId }) {
    /** POST /notes -> note */
    const res = await globalThis.fetch(this.url('/notes'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify({ title, content, folderId }),
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async updateNote(token, id, patch) {
    /** PUT /notes/:id -> note */
    const res = await globalThis.fetch(this.url(`/notes/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    return unwrap(res);
  }

  // PUBLIC_INTERFACE
  async deleteNote(token, id) {
    /** DELETE /notes/:id -> 204 */
    const res = await globalThis.fetch(this.url(`/notes/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    return unwrap(res);
  }
}

// PUBLIC_INTERFACE
export const DataService = {
  /** Attempts to use Remote API if configured; falls back to LocalStore otherwise. */
  getClient() {
    const { apiBaseUrl } = getConfig();
    if (apiBaseUrl) return new RemoteAPI(apiBaseUrl);
    // Fallback handled by returning null client
    return null;
  },

  /** Auth */
  async login(email, password) {
    const client = this.getClient();
    if (client) {
      try { return await client.login(email, password); } catch { /* fall back */ }
    }
    return LocalStore.login(email, password);
  },

  async register(name, email, password) {
    const client = this.getClient();
    if (client) {
      try { return await client.register(name, email, password); } catch { /* fall back */ }
    }
    return LocalStore.register(name, email, password);
  },

  async logout(token) {
    const client = this.getClient();
    if (client) {
      try { await client.logout(token); } catch { /* ignore */ }
    }
    return LocalStore.logout(token);
  },

  /** Folders */
  async getFolders(token) {
    const client = this.getClient();
    if (client) {
      try { return await client.getFolders(token); } catch { /* fall back */ }
    }
    return LocalStore.getFolders();
  },

  async createFolder(token, name) {
    const client = this.getClient();
    if (client) {
      try { return await client.createFolder(token, name); } catch { /* fall back */ }
    }
    return LocalStore.createFolder(name);
  },

  async updateFolder(token, id, name) {
    const client = this.getClient();
    if (client) {
      try { return await client.updateFolder(token, id, name); } catch { /* fall back */ }
    }
    return LocalStore.updateFolder(id, name);
  },

  async deleteFolder(token, id) {
    const client = this.getClient();
    if (client) {
      try { return await client.deleteFolder(token, id); } catch { /* fall back */ }
    }
    return LocalStore.deleteFolder(id);
  },

  /** Notes */
  async getNotes(token, filters) {
    const client = this.getClient();
    if (client) {
      try { return await client.getNotes(token, filters); } catch { /* fall back */ }
    }
    return LocalStore.getNotes(filters);
  },

  async createNote(token, payload) {
    const client = this.getClient();
    if (client) {
      try { return await client.createNote(token, payload); } catch { /* fall back */ }
    }
    return LocalStore.createNote(payload);
  },

  async updateNote(token, id, patch) {
    const client = this.getClient();
    if (client) {
      try { return await client.updateNote(token, id, patch); } catch { /* fall back */ }
    }
    return LocalStore.updateNote(id, patch);
  },

  async deleteNote(token, id) {
    const client = this.getClient();
    if (client) {
      try { return await client.deleteNote(token, id); } catch { /* fall back */ }
    }
    return LocalStore.deleteNote(id);
  },
};
