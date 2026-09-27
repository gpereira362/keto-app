// Acceso tipado a los JSON del programa (data/). Solo lectura.
import foodsJson from '../../data/foods.json';
import mealsJson from '../../data/meals.json';
import weeksJson from '../../data/program-weeks.json';
import stepsJson from '../../data/continuum-steps.json';
import groupsJson from '../../data/substitution-groups.json';
import type { ContinuumStep, FoodFull, FoodId, Meal, MealId, ProgramWeek, SubstitutionGroup } from './types';

export const FOOD_LIST = foodsJson as unknown as FoodFull[];
export const MEAL_LIST = mealsJson as unknown as Meal[];
export const WEEKS = weeksJson as unknown as ProgramWeek[];
export const STEPS = stepsJson as unknown as ContinuumStep[];
const ALL_GROUPS = groupsJson as unknown as (SubstitutionGroup & { matchBy?: SubstitutionGroup['matchBy'] })[];

export const FOODS: Record<FoodId, FoodFull> = Object.fromEntries(FOOD_LIST.map((f) => [f.id, f]));
export const MEALS: Record<MealId, Meal> = Object.fromEntries(MEAL_LIST.map((m) => [m.id, m]));

/** Grasas para completar un sustituto magro, en orden de preferencia. */
export const FAT_TOPUP_ORDER: FoodId[] = ALL_GROUPS.find((g) => g.id === '__fat_topup_order')!.members;
/** Grupos de sustitución reales (sin los que empiezan con "__"). */
export const GROUPS: SubstitutionGroup[] = ALL_GROUPS.filter((g) => !g.id.startsWith('__'));

export function food(id: FoodId): FoodFull {
  const f = FOODS[id];
  if (!f) throw new Error(`Alimento desconocido: ${id}`);
  return f;
}

export function meal(id: MealId): Meal {
  const m = MEALS[id];
  if (!m) throw new Error(`Comida desconocida: ${id}`);
  return m;
}

export function programWeek(week: number): ProgramWeek {
  const w = WEEKS.find((x) => x.week === week);
  if (!w) throw new Error(`Semana fuera del programa: ${week}`);
  return w;
}
