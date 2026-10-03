// Fase 5 · Vivir: después de la semana 14 se suben los carbohidratos de 10 en 10 g por semana
// hasta que la glucosa en ayunas o la cintura suben. Ese es el punto de equilibrio, y ahí se queda.
import carbsJson from '../../data/vivir-carbs.json';
import { programWeek } from './data';
import { addDays, daysBetween } from './plan';
import type { DailyLog, DayPlan, ProgressState, VivirState } from './types';

export const VIVIR_START_LEVEL = 30;   // la primera semana: 20 g + 10 g
export const VIVIR_STEP = 10;
export const VIVIR_MAX_LEVEL = 100;
export const RESET_DAYS = 7;
/** Plantilla de comidas de la fase Vivir: dos comidas en ventana de 8 horas (semana 7). */
export const VIVIR_TEMPLATE_WEEK = 7;

export interface CarbPortion { id: string; label: string; carbs: number }
export const CARB_PORTIONS = carbsJson as CarbPortion[];

export const VIVIR_RULES = [
  'Proteína primero en cada comida; después verduras y grasa natural.',
  'Carbohidratos de verdad (fruta, tubérculos, legumbres) solo dentro de tu nivel del día.',
  'Ventana de comida de 8 a 10 horas casi todos los días.',
  'Ejercicio de fuerza 2 o 3 veces por semana.',
  '80 % del tiempo el plan; 20 % flexible y sin culpa.',
  'Si la cintura sube 2 cm o la glucosa se queda alta: 7 días de reinicio a 20 g.',
  'Mide cintura, peso y glucosa una vez al mes.',
];

export function startVivir(progress: ProgressState, today: string): ProgressState {
  const history = progress.history.map((h, i) => (i === progress.history.length - 1 && !h.endedAt ? { ...h, endedAt: today } : h));
  return { ...progress, history, vivir: { startedAt: today, level: VIVIR_START_LEVEL, checkins: [] } };
}

/** Día de Vivir (desde 1) y su plantilla de comidas. */
export function vivirDay(v: VivirState, today: string): { dayNumber: number; template: DayPlan; week: number } {
  const n = Math.max(0, daysBetween(v.startedAt, today));
  return { dayNumber: n + 1, template: programWeek(VIVIR_TEMPLATE_WEEK).days[n % 7], week: VIVIR_TEMPLATE_WEEK };
}

export function inReset(v: VivirState, today: string): boolean {
  return !!v.resetUntil && today <= v.resetUntil;
}

/** Carbohidratos permitidos hoy: 20 g durante un reinicio; si no, el nivel actual. */
export function todayCarbLimit(v: VivirState, today: string): number {
  return inReset(v, today) ? 20 : v.level;
}

/** ¿Toca la pregunta semanal? Solo mientras se busca el equilibrio, cada 7 días. */
export function checkinDue(v: VivirState, today: string): boolean {
  if (v.equilibrium !== undefined || inReset(v, today)) return false;
  const last = v.checkins.at(-1)?.date ?? v.startedAt;
  return daysBetween(last, today) >= 7;
}

/**
 * Respuesta de la semana: "¿subieron tu glucosa en ayunas o tu cintura?".
 * Sí → el equilibrio es el nivel anterior. No → se suben 10 g (hasta el máximo, que pasa a ser el equilibrio).
 */
export function applyCheckin(v: VivirState, today: string, rose: boolean): VivirState {
  const checkins = [...v.checkins, { date: today, rose, level: v.level }];
  if (rose) {
    const eq = Math.max(20, v.level - VIVIR_STEP);
    return { ...v, checkins, level: eq, equilibrium: eq };
  }
  const next = Math.min(VIVIR_MAX_LEVEL, v.level + VIVIR_STEP);
  return next >= VIVIR_MAX_LEVEL
    ? { ...v, checkins, level: VIVIR_MAX_LEVEL, equilibrium: VIVIR_MAX_LEVEL }
    : { ...v, checkins, level: next };
}

export function startReset(v: VivirState, today: string): VivirState {
  return { ...v, resetUntil: addDays(today, RESET_DAYS - 1) };
}

/** ¿Conviene un reinicio de 7 días? La cintura subió 2 cm o la glucosa en ayunas promedia 100 o más. */
export function resetSuggestion(v: VivirState, logs: DailyLog[], today: string): string | null {
  if (inReset(v, today)) return null;
  const since = logs.filter((l) => l.date >= v.startedAt && l.date <= today);
  const waists = since.filter((l) => typeof l.waistCm === 'number');
  if (waists.length >= 2) {
    const min = Math.min(...waists.map((l) => l.waistCm!));
    const last = waists.at(-1)!.waistCm!;
    if (last - min >= 2) return `Tu cintura subió ${String(Math.round((last - min) * 10) / 10).replace('.', ',')} cm desde su punto más bajo.`;
  }
  const week = since.filter((l) => l.date > addDays(today, -7) && typeof l.bloodGlucose === 'number');
  if (week.length >= 3) {
    const avg = week.reduce((s, l) => s + l.bloodGlucose!, 0) / week.length;
    if (avg >= 100) return `Tu glucosa en ayunas promedia ${Math.round(avg)} mg/dL esta semana.`;
  }
  return null;
}

/** Porciones de carbohidratos de verdad que caben en lo que queda del día (de menor a mayor). */
export function portionsThatFit(remaining: number): CarbPortion[] {
  return CARB_PORTIONS.filter((p) => p.carbs <= remaining).sort((a, b) => a.carbs - b.carbs);
}
