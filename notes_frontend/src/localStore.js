const DB_KEY = 'notes_db_v1';

function loadDb() {
  try {
    const raw = globalThis.localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    // Ignore parse errors and fallback to default DB
    void err;
  }
  // Initialize a default DB
  const db = {
    users: [
      // demo user for quick start
      { id: 'u_demo', email: 'demo@example.com', password: 'demo', name: 'Demo User' }
    ],
    sessions: {},
    folders: [
      { id: 'f_all', name: 'All Notes', system: true },
      { id: 'f_uncat', name: 'Uncategorized', system: true }
    ],
    notes: []
  };
  globalThis.localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

function saveDb(db) {
  globalThis.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// PUBLIC_INTERFACE
export const LocalStore = {
  /** Local-only: login with email/password; returns {user, token} or throws. */
  login(email, password) {
    const db = loadDb();
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) {
      throw new Error('Invalid email or password');
    }
    const token = uid('t');
    db.sessions[token] = { userId: user.id, createdAt: nowIso() };
    saveDb(db);
    return { user: { id: user.id, email: user.email, name: user.name }, token };
  },

  /** Local-only: register a user; returns {user, token}. */
  register(name, email, password) {
    const db = loadDb();
    if (db.users.find(u => u.email === email)) {
      throw new Error('Email already registered');
    }
    const user = { id: uid('u'), name, email, password };
    db.users.push(user);
    const token = uid('t');
    db.sessions[token] = { userId: user.id, createdAt: nowIso() };
    saveDb(db);
    return { user: { id: user.id, email: user.email, name: user.name }, token };
  },

  /** Local-only: logout removes session token. */
  logout(token) {
    const db = loadDb();
    delete db.sessions[token];
    saveDb(db);
    return true;
  },

  /** Returns all folders (system first). */
  getFolders() {
    const db = loadDb();
    return [...db.folders];
  },

  /** Creates a new folder. */
  createFolder(name) {
    const db = loadDb();
    const folder = { id: uid('f'), name };
    db.folders.push(folder);
    saveDb(db);
    return folder;
  },

  /** Updates a folder name (cannot edit system folders). */
  updateFolder(id, name) {
    const db = loadDb();
    const f = db.folders.find(x => x.id === id && !x.system);
    if (!f) throw new Error('Folder not found or is system folder');
    f.name = name;
    saveDb(db);
    return f;
  },

  /** Deletes a folder and moves its notes to Uncategorized. */
  deleteFolder(id) {
    const db = loadDb();
    const idx = db.folders.findIndex(x => x.id === id && !x.system);
    if (idx === -1) throw new Error('Folder not found or is system folder');
    db.folders.splice(idx, 1);
    const uncatId = 'f_uncat';
    db.notes = db.notes.map(n => (n.folderId === id ? { ...n, folderId: uncatId } : n));
    saveDb(db);
    return true;
  },

  /** Returns notes filtered by query and optional folderId. */
  getNotes({ query = '', folderId = null } = {}) {
    const db = loadDb();
    let notes = [...db.notes];
    if (folderId && folderId !== 'f_all') {
      notes = notes.filter(n => n.folderId === folderId);
    }
    if (query) {
      const q = query.toLowerCase();
      notes = notes.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }
    // sort by updatedAt desc
    notes.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return notes;
  },

  /** Creates a note (defaults to Uncategorized). */
  createNote({ title = '', content = '', folderId = 'f_uncat' }) {
    const db = loadDb();
    const note = {
      id: uid('n'),
      title: title || 'Untitled',
      content,
      folderId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.notes.unshift(note);
    saveDb(db);
    return note;
  },

  /** Updates a note. */
  updateNote(id, patch) {
    const db = loadDb();
    const n = db.notes.find(x => x.id === id);
    if (!n) throw new Error('Note not found');
    Object.assign(n, patch, { updatedAt: nowIso() });
    saveDb(db);
    return n;
  },

  /** Deletes a note. */
  deleteNote(id) {
    const db = loadDb();
    const idx = db.notes.findIndex(x => x.id === id);
    if (idx === -1) throw new Error('Note not found');
    db.notes.splice(idx, 1);
    saveDb(db);
    return true;
  },
};
