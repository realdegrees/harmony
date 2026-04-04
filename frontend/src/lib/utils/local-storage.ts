/**
 * IndexedDB wrapper for local asset storage in Harmony.
 * Stores local emojis, local sound clips, and favorite GIFs.
 */

const DB_NAME = 'harmony-assets';
const DB_VERSION = 1;

// Object store names
const STORE_EMOJIS = 'local-emojis';
const STORE_SOUNDS = 'local-sounds';
const STORE_FAVORITE_GIFS = 'favorite-gifs';

// ---------------------------------------------------------------------------
// DB initialization
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_EMOJIS)) {
        const emojiStore = db.createObjectStore(STORE_EMOJIS, { keyPath: 'id' });
        emojiStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SOUNDS)) {
        const soundStore = db.createObjectStore(STORE_SOUNDS, { keyPath: 'id' });
        soundStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_FAVORITE_GIFS)) {
        db.createObjectStore(STORE_FAVORITE_GIFS, { keyPath: 'giphyId' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      })
  );
}

function dbGetAll<T>(storeName: string): Promise<T[]> {
  return openDB().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      })
  );
}

function dbPut(storeName: string, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

function dbDelete(storeName: string, key: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

// ---------------------------------------------------------------------------
// Local Emojis
// ---------------------------------------------------------------------------

export interface LocalEmoji {
  id: string;
  name: string;
  blob: Blob;
}

export async function saveLocalEmoji(id: string, name: string, blob: Blob): Promise<void> {
  await dbPut(STORE_EMOJIS, { id, name, blob });
}

export async function getLocalEmojis(): Promise<LocalEmoji[]> {
  return dbGetAll<LocalEmoji>(STORE_EMOJIS);
}

export async function getLocalEmoji(id: string): Promise<LocalEmoji | undefined> {
  return dbGet<LocalEmoji>(STORE_EMOJIS, id);
}

export async function deleteLocalEmoji(id: string): Promise<void> {
  await dbDelete(STORE_EMOJIS, id);
}

// ---------------------------------------------------------------------------
// Local Sounds
// ---------------------------------------------------------------------------

export interface LocalSound {
  id: string;
  name: string;
  blob: Blob;
  duration: number;
}

export async function saveLocalSound(
  id: string,
  name: string,
  blob: Blob,
  duration: number
): Promise<void> {
  await dbPut(STORE_SOUNDS, { id, name, blob, duration });
}

export async function getLocalSounds(): Promise<LocalSound[]> {
  return dbGetAll<LocalSound>(STORE_SOUNDS);
}

export async function getLocalSound(id: string): Promise<LocalSound | undefined> {
  return dbGet<LocalSound>(STORE_SOUNDS, id);
}

export async function deleteLocalSound(id: string): Promise<void> {
  await dbDelete(STORE_SOUNDS, id);
}

// ---------------------------------------------------------------------------
// Favorite GIFs
// ---------------------------------------------------------------------------

export interface FavoriteGifEntry {
  giphyId: string;
  blob: Blob;
  previewBlob: Blob;
}

export async function saveFavoriteGif(
  giphyId: string,
  blob: Blob,
  previewBlob: Blob
): Promise<void> {
  await dbPut(STORE_FAVORITE_GIFS, { giphyId, blob, previewBlob });
}

export async function getFavoriteGifs(): Promise<FavoriteGifEntry[]> {
  return dbGetAll<FavoriteGifEntry>(STORE_FAVORITE_GIFS);
}

export async function getFavoriteGif(giphyId: string): Promise<FavoriteGifEntry | undefined> {
  return dbGet<FavoriteGifEntry>(STORE_FAVORITE_GIFS, giphyId);
}

export async function deleteFavoriteGif(giphyId: string): Promise<void> {
  await dbDelete(STORE_FAVORITE_GIFS, giphyId);
}
