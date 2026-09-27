import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Profile } from '../engine/types';
import { db } from './db';
import { EMPTY, planProfile, useApp } from './useApp';

const profile: Profile = {
  sex: 'F', heightCm: 165, currentWeightKg: 72, idealWeightKg: 60, idealWeightSource: 'bmi22',
  startDate: '2026-10-05', wakeTime: '06:30', sunriseTime: '06:10', onBpMeds: false, onGlucoseMeds: false,
  units: { weight: 'kg', glucose: 'mg/dL' },
};

describe('estado de la app', () => {
  beforeEach(() => useApp.setState(EMPTY));

  it('el onboarding guarda perfil, exclusiones y arranca en la semana 1', () => {
    useApp.getState().completeOnboarding(profile, [{ type: 'allergen', id: 'huevo', reason: 'alergia' }]);
    const s = useApp.getState();
    expect(s.profile?.idealWeightKg).toBe(60);
    expect(s.progress).toMatchObject({ currentWeek: 1, weekStartedAt: '2026-10-05' });
    expect(s.exclusions).toHaveLength(1);
  });

  it('"Comí esto" marca y desmarca', () => {
    const { toggleMealEaten } = useApp.getState();
    toggleMealEaten('2026-10-05', 'DES1');
    expect(useApp.getState().logs[0].mealsEaten).toEqual(['DES1']);
    toggleMealEaten('2026-10-05', 'DES1');
    expect(useApp.getState().logs[0].mealsEaten).toEqual([]);
  });

  it('no se puede iniciar un ayuno sin confirmar la advertencia médica', () => {
    const { startFast } = useApp.getState();
    expect(() => startFast('2026-12-21', '2026-12-21T17:00:00Z', false)).toThrow(/advertencia/);
    startFast('2026-12-21', '2026-12-21T17:00:00Z', true);
    expect(useApp.getState().logs[0]).toMatchObject({ medicalWarningAcknowledged: true, fastStartedAt: '2026-12-21T17:00:00Z' });
  });

  it('avanzar solo cuando la persona lo pide', () => {
    useApp.getState().completeOnboarding(profile, []);
    useApp.getState().advance('2026-10-12');
    expect(useApp.getState().progress?.currentWeek).toBe(2);
    useApp.getState().repeat('2026-10-19');
    expect(useApp.getState().progress?.currentWeek).toBe(2);
  });

  it('aplicar un cambio y deshacerlo', () => {
    const prev = useApp.getState().applyChange({
      scope: 'siempre', week: 1, day: 'Lun', slotIndex: 1, today: '2026-10-05',
      original: { food: 'huevo', qty: 3 }, replacement: [{ food: 'tocino', qty: 6 }],
    });
    expect(useApp.getState().exclusions).toHaveLength(1);
    expect(useApp.getState().overrides).toHaveLength(1);
    useApp.getState().restoreChanges(prev);
    expect(useApp.getState().exclusions).toEqual([]);
    expect(useApp.getState().overrides).toEqual([]);
  });

  it('casillas de la lista por semana y compra', () => {
    const { toggleShoppingCheck } = useApp.getState();
    toggleShoppingCheck(1, 'huevo');
    toggleShoppingCheck(1, 'huevo', 2);
    toggleShoppingCheck(2, 'huevo');
    expect(useApp.getState().shoppingChecks).toHaveLength(3);
    toggleShoppingCheck(1, 'huevo');
    expect(useApp.getState().shoppingChecks).toEqual([
      { week: 1, food: 'huevo', checked: true, trip: 2 },
      { week: 2, food: 'huevo', checked: true },
    ]);
  });

  it('despensa por semana; 0 la quita', () => {
    const { setPantry } = useApp.getState();
    setPantry(1, 'huevo', 6);
    setPantry(1, 'huevo', 12);
    setPantry(2, 'aceite', 500);
    expect(useApp.getState().pantry).toEqual([{ week: 1, food: 'huevo', amount: 12 }, { week: 2, food: 'aceite', amount: 500 }]);
    setPantry(1, 'huevo', 0);
    expect(useApp.getState().pantry).toEqual([{ week: 2, food: 'aceite', amount: 500 }]);
  });

  it('cambiar una comida completa y deshacer', () => {
    const prev = useApp.getState().swapMeal({ week: 1, day: 'Lun', slotIndex: 3, meal: 'CEN2' });
    expect(useApp.getState().mealSwaps).toEqual([{ week: 1, day: 'Lun', slotIndex: 3, meal: 'CEN2' }]);
    useApp.getState().restoreMealSwaps(prev);
    expect(useApp.getState().mealSwaps).toEqual([]);
  });

  it('importar reemplaza todo', () => {
    useApp.getState().completeOnboarding(profile, []);
    useApp.getState().replaceAll({ ...EMPTY, logs: [{ date: '2026-01-01', mealsEaten: [] }] });
    expect(useApp.getState().profile).toBeNull();
    expect(useApp.getState().logs).toHaveLength(1);
  });

  it('las exclusiones vencidas no llegan al motor', () => {
    const p = planProfile(
      { profile, exclusions: [{ type: 'food', id: 'esparragos', reason: 'no-disponible', until: '2026-10-11' }] },
      '2026-10-12',
    );
    expect(p.exclusions).toEqual([]);
  });

  it('se guarda en IndexedDB', async () => {
    useApp.getState().completeOnboarding(profile, []);
    await new Promise((r) => setTimeout(r, 50));
    const row = await db.kv.get('keto-continuum');
    expect(JSON.parse(row!.value).state.profile.heightCm).toBe(165);
  });
});
