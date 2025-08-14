import { getConfig } from './config.js';
import { DataService } from './api.js';
import { getSession, setSession, clearSession, isAuthenticated } from './auth.js';

const state = {
  filters: { query: '', folderId: null },
  folders: [],
  notes: [],
  selectedNoteId: null,
  editing: { title: '', content: '', folderId: null },
  error: null,
  loading: false,
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  });
  for (const c of children.flat()) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/* Navbar */
function Navbar() {
  const { appName } = getConfig();
  const session = getSession();
  const search = el('input', {
    type: 'search',
    placeholder: 'Search notes…',
    class: 'search-input',
    value: state.filters.query,
    oninput: (e) => {
      state.filters.query = e.target.value;
      refreshNotes();
    }
  });

  const logoutBtn = el('button', { class: 'btn' }, 'Logout');
  logoutBtn.addEventListener('click', async () => {
    try {
      await DataService.logout(session?.token || '');
    } finally {
      clearSession();
      render();
    }
  });

  const newNoteBtn = el('button', { class: 'btn primary' }, 'New Note');
  newNoteBtn.addEventListener('click', async () => {
    const folderId = state.filters.folderId || 'f_uncat';
    const note = await DataService.createNote(session?.token || '', { title: 'Untitled', content: '', folderId });
    state.selectedNoteId = note.id;
    await refreshNotes();
  });

  return el('div', { class: 'navbar' },
    el('div', { class: 'brand' },
      el('div', { class: 'logo', title: 'Logo' }),
      el('div', {}, appName),
    ),
    el('div', { class: 'nav-actions' },
      search,
      newNoteBtn,
      el('button', { class: 'btn ghost', title: 'Refresh', onclick: refreshNotes }, 'Refresh'),
      el('button', { class: 'btn' }, session?.user?.email || 'User'),
      logoutBtn,
    ),
  );
}

/* Sidebar (Folders) */
function Sidebar() {
  const section = el('div', { class: 'sidebar' });

  // Add Folder form
  const input = el('input', { class: 'input', placeholder: 'New folder name' });
  const addBtn = el('button', { class: 'btn accent', onclick: async () => {
    if (!input.value.trim()) return;
    const s = getSession();
    await DataService.createFolder(s?.token || '', input.value.trim());
    input.value = '';
    await refreshFolders();
  } }, 'Add');

  section.append(
    el('div', { class: 'section-title' }, 'Folders'),
    el('div', { class: 'auth-row' }, input, addBtn),
  );

  const ul = el('ul', { class: 'folder-list' });

  function renderFolderItem(f) {
    const isActive = (state.filters.folderId || 'f_all') === f.id;
    const li = el('li', { class: `folder-item ${isActive ? 'active':''}` });

    const click = () => {
      state.filters.folderId = f.id;
      state.selectedNoteId = null;
      refreshNotes();
      render();
    };

    const label = el('div', { onclick: click, style: 'flex:1;' }, f.name);
    const actions = el('div', { class: 'folder-actions' });

    if (!f.system) {
      const editBtn = el('button', { class: 'btn ghost', title: 'Rename' }, '✏️');
      editBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const name = (globalThis.prompt && globalThis.prompt('Rename folder', f.name)) || '';
        if (name && name.trim()) {
          const s = getSession();
          await DataService.updateFolder(s?.token || '', f.id, name.trim());
          await refreshFolders();
        }
      });
      const delBtn = el('button', { class: 'btn ghost', title: 'Delete' }, '🗑');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (globalThis.confirm && globalThis.confirm('Delete this folder? Notes will move to Uncategorized.')) {
          const s = getSession();
          await DataService.deleteFolder(s?.token || '', f.id);
          if (state.filters.folderId === f.id) state.filters.folderId = 'f_all';
          await refreshFolders();
          await refreshNotes();
        }
      });
      actions.append(editBtn, delBtn);
    }

    li.append(label, actions);
    return li;
  }

  state.folders.forEach(f => ul.append(renderFolderItem(f)));
  section.append(ul);
  return section;
}

