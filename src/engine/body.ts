// Peso ideal y metas diarias. La proteína se calcula sobre el peso IDEAL, no el actual.
import { programWeek } from './data';
import { CARB_LIMIT } from './scaling';
import type { IdealWeightSource, Macros, Profile } from './types';

export const IDEAL_MIN_KG = 35;
export const IDEAL_MAX_KG = 150;

const CM_PER_INCH = 2.54;
const FIVE_FEET_CM = 152.4;

/** Redondea a medio kilo: 59.9 → 60. */
function toHalfKg(kg: number): number {
  return Math.round(kg * 2) / 2;
}

/** IMC 22: 22 × estatura². 165 cm → 60 kg. */
export function idealWeightBmi22(heightCm: number): number {
  const m = heightCm / 100;
  return toHalfKg(22 * m * m);
}

/** Devine. H: 50 + 0.91 × (cm − 152.4); M: 45.5 + 0.91 × (cm − 152.4). */
export function idealWeightDevine(heightCm: number, sex: Profile['sex']): number {
  const base = sex === 'M' ? 50 : 45.5;
  return toHalfKg(base + 0.91 * (heightCm - FIVE_FEET_CM));
}

/** Robinson (1983). H: 52 + 1.9 kg por pulgada sobre 5 pies; M: 49 + 1.7 kg. */
export function idealWeightRobinson(heightCm: number, sex: Profile['sex']): number {
  const inchesOver = (heightCm - FIVE_FEET_CM) / CM_PER_INCH;
  return toHalfKg(sex === 'M' ? 52 + 1.9 * inchesOver : 49 + 1.7 * inchesOver);
}

export function idealWeight(
  source: Exclude<IdealWeightSource, 'manual'>,
  heightCm: number,
  sex: Profile['sex'],
): number {
  switch (source) {
    case 'bmi22':
      return idealWeightBmi22(heightCm);
    case 'devine':
      return idealWeightDevine(heightCm, sex);
    case 'robinson':
      return idealWeightRobinson(heightCm, sex);
  }
}

/** Devuelve un mensaje de error en español, o null si el valor es válido. */
export function validateIdealWeight(kg: number): string | null {
  if (!Number.isFinite(kg)) return 'Escribe un número.';
  if (kg < IDEAL_MIN_KG || kg > IDEAL_MAX_KG) return `El peso ideal debe estar entre ${IDEAL_MIN_KG} y ${IDEAL_MAX_KG} kg.`;
  return null;
}

export interface ProteinTargets {
  base: number;         // 1.0 g × kg ideal
  max: number;          // 1.6 g × kg ideal
  weekMin: number;      // rango de la semana
  weekMax: number;
}

export function proteinTargets(idealWeightKg: number, week: number): ProteinTargets {
  const { min, max } = programWeek(week).proteinGPerKg;
  return {
    base: idealWeightKg * 1.0,
    max: idealWeightKg * 1.6,
    weekMin: idealWeightKg * min,
    weekMax: idealWeightKg * max,
  };
}

/** Porcentaje de calorías que aporta la grasa en un día (referencia; la meta es 70–80 %). */
export function fatCaloriePct(m: Macros): number {
  const kcal = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  return kcal > 0 ? (m.fat * 9) / kcal : 0;
}

export interface DailyTargets {
  protein: ProteinTargets;
  fatReferenceG: number;     // la grasa del plan: "hasta saciedad"
  fatPct: number;
  carbsMaxG: number;
}

export function dailyTargets(idealWeightKg: number, week: number, planTotals: Macros): DailyTargets {
  return {
    protein: proteinTargets(idealWeightKg, week),
    fatReferenceG: planTotals.fat,
    fatPct: fatCaloriePct(planTotals),
    carbsMaxG: CARB_LIMIT,
  };
}
