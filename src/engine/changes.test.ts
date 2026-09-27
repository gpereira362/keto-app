import { describe, expect, it } from 'vitest';
import { applyChange, changeSheet, deltaText, originalOf, type ChangeChoice } from './changes';
import { programWeek } from './data';
import { planDay } from './plan';
import { shoppingList } from './shopping';
import { CARB_LIMIT } from './scaling';
import { activeExclusions, isExcluded } from './substitutions';
import type { Exclusion, PlanProfile } from './types';

const lun = programWeek(1).days[0]; // DES1 = huevos revueltos con queso
const profile = (exclusions: Exclusion[] = []): PlanProfile => ({ idealWeightKg: 60, exclusions });
const empty = { overrides: [], exclusions: [] };

function choice(scope: ChangeChoice['scope'], extra: Partial<ChangeChoice> = {}): ChangeChoice {
  return {
    scope, week: 1, day: 'Lun', slotIndex: 1, today: '2026-09-30',
    original: { food: 'huevo', qty: 3 }, replacement: [{ food: 'tocino', qty: 6 }], ...extra,
  };
}

describe('hoja "Cambiar ingrediente"', () => {
  it('muestra las opciones del original con el presupuesto del día', () => {
    const day = planDay(lun, profile(), { week: 1 });
    const huevo = day.slots[1].items.find((i) => i.food === 'huevo')!;
    const sheet = changeSheet(day, 1, huevo, []);
    expect(sheet.original).toEqual({ food: 'huevo', qty: 3 });
    expect(sheet.options[0].food).toBe('tocino');
    expect(sheet.options.every((o) => o.food !== 'huevo')).toBe(true);
  });

  it('en un ingrediente ya cambiado, trabaja sobre el original y no ofrece lo que ya está', () => {
    const day = planDay(lun, profile([{ type: 'allergen', id: 'huevo', reason: 'alergia' }]), { week: 1 });
    const tocino = day.slots[1].items.find((i) => i.replaces === 'huevo')!;
    expect(originalOf(day, 1, tocino)).toEqual({ food: 'huevo', qty: 3 });
    const sheet = changeSheet(day, 1, tocino, [{ type: 'allergen', id: 'huevo', reason: 'alergia' }]);
    expect(sheet.options.some((o) => o.food === 'tocino')).toBe(false);
  });

  it('las opciones que pasan de 20 g se marcan (para deshabilitarlas)', () => {
    const day = planDay(lun, profile(), { week: 1 });
    const apio = day.slots[3].items.find((i) => i.food === 'apio')!;
    const sheet = changeSheet(day, 3, apio, []);
    for (const o of sheet.options) {
      const exceeds = day.totals.carbs - apio.macros.carbs + o.macros.carbs > CARB_LIMIT;
      expect(o.flags.includes('excede-carbohidratos')).toBe(exceeds);
    }
  });
});

describe('aplicar un cambio según el alcance', () => {
  it('solo esta comida', () => {
    const s = applyChange(empty, choice('comida'));
    expect(s.overrides).toEqual([
      { scope: 'comida', week: 1, day: 'Lun', slotIndex: 1, food: 'huevo', originalQty: 3, replacement: [{ food: 'tocino', qty: 6 }] },
    ]);
    const day = planDay(lun, profile(), { week: 1, overrides: s.overrides });
    expect(day.slots[1].items[0]).toMatchObject({ food: 'tocino', replaces: 'huevo', changeReason: 'manual' });
  });

  it('volver a cambiar la misma comida reemplaza el cambio anterior', () => {
    const s1 = applyChange(empty, choice('comida'));
    const s2 = applyChange(s1, choice('comida', { replacement: [{ food: 'molida', qty: 110 }] }));
    expect(s2.overrides).toHaveLength(1);
    expect(s2.overrides[0].replacement[0].food).toBe('molida');
  });

  it('toda esta semana', () => {
    const s = applyChange(empty, choice('semana'));
    expect(s.overrides[0]).toMatchObject({ scope: 'semana', week: 1, food: 'huevo' });
    expect(s.exclusions).toEqual([]);
  });

  it('siempre: exclusión "no-me-gusta" + la opción elegida esta semana', () => {
    const s = applyChange(empty, choice('siempre'));
    expect(s.exclusions).toEqual([{ type: 'food', id: 'huevo', reason: 'no-me-gusta' }]);
    expect(s.overrides[0].scope).toBe('semana');
    // Otras semanas usan la sustitución automática.
    const w2 = planDay(programWeek(2).days[0], profile(s.exclusions), { week: 2, overrides: s.overrides });
    expect(w2.slots.flatMap((x) => x.items).some((i) => i.food === 'huevo')).toBe(false);
  });

  it('no lo encuentro: vence el domingo', () => {
    const s = applyChange(empty, choice('no-disponible'));
    expect(s.exclusions).toEqual([{ type: 'food', id: 'huevo', reason: 'no-disponible', until: '2026-10-04' }]);
    expect(activeExclusions(s.exclusions, '2026-10-05')).toEqual([]);
  });

  it('soy alérgica: excluye el grupo confirmado', () => {
    const s = applyChange(empty, choice('alergia', {
      original: { food: 'cheddar', qty: 30 }, replacement: [{ food: 'gouda', qty: 30 }], allergen: 'lacteos',
    }));
    expect(s.exclusions).toEqual([{ type: 'allergen', id: 'lacteos', reason: 'alergia' }]);
    // El gouda también es lácteo: no se guarda como cambio; el plan elige solo.
    expect(s.overrides).toEqual([]);
    const day = planDay(lun, profile(s.exclusions), { week: 1, overrides: s.overrides });
    for (const i of day.slots.flatMap((x) => x.items)) expect(isExcluded(i.food, s.exclusions)).toBe(false);
  });

  it('soy alérgica a un alimento sin grupo: se excluye solo ese alimento', () => {
    const s = applyChange(empty, choice('alergia', { original: { food: 'apio', qty: 1 }, replacement: [{ food: 'pepino', qty: 100 }] }));
    expect(s.exclusions).toEqual([{ type: 'food', id: 'apio', reason: 'alergia' }]);
  });

  it('la lista de compras refleja el cambio (misma fuente)', () => {
    const s = applyChange(empty, choice('semana', {
      original: { food: 'ribeye', qty: 150 }, replacement: [{ food: 'picana', qty: 140 }],
    }));
    const list = shoppingList(1, profile(s.exclusions), { overrides: s.overrides });
    expect(list.lines.some((l) => l.food === 'ribeye')).toBe(false);
    expect(list.lines.some((l) => l.food === 'picana')).toBe(true);
  });
});

describe('texto de la diferencia', () => {
  it('omite lo despreciable', () => {
    expect(deltaText({ protein: 1, fat: -5, carbs: 0 })).toBe('+1 g prot · −5 g grasa');
    expect(deltaText({ protein: 0.2, fat: 0.1, carbs: 0.35 })).toBe('+0,3 g carb');
    expect(deltaText({ protein: 0, fat: 0, carbs: 0 })).toBe('igual');
  });
});
