// Persistencia en IndexedDB (Dexie). Todo vive en el dispositivo.
import Dexie, { type Table } from 'dexie';
import type { StateStorage } from 'zustand/middleware';

interface KvRow { key: string; value: string }

class KetoDb extends Dexie {
  kv!: Table<KvRow, string>;
  constructor() {
    super('keto-continuum');
    this.version(1).stores({ kv: 'key' });
  }
}

export const db = new KetoDb();

/** Adaptador para `persist` de Zustand. Si no hay IndexedDB (modo privado antiguo), no guarda. */
export const dexieStorage: StateStorage = {
  async getItem(key) {
    try {
      return (await db.kv.get(key))?.value ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      await db.kv.put({ key, value });
    } catch {
      // sin almacenamiento disponible: la app sigue funcionando en memoria
    }
  },
  async removeItem(key) {
    try {
      await db.kv.delete(key);
    } catch {
      // idem
    }
  },
};
