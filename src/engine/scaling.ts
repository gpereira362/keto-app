// Escalado de comidas al peso ideal y redondeo de porciones.
import { food, meal } from './data';
import type { FoodId, Macros, MealId, MealItem, ScaledItem } from './types';

/** Las cantidades base de meals.json corresponden a este peso ideal. */
export const REF_KG = 60;
export const CARB_LIMIT = 20;

/**
 * Redondeo igual al `round()` de Python (mitades al par), para dar los mismos
 * resultados que docs/reference_impl.py y los archivos golden.
 */
export function pyRound(x: number, digits = 0): number {
  if (digits === 0) {
    const f = Math.floor(x);
    if (x - f === 0.5) return f % 2 === 0 ? f : f + 1;
    return Math.round(x);
  }
  // Empate exacto solo si x · 2^(digits+1) es un entero impar.
  const probe = x * 2 ** (digits + 1);
  if (Number.isInteger(probe) && Math.abs(probe) % 2 === 1) {
    const m = 10 ** digits;
    return pyRound(x * m) / m;
  }
  return Number(x.toFixed(digits));
}

/** Redondea al paso del alimento, sin bajar nunca de un paso. */
export function roundToStep(x: number, step: number): number {
  return Math.max(step, pyRound(x / step) * step);
}

export function scaleFactor(idealWeightKg: number): number {
  return idealWeightKg / REF_KG;
}

export function scaleQty(foodId: FoodId, qty: number, factor: number): number {
  const f = food(foodId);
  if (!f.scalable) return qty;
  return pyRound(roundToStep(qty * factor, f.roundStep), 2);
}

export function macrosOf(foodId: FoodId, qty: number): Macros {
  const f = food(foodId);
  return { protein: f.protein * qty, fat: f.fat * qty, carbs: f.carbs * qty };
}

export function totals(items: MealItem[]): Macros {
  const t = { protein: 0, fat: 0, carbs: 0 };
  for (const i of items) {
    const m = macrosOf(i.food, i.qty);
    t.protein += m.protein;
    t.fat += m.fat;
    t.carbs += m.carbs;
  }
  return t;
}

export function addMacros(a: Macros, b: Macros): Macros {
  return { protein: a.protein + b.protein, fat: a.fat + b.fat, carbs: a.carbs + b.carbs };
}

export function roundMacros(m: Macros, digits = 1): Macros {
  return { protein: pyRound(m.protein, digits), fat: pyRound(m.fat, digits), carbs: pyRound(m.carbs, digits) };
}

export function scaleMealItems(mealId: MealId, idealWeightKg: number): MealItem[] {
  const factor = scaleFactor(idealWeightKg);
  return meal(mealId).items.map((i) => ({ food: i.food, qty: scaleQty(i.food, i.qty, factor) }));
}

// ---------------------------------------------------------------- texto de la porción

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

/** 3 → "3", 1.5 → "1½", 0.5 → "½", 2.25 → "2¼". */
export function formatQty(q: number): string {
  const whole = Math.floor(q);
  const frac = pyRound(q - whole, 2);
  const sym = FRACTIONS[String(frac)];
  if (frac === 0) return String(whole);
  if (sym) return whole === 0 ? sym : `${whole}${sym}`;
  return String(pyRound(q, 2)).replace('.', ',');
}

function pluralizeWord(w: string): string {
  if (/ón$/.test(w)) return w.slice(0, -2) + 'ones';
  if (/[aeiouáéó]$/i.test(w)) return w + 's';
  return w + 'es';
}

/** "3 huevos", "150 g de ribeye (cocido)", "1½ cdas de mantequilla", "½ taza de chucrut". */
export function portionText(foodId: FoodId, qty: number): string {
  const f = food(foodId);
  const n = formatQty(qty);
  if (qty === 1) return f.unit.match(/^[\d½¼¾]/) ? f.unit : `1 ${f.unit}`;
  if (f.unit.startsWith('g ')) return `${n} ${f.unit}`;
  if (qty < 1 && !f.unit.match(/^[\d½¼¾]/)) return `${n} ${f.unit}`;
  if (f.unitPlural) return `${n} ${f.unitPlural}`;
  // La unidad ya trae cantidad ("½ taza de…", "6 aceitunas"): se multiplica.
  if (f.unit.match(/^[\d½¼¾]/)) return `${n} × ${f.unit}`;
  const [first, ...rest] = f.unit.split(' ');
  return [n, pluralizeWord(first), ...rest].join(' ');
}

export function scaledItem(item: MealItem): ScaledItem {
  return { food: item.food, qty: item.qty, text: portionText(item.food, item.qty), macros: macrosOf(item.food, item.qty) };
}
