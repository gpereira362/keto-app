import { describe, expect, it } from 'vitest';
import { backupFileName, makeBackup, readBackup } from './backup';
import { EMPTY, type AppData } from './useApp';

const data: AppData = {
  ...EMPTY,
  profile: {
    sex: 'F', heightCm: 165, currentWeightKg: 72, idealWeightKg: 60, idealWeightSource: 'bmi22',
    startDate: '2026-10-05', wakeTime: '06:30', sunriseTime: '06:10', onBpMeds: false, onGlucoseMeds: false,
    units: { weight: 'kg', glucose: 'mg/dL' },
  },
  exclusions: [{ type: 'allergen', id: 'huevo', reason: 'alergia' }],
  logs: [{ date: '2026-10-05', mealsEaten: ['DES1'], weightKg: 71.5 }],
  progress: { currentWeek: 1, weekStartedAt: '2026-10-05', history: [{ week: 1, startedAt: '2026-10-05', repeated: false }] },
  settings: { shoppingSplit: true, packSizes: { mantequilla: 200 } },
};

describe('respaldo JSON', () => {
  it('exportar e importar devuelve los mismos datos', () => {
    const text = JSON.stringify(makeBackup(data, new Date('2026-10-10T12:00:00Z')));
    expect(readBackup(text)).toEqual({ data });
  });

  it('nombre del archivo con la fecha', () => {
    expect(backupFileName(new Date('2026-10-10T12:00:00Z'))).toBe('keto-continuum-2026-10-10.json');
  });

  it('completa los campos que falten (respaldos viejos)', () => {
    const old = { app: 'keto-continuum', version: 1, exportedAt: '', data: { profile: data.profile, logs: data.logs } };
    const r = readBackup(JSON.stringify(old));
    expect('data' in r && r.data.settings).toEqual(EMPTY.settings);
    expect('data' in r && r.data.exclusions).toEqual([]);
  });

  it('rechaza archivos que no son respaldos', () => {
    expect(readBackup('no es json')).toEqual({ error: 'El archivo no es un JSON válido.' });
    expect(readBackup('{"foo":1}')).toMatchObject({ error: expect.stringMatching(/no es un respaldo/) });
    expect(readBackup(JSON.stringify({ app: 'keto-continuum', version: 99, data: {} }))).toMatchObject({ error: expect.stringMatching(/más nueva/) });
    expect(readBackup(JSON.stringify({ app: 'keto-continuum', version: 1, data: { logs: 'x' } }))).toMatchObject({ error: expect.stringMatching(/dañado/) });
    expect(readBackup(JSON.stringify({ app: 'keto-continuum', version: 1, data: { profile: { foo: 1 } } }))).toMatchObject({ error: expect.stringMatching(/perfil/) });
  });
});