/* Notes List Pane */
function NotesList() {
  const pane = el('div', { class: 'list-pane' });

  const toolbar = el('div', { class: 'toolbar' },
    el('span', { class: 'badge' }, 'Notes'),
    el('span', { class: 'badge' }, `${state.notes.length} items`),
  );

  const list = el('div', { class: 'notes' });
  if (!state.notes.length) {
    list.append(el('div', { class: 'empty' }, 'No notes found.'));
  } else {
    state.notes.forEach(n => {
      const card = el('div', { class: 'note-card', onclick: () => {
        state.selectedNoteId = n.id;
        state.editing = { title: n.title, content: n.content, folderId: n.folderId };
        render();
      }});
      const title = el('div', { class: 'note-title' }, n.title || 'Untitled');
      const preview = el('div', { class: 'note-preview', style: 'color: var(--text-muted); font-size: 13px; margin-top: 4px;' },
        (n.content || '').slice(0, 160) || 'No content');

      const meta = el('div', { class: 'note-meta' },
        el('span', {}, new Date(n.updatedAt || n.createdAt).toLocaleString()),
        el('span', {}, '·'),
        el('span', {}, (state.folders.find(f => f.id === n.folderId)?.name) || 'Uncategorized'),
      );

      card.append(title, preview, meta);
      list.append(card);
    });
  }

  pane.append(toolbar, list);
  return pane;
}

/* Editor Pane */
function EditorPane() {
  const note = state.notes.find(n => n.id === state.selectedNoteId);
  if (!note) return el('div', { class: 'editor-pane' },
    el('div', { class: 'empty' }, 'Select a note to view and edit.')
  );

  state.editing = state.editing || { title: note.title, content: note.content, folderId: note.folderId };

  const titleInput = el('input', {
    class: 'editor-title',
    value: state.editing.title || '',
    placeholder: 'Note title',
    oninput: (e) => { state.editing.title = e.target.value; },
  });

  const folderSelect = el('select', { class: 'input', style: 'max-width:240px;' });
  state.folders
    .filter(f => f.id !== 'f_all')
    .forEach(f => {
      const opt = el('option', { value: f.id }, f.name);
      if (f.id === (state.editing.folderId || 'f_uncat')) opt.selected = true;
      folderSelect.append(opt);
    });
  folderSelect.addEventListener('change', (e) => {
    state.editing.folderId = e.target.value;
  });

  const textArea = el('textarea', {
    class: 'editor-textarea',
    placeholder: 'Start typing your note...',
  },);
  textArea.value = state.editing.content || '';
  textArea.addEventListener('input', (e) => {
    state.editing.content = e.target.value;
  });

  const saveBtn = el('button', { class: 'btn primary' }, 'Save');
  saveBtn.addEventListener('click', async () => {
    const s = getSession();
    await DataService.updateNote(s?.token || '', note.id, {
      title: state.editing.title || 'Untitled',
      content: state.editing.content || '',
      folderId: state.editing.folderId || 'f_uncat',
    });
    await refreshNotes();
  });

  const delBtn = el('button', { class: 'btn', title: 'Delete' }, 'Delete');
  delBtn.addEventListener('click', async () => {
    if (!(globalThis.confirm && globalThis.confirm('Delete this note?'))) return;
    const s = getSession();
    await DataService.deleteNote(s?.token || '', note.id);
    state.selectedNoteId = null;
    await refreshNotes();
  });

  const header = el('div', { class: 'editor-header' },
    el('span', { class: 'badge' }, 'Editor'),
    el('div', { style: 'flex:1;' }),
    saveBtn,
    delBtn,
  );

  return el('div', { class: 'editor-pane' },
    header,
    el('div', { class: 'editor-content' },
      titleInput,
      el('div', { class: 'meta-row' }, el('span', { class: 'badge' }, 'Folder'), folderSelect),
      textArea,
    ),
  );
}

