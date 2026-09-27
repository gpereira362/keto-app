// Aplicar un cambio de ingrediente elegido en la hoja "Cambiar ingrediente".
import { food } from './data';
import { substitutionOptions, endOfWeek, isExcluded } from './substitutions';
import { totals } from './scaling';
import type {
  Allergen, DayPlan, Exclusion, FoodId, MealItem, Override, PlannedDay, PlannedItem, SubstitutionOption,
} from './types';

export type ChangeScope = 'comida' | 'semana' | 'siempre' | 'no-disponible' | 'alergia';

export const SCOPE_LABELS: Record<ChangeScope, string> = {
  comida: 'Solo esta comida',
  semana: 'Toda esta semana',
  siempre: 'Siempre (no me gusta)',
  'no-disponible': 'No lo encuentro esta semana',
  alergia: 'Soy alérgica',
};

/** El ingrediente original del plan detrás de un renglón (si ya fue cambiado, el que reemplazó). */
export function originalOf(day: PlannedDay, slotIndex: number, item: PlannedItem): MealItem {
  if (!item.replaces) return { food: item.food, qty: item.qty };
  const ch = day.changes.find((c) => c.slotIndex === slotIndex && c.original.food === item.replaces);
  return ch ? ch.original : { food: item.replaces, qty: item.qty };
}

/** Renglones de la comida que salen de ese ingrediente original (sustituto + grasa añadida). */
export function itemsFrom(day: PlannedDay, slotIndex: number, originalFood: FoodId): PlannedItem[] {
  return day.slots[slotIndex].items.filter((i) => (i.replaces ?? i.food) === originalFood);
}

export interface ChangeSheet {
  original: MealItem;
  current: PlannedItem[];
  options: SubstitutionOption[];
}

/** Opciones para la hoja "Cambiar": equivalentes del original, con el presupuesto de carbohidratos del día. */
export function changeSheet(day: PlannedDay, slotIndex: number, item: PlannedItem, exclusions: Exclusion[]): ChangeSheet {
  const original = originalOf(day, slotIndex, item);
  const current = itemsFrom(day, slotIndex, original.food);
  const dayCarbsWithout = day.totals.carbs - totals(current).carbs;
  const currentFoods = current.map((i) => i.food);
  const options = substitutionOptions(original.food, original.qty, exclusions, dayCarbsWithout)
    // No ofrecer lo que ya está puesto.
    .filter((o) => !(o.items.length === current.length && o.items.every((x) => currentFoods.includes(x.food))));
  return { original, current, options };
}

export interface ChangeState { overrides: Override[]; exclusions: Exclusion[] }

export interface ChangeChoice {
  scope: ChangeScope;
  week: number;
  day: DayPlan['day'];
  slotIndex: number;
  original: MealItem;
  replacement: MealItem[];
  today: string;
  /** Solo con scope 'alergia': el grupo confirmado. Sin grupo, se excluye solo el alimento. */
  allergen?: Allergen;
}

function sameOverrideKey(a: Override, b: Override): boolean {
  return a.scope === b.scope && a.week === b.week && a.food === b.food &&
    (a.scope === 'semana' || (a.day === b.day && a.slotIndex === b.slotIndex));
}

function withOverride(overrides: Override[], o: Override): Override[] {
  return [...overrides.filter((x) => !sameOverrideKey(x, o)), o];
}

function withExclusion(exclusions: Exclusion[], e: Exclusion): Exclusion[] {
  return [...exclusions.filter((x) => !(x.type === e.type && x.id === e.id)), e];
}

/** Devuelve el nuevo estado de cambios y exclusiones. Pura: el store guarda el resultado. */
export function applyChange(state: ChangeState, c: ChangeChoice): ChangeState {
  const base = { week: c.week, food: c.original.food, originalQty: c.original.qty, replacement: c.replacement };
  const weekOverride: Override = { scope: 'semana', ...base };
  switch (c.scope) {
    case 'comida':
      return { ...state, overrides: withOverride(state.overrides, { scope: 'comida', day: c.day, slotIndex: c.slotIndex, ...base }) };
    case 'semana':
      return { ...state, overrides: withOverride(state.overrides, weekOverride) };
    case 'siempre':
      // Exclusión para siempre; esta semana se usa la opción que eligió.
      return {
        overrides: withOverride(state.overrides, weekOverride),
        exclusions: withExclusion(state.exclusions, { type: 'food', id: c.original.food, reason: 'no-me-gusta' }),
      };
    case 'no-disponible':
      return {
        overrides: withOverride(state.overrides, weekOverride),
        exclusions: withExclusion(state.exclusions, {
          type: 'food', id: c.original.food, reason: 'no-disponible', until: endOfWeek(c.today),
        }),
      };
    case 'alergia': {
      const ex: Exclusion = c.allergen
        ? { type: 'allergen', id: c.allergen, reason: 'alergia' }
        : { type: 'food', id: c.original.food, reason: 'alergia' };
      const exclusions = withExclusion(state.exclusions, ex);
      // Si la opción elegida también lleva el alérgeno, el plan elige solo otra que sea segura.
      const safe = c.replacement.every((r) => !isExcluded(r.food, exclusions));
      return { exclusions, overrides: safe ? withOverride(state.overrides, weekOverride) : state.overrides };
    }
  }
}

/** Grupos de alergia a los que pertenece un alimento. */
export function allergensOf(foodId: FoodId): Allergen[] {
  return food(foodId).allergens;
}

/** "+1 g prot · −5 g grasa · +0,3 g carb" (omite las diferencias despreciables). */
export function deltaText(d: { protein: number; fat: number; carbs: number }): string {
  const fmt = (n: number, digits: number) => {
    const r = Number(n.toFixed(digits));
    return `${r > 0 ? '+' : '−'}${String(Math.abs(r)).replace('.', ',')}`;
  };
  const parts: string[] = [];
  if (Math.abs(d.protein) >= 0.5) parts.push(`${fmt(d.protein, 0)} g prot`);
  if (Math.abs(d.fat) >= 0.5) parts.push(`${fmt(d.fat, 0)} g grasa`);
  if (Math.abs(d.carbs) >= 0.1) parts.push(`${fmt(d.carbs, 1)} g carb`);
  return parts.length ? parts.join(' · ') : 'igual';
}
