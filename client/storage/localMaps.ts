import { type PackedMap } from "@/shared/map.ts";
import { getStoredPlayerName } from "../util/playerPrefs.ts";

const DB_NAME = "emoji-sheep-tag";
const DB_VERSION = 2;
const STORE_NAME = "localMaps";

export type LocalMapMetadata = {
  id: string;
  name: string;
  author: string;
  timestamp: number;
};

export type LocalMapEntry = LocalMapMetadata & {
  data: PackedMap;
};

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      } else if (oldVersion < 2) {
        // Migrate from v1 to v2: convert createdAt/updatedAt to timestamp, add author
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const store = transaction.objectStore(STORE_NAME);

        // Delete old index
        if (store.indexNames.contains("updatedAt")) {
          store.deleteIndex("updatedAt");
        }

        // Create new index
        if (!store.indexNames.contains("timestamp")) {
          store.createIndex("timestamp", "timestamp", { unique: false });
        }

        // Migrate existing data
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor) {
            const oldEntry = cursor.value;
            const newEntry: LocalMapEntry = {
              id: oldEntry.id,
              name: oldEntry.name,
              author: getStoredPlayerName() || "Unknown",
              timestamp: oldEntry.updatedAt || oldEntry.createdAt || Date.now(),
              data: oldEntry.data,
            };
            cursor.update(newEntry);
            cursor.continue();
          }
        };
      }
    };
  });

export const saveLocalMap = async (
  id: string,
  name: string,
  data: PackedMap,
): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const entry: LocalMapEntry = {
      id,
      name,
      author: getStoredPlayerName() || "Unknown",
      timestamp: Date.now(),
      data,
    };

    const putRequest = store.put(entry);
    putRequest.onsuccess = () => resolve();
    putRequest.onerror = () => reject(putRequest.error);

    transaction.onerror = () => reject(transaction.error);
  });
};

export const getLocalMap = async (
  id: string,
): Promise<LocalMapEntry | undefined> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getLocalMapByName = async (
  name: string,
): Promise<LocalMapEntry | undefined> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("name");
    const request = index.get(name);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const listLocalMaps = async (): Promise<LocalMapMetadata[]> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("timestamp");
    const request = index.openCursor(null, "prev");

    const results: LocalMapMetadata[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const entry = cursor.value as LocalMapEntry;
        // Only return metadata, not the full data
        results.push({
          id: entry.id,
          name: entry.name,
          author: entry.author,
          timestamp: entry.timestamp,
        });
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => reject(request.error);
  });
};

export const deleteLocalMap = async (id: string): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const exportLocalMapToFile = (
  name: string,
  data: PackedMap,
): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importLocalMapFromFile = (): Promise<{
  name: string;
  data: PackedMap;
}> =>
  new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string) as PackedMap;
          const name = data.name || file.name.replace(/\.json$/i, "");
          resolve({ name, data });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };

    input.click();
  });
