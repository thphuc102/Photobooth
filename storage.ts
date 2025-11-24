// Lightweight IndexedDB persistence utilities
// Stores: settings, sessions(history), frames, layouts

export interface PersistedState<T> { value: T; timestamp: number; }

const DB_NAME = 'photobooth-db';
const DB_VERSION = 1;
const STORE_SETTINGS = 'settings';
const STORE_SESSIONS = 'sessions';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) db.createObjectStore(STORE_SETTINGS, { keyPath: 'timestamp' });
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) db.createObjectStore(STORE_SESSIONS, { keyPath: 'timestamp' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function persistSettings<T>(settings: T) {
  const db = await openDb();
  const tx = db.transaction(STORE_SETTINGS, 'readwrite');
  tx.objectStore(STORE_SETTINGS).add({ value: settings, timestamp: Date.now() });
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadLatestSettings<T>(): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_SETTINGS, 'readonly');
  const store = tx.objectStore(STORE_SETTINGS);
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as PersistedState<T>[];
      if (!all.length) return resolve(null);
      all.sort((a,b)=> b.timestamp - a.timestamp);
      resolve(all[0].value);
    };
    req.onerror = () => resolve(null);
  });
}

export async function persistSession<T>(session: T) {
  const db = await openDb();
  const tx = db.transaction(STORE_SESSIONS, 'readwrite');
  tx.objectStore(STORE_SESSIONS).add({ value: session, timestamp: Date.now() });
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadLatestSession<T>(): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_SESSIONS, 'readonly');
  const store = tx.objectStore(STORE_SESSIONS);
  return new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as PersistedState<T>[];
      if (!all.length) return resolve(null);
      all.sort((a,b)=> b.timestamp - a.timestamp);
      resolve(all[0].value);
    };
    req.onerror = () => resolve(null);
  });
}
