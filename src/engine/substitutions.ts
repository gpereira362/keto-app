// Exclusiones (alergia, no me gusta, no disponible) y opciones equivalentes para cambiar un ingrediente.
import { FAT_TOPUP_ORDER, FOOD_LIST, GROUPS, food } from './data';
import { CARB_LIMIT, macrosOf, pyRound, roundToStep, totals } from './scaling';
import type {
  Allergen, Exclusion, FoodId, Macros, MealItem, SubFlag, SubstitutionChange, SubstitutionGroup, SubstitutionOption,
} from './types';

export const ALLERGENS: Allergen[] = ['huevo', 'lacteos', 'pescado', 'mariscos', 'cerdo', 'mostaza', 'coco'];
export const NO_SUBSTITUTE_WARNING = 'sin sustituto válido: elegir otra comida';

// ---------------------------------------------------------------- exclusiones

/** Quita las exclusiones "no-disponible" vencidas. `today` en formato yyyy-mm-dd. */
export function activeExclusions(exclusions: Exclusion[], today: string): Exclusion[] {
  return exclusions.filter((e) => !e.until || e.until >= today);
}

export function isExcluded(foodId: FoodId, exclusions: Exclusion[]): boolean {
  const f = food(foodId);
  return exclusions.some(
    (e) => (e.type === 'food' && e.id === foodId) || (e.type === 'allergen' && f.allergens.includes(e.id as Allergen)),
  );
}

/** Alimentos que llevan un alérgeno (incluye compuestos: la mayonesa lleva huevo). */
export function foodsWithAllergen(allergen: Allergen): FoodId[] {
  return FOOD_LIST.filter((f) => f.allergens.includes(allergen)).map((f) => f.id);
}

/** Domingo de la semana de `date` (lunes a domingo): vencimiento por defecto de "no lo encuentro". */
export function endOfWeek(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0 = domingo
  d.setUTCDate(d.getUTCDate() + ((7 - dow) % 7));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- opciones equivalentes

function round1(m: Macros): Macros {
  return { protein: pyRound(m.protein, 1), fat: pyRound(m.fat, 1), carbs: pyRound(m.carbs, 1) };
}

/** Primera grasa del orden `__fat_topup_order` que no esté excluida. */
export function topUpFat(exclusions: Exclusion[]): FoodId | null {
  return FAT_TOPUP_ORDER.find((x) => !isExcluded(x, exclusions)) ?? null;
}

/**
 * Opciones para reemplazar `qty` de `foodId`, de la mejor a la peor.
 * `dayCarbsWithoutItem`: carbohidratos del día sin este ingrediente. Las opciones que harían
 * pasar el día de 20 g van al final con la marca `excede-carbohidratos`.
 */
export function substitutionOptions(
  foodId: FoodId,
  qty: number,
  exclusions: Exclusion[],
  dayCarbsWithoutItem = 0,
): SubstitutionOption[] {
  const original = food(foodId);
  const old = macrosOf(foodId, qty);
  const own = GROUPS.filter((g) => g.members.includes(foodId) && !g.fallback);
  if (own.length === 0) return [];
  const fallbacks = GROUPS.filter((g) => g.fallback && g.matchBy === own[0].matchBy);

  const out: SubstitutionOption[] = [];
  const seen = new Set<FoodId>();
  for (const g of [...own, ...fallbacks]) {
    const key = g.matchBy;
    const pool = [...g.members, ...(g.extraCandidates ?? [])];
    pool.forEach((cand, rank) => {
      if (cand === foodId || seen.has(cand) || isExcluded(cand, exclusions)) return;
      const cf = food(cand);
      if (cf[key] <= 0) return;
      const newQty = pyRound(roundToStep((qty * original[key]) / cf[key], cf.roundStep), 2);
      const items: MealItem[] = [{ food: cand, qty: newQty }];
      const fresh = macrosOf(cand, newQty);
      const flags: SubFlag[] = [];

      // Completar grasa si el sustituto es más magro.
      if (g.fatTopUp && old.fat - fresh.fat > 5) {
        const gap = old.fat - fresh.fat;
        const fatFood = topUpFat(exclusions);
        if (fatFood) {
          const ff = food(fatFood);
          items.push({ food: fatFood, qty: roundToStep(gap / ff.fat, ff.roundStep) });
          flags.push('grasa-añadida');
        }
      }
      if (fresh.protein > 0 && fresh.fat / fresh.protein < 0.4) flags.push('magro');
      const t = totals(items);
      if (dayCarbsWithoutItem + t.carbs > CARB_LIMIT) flags.push('excede-carbohidratos');

      const delta = round1({ protein: t.protein - old.protein, fat: t.fat - old.fat, carbs: t.carbs - old.carbs });
      const score =
        Math.abs(delta.protein) + Math.abs(delta.fat) / 2 + 3 * Math.abs(delta.carbs) + rank * 2 +
        (g.fallback ? 20 : 0) + (flags.includes('magro') ? 15 : 0);
      out.push({ food: cand, items, group: g.id, macros: round1(t), delta, flags, score: pyRound(score, 1) });
      seen.add(cand);
    });
  }
  const ok = out.filter((o) => !o.flags.includes('excede-carbohidratos'));
  const bad = out.filter((o) => o.flags.includes('excede-carbohidratos'));
  // Array.sort es estable, como sorted() de Python.
  return [...ok.sort((a, b) => a.score - b.score), ...bad];
}

/** Grupos (no fallback) a los que pertenece un alimento. */
export function groupsOf(foodId: FoodId): SubstitutionGroup[] {
  return GROUPS.filter((g) => g.members.includes(foodId) && !g.fallback);
}

// ---------------------------------------------------------------- aplicar exclusiones

export interface ExclusionResult { items: MealItem[]; changes: SubstitutionChange[] }

/**
 * Reemplaza cada alimento excluido por la mejor opción que quepa en `carbBudget`
 * (los carbohidratos disponibles para ESTOS items: 20 g menos lo que suma el resto del día).
 */
export function applyExclusions(items: MealItem[], exclusions: Exclusion[], carbBudget = CARB_LIMIT): ExclusionResult {
  const keep = items.filter((i) => !isExcluded(i.food, exclusions));
  let used = totals(keep).carbs;
  const result = [...keep];
  const changes: SubstitutionChange[] = [];
  for (const i of items) {
    if (!isExcluded(i.food, exclusions)) continue;
    const pick = substitutionOptions(i.food, i.qty, exclusions).find((o) => used + o.macros.carbs <= carbBudget);
    if (pick) {
      result.push(...pick.items);
      used += pick.macros.carbs;
      changes.push({ original: i, replacement: pick.items });
    } else {
      changes.push({ original: i, replacement: null, warning: NO_SUBSTITUTE_WARNING });
    }
  }
  return { items: result, changes };
}