/* Auth Screens */
function AuthScreen() {
  const { appName } = getConfig();
  const container = el('div', { class: 'auth-container' });
  const card = el('div', { class: 'auth-card' });

  const title = el('h1', {}, appName);
  const hint = el('div', { class: 'hint' }, 'Login with demo@example.com / demo, or create a new account.');

  const nameInput = el('input', { class: 'input', placeholder: 'Name (for registration)', autocomplete: 'name' });
  const emailInput = el('input', { class: 'input', placeholder: 'Email', type: 'email', autocomplete: 'email' });
  const passInput = el('input', { class: 'input', placeholder: 'Password', type: 'password', autocomplete: 'current-password' });

  const errorBox = el('div', { class: 'error', style: 'display:none;' });

  async function doLogin() {
    errorBox.style.display = 'none';
    try {
      const { user, token } = await DataService.login(emailInput.value.trim(), passInput.value.trim());
      setSession({ user, token });
      render();
    } catch (e) {
      errorBox.textContent = e.message || 'Login failed';
      errorBox.style.display = '';
    }
  }

  async function doRegister() {
    errorBox.style.display = 'none';
    try {
      const name = nameInput.value.trim() || 'User';
      const { user, token } = await DataService.register(name, emailInput.value.trim(), passInput.value.trim());
      setSession({ user, token });
      render();
    } catch (e) {
      errorBox.textContent = e.message || 'Registration failed';
      errorBox.style.display = '';
    }
  }

  const row = el('div', { class: 'auth-row' },
    el('button', { class: 'btn primary', onclick: doLogin }, 'Login'),
    el('button', { class: 'btn', onclick: doRegister }, 'Register'),
  );

  card.append(title, hint, nameInput, emailInput, passInput, errorBox, row);
  container.append(card);
  return container;
}

/* Main Shell */
function AppShell() {
  const shell = el('div', { class: 'app-shell' });
  shell.append(Navbar());

  const main = el('div', { class: 'main' },
    Sidebar(),
    NotesList(),
    EditorPane(),
  );

  shell.append(main);
  return shell;
}

/* Data Loading */
async function refreshFolders() {
  const s = getSession();
  state.folders = await DataService.getFolders(s?.token || '');
  // Ensure 'All Notes' is first for display (if using local fallback preset)
  state.folders.sort((a, b) => {
    const aw = a.system ? (a.id === 'f_all' ? -2 : -1) : 0;
    const bw = b.system ? (b.id === 'f_all' ? -2 : -1) : 0;
    return aw - bw || a.name.localeCompare(b.name);
  });
  if (!state.filters.folderId) state.filters.folderId = 'f_all';
}

async function refreshNotes() {
  const s = getSession();
  state.notes = await DataService.getNotes(s?.token || '', { ...state.filters });
  if (state.selectedNoteId) {
    const stillExists = state.notes.some(n => n.id === state.selectedNoteId);
    if (!stillExists) state.selectedNoteId = null;
  }
  render();
}

/* Render helpers */
function mount(root) {
  root.innerHTML = '';
  if (!isAuthenticated()) {
    root.append(AuthScreen());
    return;
  }
  root.append(AppShell());
}

function render() {
  const appRoot = document.getElementById('app');
  if (!appRoot) {
    globalThis.console && globalThis.console.error && globalThis.console.error('Missing #app root element');
    return;
  }
  mount(appRoot);
}

async function initData() {
  await refreshFolders();
  await refreshNotes();
}

// PUBLIC_INTERFACE
export function initApp() {
  /** Entry point: initializes and renders the Notes Organizer SPA. */
  render();
  if (isAuthenticated()) {
    initData();
  }
}

// DEVELOPMENT NOTES:
// - DataService is prepared for a backend 'notes_database' via REST endpoints.
// - Set VITE_API_BASE_URL in .env to point to the backend. Without it, app falls back to localStorage.
