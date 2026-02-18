"use client";

const DB_NAME = "cubis-whiteboard";
const STORE_NAME = "scenes";
const QUEUE_STORE = "sync-queue";
const LIBRARY_STORE = "library";
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE);
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) db.createObjectStore(LIBRARY_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

export interface LocalScene {
  elements: unknown[];
  appState: unknown;
  files: Record<string, unknown>;
  savedAt: number;
}

export async function saveToLocal(whiteboardId: string, data: Omit<LocalScene, "savedAt">): Promise<void> {
  const db = await openDB();
  const record: LocalScene = { ...data, savedAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record, whiteboardId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFromLocal(whiteboardId: string): Promise<LocalScene | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(whiteboardId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearLocal(whiteboardId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(whiteboardId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Sync queue: stores pending server saves made while offline ──

export async function enqueueSave(whiteboardId: string, data: { elements: unknown[]; appState: unknown; files: Record<string, unknown> }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put({ ...data, queuedAt: Date.now() }, whiteboardId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainSyncQueue(): Promise<number> {
  const db = await openDB();
  const keys: IDBValidKey[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  let synced = 0;
  for (const key of keys) {
    const record = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, "readonly");
      const req = tx.objectStore(QUEUE_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!record) continue;

    try {
      const res = await fetch(`/api/whiteboards/${key as string}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { elements: record.elements, appState: record.appState, files: record.files } }),
      });
      if (res.ok) {
        const delDb = await openDB();
        await new Promise<void>((resolve, reject) => {
          const tx = delDb.transaction(QUEUE_STORE, "readwrite");
          tx.objectStore(QUEUE_STORE).delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        await clearLocal(key as string);
        synced++;
      }
    } catch {
      // Still offline or server error — leave in queue
      break;
    }
  }
  return synced;
}

export async function pendingQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Personal library: local-first persistence ──

const LIBRARY_KEY = "user-library";

export async function saveLibraryLocal(items: unknown[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LIBRARY_STORE, "readwrite");
    tx.objectStore(LIBRARY_STORE).put({ items, savedAt: Date.now() }, LIBRARY_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLibraryLocal(): Promise<{ items: unknown[]; savedAt: number } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LIBRARY_STORE, "readonly");
    const req = tx.objectStore(LIBRARY_STORE).get(LIBRARY_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
