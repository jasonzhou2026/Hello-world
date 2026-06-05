const DB_NAME = "fitness-tracker-pwa";
const DB_VERSION = 1;
const STORES = ["foodEntries", "trainingSessions", "settings"];

function assertStoreName(storeName) {
  if (!STORES.includes(storeName)) {
    throw new Error(`Unknown store: ${storeName}`);
  }
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "id" });
          if (storeName !== "settings") {
            store.createIndex("date", "date");
            store.createIndex("updatedAt", "updatedAt");
          }
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listRecords(storeName) {
  assertStoreName(storeName);

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () =>
      resolve(request.result.filter((record) => !record.deletedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecord(storeName, record) {
  assertStoreName(storeName);

  const db = await openDatabase();
  const now = new Date().toISOString();
  const saved = {
    ...record,
    id: record.id || crypto.randomUUID(),
    createdAt: record.createdAt || now,
    updatedAt: now,
    schemaVersion: 1,
    syncStatus: "local",
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(saved);
    tx.oncomplete = () => resolve(saved);
    tx.onerror = () => reject(tx.error);
  });
}

export async function softDeleteRecord(storeName, id) {
  assertStoreName(storeName);

  const records = await listRecords(storeName);
  const record = records.find((item) => item.id === id);
  if (!record) return;
  return saveRecord(storeName, { ...record, deletedAt: new Date().toISOString() });
}
