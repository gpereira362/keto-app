// Exportar e importar todos los datos en JSON.
import type { AppData } from './useApp';
import { EMPTY } from './useApp';

export const BACKUP_APP = 'keto-continuum';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: AppData;
}

export function makeBackup(data: AppData, now = new Date()): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export function backupFileName(now = new Date()): string {
  return `metodo-renacer-${now.toISOString().slice(0, 10)}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Lee un respaldo. Devuelve los datos listos para guardar, o un error en español.
 * Los campos que falten se completan con los valores por defecto.
 */
export function readBackup(text: string): { data: AppData } | { error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'El archivo no es un JSON válido.' };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !isObj(raw.data)) {
    return { error: 'Este archivo no es un respaldo del Método Renacer.' };
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { error: 'El respaldo es de una versión más nueva de la app.' };
  }
  const d = raw.data;
  const arrays = ['exclusions', 'overrides', 'mealSwaps', 'pantry', 'shoppingChecks', 'logs'] as const;
  for (const k of arrays) {
    if (k in d && !Array.isArray(d[k])) return { error: `El respaldo está dañado (${k}).` };
  }
  if (d.profile !== null && d.profile !== undefined) {
    const p = d.profile;
    if (!isObj(p) || typeof p.idealWeightKg !== 'number' || typeof p.startDate !== 'string') {
      return { error: 'El respaldo está dañado (perfil).' };
    }
  }
  const data: AppData = {
    ...EMPTY,
    ...(d as Partial<AppData>),
    settings: { ...EMPTY.settings, ...(isObj(d.settings) ? (d.settings as Partial<AppData['settings']>) : {}) },
  };
  return { data };
}
