import { emptyLibrary, type Library } from "./types";
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("podfiy", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("library");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function readLibrary(key = "local"): Promise<Library> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("library");
    const r = tx.objectStore("library").get(key);
    r.onsuccess = () => resolve(r.result ?? structuredClone(emptyLibrary));
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeLibrary(data: Library, key = "local") {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("library", "readwrite");
    tx.objectStore("library").put(data, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
