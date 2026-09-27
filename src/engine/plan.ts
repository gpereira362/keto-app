// Plan diario y semanal para un perfil: escala, aplica cambios puntuales y exclusiones con el presupuesto del día.
import { MEAL_LIST, food, meal, programWeek } from './data';
import { CARB_LIMIT, pyRound, roundToStep, scaleMealItems, scaledItem, totals } from './scaling';
import { applyExclusions, isExcluded } from './substitutions';
import type {
  DayPlan, Exclusion, FoodId, MealId, MealItem, MealSwap, Override, PlannedDay, PlannedItem, PlannedSlot,
  PlanProfile, ProgressState, Profile,
} from './types';

export const MANUAL_OVER_LIMIT_WARNING = 'el cambio haría pasar el día de 20 g de carbohidratos';
export const FASTING_WEEKS = [12, 13, 14];
export const MEDICAL_WARNING =
  'Los ayunos largos no son para todos. Si tomas medicamentos para la presión o la glucosa, habla con tu médico ' +
  'antes de empezar: pueden necesitar ajuste. Suspende el ayuno si tienes mareo, palpitaciones o te sientes mal.';

export function isFastingWeek(week: number): boolean {
  return FASTING_WEEKS.includes(week);
}

// ---------------------------------------------------------------- categorías de comida

const CATEGORY_PREFIXES = ['CAF', 'DES', 'ALM', 'CEN', 'P2', 'OM', 'RUP', 'AYU', 'DB'] as const;
export type MealCategory = (typeof CATEGORY_PREFIXES)[number];

export function mealCategory(id: MealId): MealCategory {
  const c = CATEGORY_PREFIXES.find((p) => id.startsWith(p));
  if (!c) throw new Error(`Comida sin categoría: ${id}`);
  return c;
}

export function mealsInCategory(category: MealCategory): MealId[] {
  return MEAL_LIST.filter((m) => mealCategory(m.id) === category).map((m) => m.id);
}

/** Cambia una comida completa por otra de la misma categoría. Devuelve la nueva lista de cambios. */
export function swapMeal(swaps: MealSwap[], swap: MealSwap): MealSwap[] {
  const w = programWeek(swap.week);
  const d = w.days.find((x) => x.day === swap.day);
  const slot = d?.slots[swap.slotIndex];
  if (!slot) throw new Error('Esa comida no existe en el plan.');
  if (mealCategory(slot.meal) !== mealCategory(swap.meal)) {
    throw new Error('Solo se puede cambiar por una comida de la misma categoría.');
  }
  const rest = swaps.filter((s) => !(s.week === swap.week && s.day === swap.day && s.slotIndex === swap.slotIndex));
  return swap.meal === slot.meal ? rest : [...rest, swap];
}

// ---------------------------------------------------------------- horario

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Desde la semana 11 la última comida termina dentro de las 11 h después del amanecer. */
export function eatingWindowClose(sunriseTime: string): string {
  return fromMinutes(toMinutes(sunriseTime)! + 11 * 60);
}

function adjustSlotTime(week: number, time: string, mealId: MealId, sunriseTime?: string): string {
  if (week < 11 || !sunriseTime) return time;
  const t = toMinutes(time);
  const close = toMinutes(sunriseTime);
  if (t === null || close === null || ['CAF', 'AYU'].includes(mealCategory(mealId))) return time;
  const latestStart = close + 11 * 60 - 60; // la comida dura ~1 h
  return fromMinutes(Math.min(t, latestStart));
}

// ---------------------------------------------------------------- cambios puntuales

export interface PlanContext {
  week: number;
  overrides?: Override[];
  mealSwaps?: MealSwap[];
  sunriseTime?: string;
}

function findOverride(overrides: Override[], week: number, day: DayPlan['day'], slotIndex: number, foodId: string) {
  const forFood = overrides.filter((o) => o.week === week && o.food === foodId);
  return (
    forFood.find((o) => o.scope === 'comida' && o.day === day && o.slotIndex === slotIndex) ??
    forFood.find((o) => o.scope === 'semana')
  );
}

/** Ajusta el reemplazo si la cantidad del ingrediente en esta comida difiere de la del cambio guardado. */
function replacementFor(o: Override, qty: number): MealItem[] {
  if (!o.originalQty || o.originalQty === qty) return o.replacement;
  const ratio = qty / o.originalQty;
  return o.replacement.map((r) => ({ food: r.food, qty: pyRound(roundToStep(r.qty * ratio, food(r.food).roundStep), 2) }));
}

function carbsOf(items: MealItem[], exclusions: Exclusion[]): number {
  return totals(items.filter((i) => !isExcluded(i.food, exclusions))).carbs;
}

// ---------------------------------------------------------------- plan del día

/**
 * Escala todas las comidas del día y aplica cambios puntuales y exclusiones,
 * sin pasar nunca de 20 g de carbohidratos en el DÍA.
 */
export function planDay(day: DayPlan, profile: PlanProfile, ctx: PlanContext): PlannedDay {
  const { week, overrides = [], mealSwaps = [] } = ctx;
  const ex = profile.exclusions;
  const dayIndex = programWeek(week).days.findIndex((d) => d.day === day.day);
  const changes: PlannedDay['changes'] = [];

  const mealIds = day.slots.map(
    (s, i) => mealSwaps.find((m) => m.week === week && m.day === day.day && m.slotIndex === i)?.meal ?? s.meal,
  );

  // 1. Escalar.
  const slots: PlannedItem[][] = mealIds.map((id) =>
    scaleMealItems(id, profile.idealWeightKg).map((i) => scaledItem(i)),
  );

  // 2. Cambios puntuales (manuales), sin pasar de 20 g.
  if (overrides.length) {
    slots.forEach((items, si) => {
      const next: PlannedItem[] = [];
      for (const item of items) {
        const o = findOverride(overrides, week, day.day, si, item.food);
        if (!o) {
          next.push(item);
          continue;
        }
        const original = { food: item.food, qty: item.qty };
        const repl = replacementFor(o, item.qty);
        const rest = items.slice(items.indexOf(item) + 1);
        const others = slots.flatMap((it, j) => (j === si ? [...next, ...rest] : it));
        if (carbsOf([...others, ...repl], ex) > CARB_LIMIT) {
          next.push(item);
          changes.push({ slotIndex: si, reason: 'manual', original, replacement: null, warning: MANUAL_OVER_LIMIT_WARNING });
          continue;
        }
        next.push(...repl.map((r) => ({ ...scaledItem(r), replaces: item.food, changeReason: 'manual' as const })));
        changes.push({ slotIndex: si, reason: 'manual', original, replacement: repl });
      }
      slots[si] = next;
    });
  }

  // 3. Exclusiones con el presupuesto de carbohidratos de todo el día.
  const clean = slots.reduce((s, it) => s + carbsOf(it, ex), 0);
  let budgetLeft = CARB_LIMIT - clean;
  const planned: PlannedSlot[] = slots.map((items, si) => {
    const ownClean = carbsOf(items, ex);
    const res = applyExclusions(items.map((i) => ({ food: i.food, qty: i.qty })), ex, ownClean + budgetLeft);
    budgetLeft -= totals(res.items).carbs - ownClean;

    // Cada sustituto se muestra en el lugar del ingrediente que reemplaza.
    const pending = [...res.changes];
    const out: PlannedItem[] = items.flatMap((i): PlannedItem[] => {
      if (!isExcluded(i.food, ex)) return [i];
      const ch = pending.shift()!;
      changes.push({ ...ch, slotIndex: si, reason: 'exclusion' });
      return (ch.replacement ?? []).map((r) => ({ ...scaledItem(r), replaces: ch.original.food, changeReason: 'exclusion' as const }));
    });
    const slot = day.slots[si];
    return {
      label: slot.label,
      time: adjustSlotTime(week, slot.time, mealIds[si], ctx.sunriseTime),
      slotIndex: si,
      mealId: mealIds[si],
      mealName: meal(mealIds[si]).name,
      items: out,
      macros: totals(out),
    };
  });

  return {
    week,
    dayIndex,
    day: day.day,
    slots: planned,
    totals: totals(planned.flatMap((s) => s.items)),
    changes,
  };
}

/** Solo los ingredientes (alimento + cantidad) de cada comida del día. */
export function dayItems(planned: PlannedDay): MealItem[] {
  return planned.slots.flatMap((s) => s.items.map((i) => ({ food: i.food, qty: i.qty })));
}

export function getWeekPlan(profile: PlanProfile, week: number, ctx: Omit<PlanContext, 'week'> = {}): PlannedDay[] {
  return programWeek(week).days.map((d) => planDay(d, profile, { ...ctx, week }));
}

// ---------------------------------------------------------------- fechas

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Semana y día del programa para una fecha si se avanza una semana cada 7 días (sin repetir). */
export function programPositionForDate(startDate: string, date: string): { week: number; dayIndex: number } | null {
  const n = daysBetween(startDate, date);
  if (n < 0 || n >= 14 * 7) return null;
  return { week: Math.floor(n / 7) + 1, dayIndex: n % 7 };
}

/**
 * Plan de hoy. La semana la decide la persona (`progress.currentWeek`); el día sale de
 * los días transcurridos desde que empezó esa semana. Si pasan más de 7 días sin avanzar,
 * la semana se repite.
 */
export function getTodayPlan(
  profile: PlanProfile & Partial<Pick<Profile, 'sunriseTime'>>,
  progress: ProgressState,
  date: string,
  ctx: Omit<PlanContext, 'week'> = {},
): PlannedDay & { daysInWeek: number } {
  const week = programWeek(progress.currentWeek);
  const elapsed = Math.max(0, daysBetween(progress.weekStartedAt, date));
  const day = week.days[elapsed % 7];
  return {
    ...planDay(day, profile, { sunriseTime: profile.sunriseTime, ...ctx, week: week.week }),
    daysInWeek: elapsed + 1,
  };
}

// ---------------------------------------------------------------- ventana de comida

/** Una comida dura ~1 h: la ventana cierra una hora después de la última. */
const MEAL_MINUTES = 60;

export interface EatingWindow { opens: string; closes: string }

/** Ventana del día: de la primera comida real a una hora después de la última. null = día de ayuno. */
export function eatingWindow(day: PlannedDay): EatingWindow | null {
  const times = day.slots
    .filter((s) => !['CAF', 'AYU'].includes(mealCategory(s.mealId)))
    .map((s) => toMinutes(s.time))
    .filter((t): t is number => t !== null);
  if (!times.length) return null;
  return { opens: fromMinutes(Math.min(...times)), closes: fromMinutes(Math.max(...times) + MEAL_MINUTES) };
}

export type WindowStatus =
  | { state: 'antes'; minutes: number }     // abre en N minutos
  | { state: 'abierta'; minutes: number }   // cierra en N minutos
  | { state: 'cerrada' }
  | { state: 'ayuno' };

/** Estado de la ventana a la hora `now` ("HH:MM"). */
export function windowStatus(win: EatingWindow | null, now: string): WindowStatus {
  if (!win) return { state: 'ayuno' };
  const n = toMinutes(now)!;
  const o = toMinutes(win.opens)!;
  const c = toMinutes(win.closes)!;
  if (n < o) return { state: 'antes', minutes: o - n };
  if (n < c) return { state: 'abierta', minutes: c - n };
  return { state: 'cerrada' };
}

/** "2 h 05 min", "45 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/** Horas completas de ayuno desde `startedAt` (ISO) hasta `now` (ISO). */
export function fastingHours(startedAt: string, now: string): number {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(startedAt)) / 3_600_000));
}

// ---------------------------------------------------------------- cambiar una comida completa

export interface MealSwapOption {
  mealId: MealId;
  name: string;
  /** Macros de la comida ya escalada y con exclusiones. */
  macros: PlannedSlot['macros'];
  /** Carbohidratos del día con esta comida. */
  dayCarbs: number;
  exceeds: boolean;
  current: boolean;
  /** Ingredientes que se cambian solos por las exclusiones (el nombre de la comida no cambia). */
  replaced: FoodId[];
}

/** Comidas de la misma categoría para un horario del día, con el efecto en los carbohidratos del día. */
export function mealSwapOptions(day: DayPlan, slotIndex: number, profile: PlanProfile, ctx: PlanContext): MealSwapOption[] {
  const { week, mealSwaps = [] } = ctx;
  const base = mealSwaps.filter((m) => !(m.week === week && m.day === day.day && m.slotIndex === slotIndex));
  const current = mealSwaps.find((m) => m.week === week && m.day === day.day && m.slotIndex === slotIndex)?.meal
    ?? day.slots[slotIndex].meal;
  return mealsInCategory(mealCategory(day.slots[slotIndex].meal)).map((mealId) => {
    const planned = planDay(day, profile, { ...ctx, mealSwaps: [...base, { week, day: day.day, slotIndex, meal: mealId }] });
    return {
      mealId,
      name: meal(mealId).name,
      macros: planned.slots[slotIndex].macros,
      dayCarbs: planned.totals.carbs,
      exceeds: planned.totals.carbs > CARB_LIMIT,
      current: mealId === current,
      replaced: [...new Set(planned.slots[slotIndex].items.flatMap((i) => (i.changeReason === 'exclusion' && i.replaces ? [i.replaces] : [])))],
    };
  });
}

// ---------------------------------------------------------------- recorrer los días del programa

export interface ProgramDay { week: number; dayIndex: number }

/** Mueve `delta` días dentro del programa (semana 1 día 1 … semana 14 día 7). null si se sale. */
export function stepProgramDay(pos: ProgramDay, delta: number): ProgramDay | null {
  const n = (pos.week - 1) * 7 + pos.dayIndex + delta;
  if (n < 0 || n >= 14 * 7) return null;
  return { week: Math.floor(n / 7) + 1, dayIndex: n % 7 };
}

/**
 * Fecha de un día del programa: real para semanas ya empezadas (según el historial),
 * estimada para las siguientes (si se avanza una semana cada 7 días).
 */
export function programDayDate(progress: ProgressState, pos: ProgramDay): { date: string; estimated: boolean } {
  if (pos.week === progress.currentWeek) return { date: addDays(progress.weekStartedAt, pos.dayIndex), estimated: false };
  if (pos.week < progress.currentWeek) {
    const h = [...progress.history].reverse().find((x) => x.week === pos.week);
    if (h) return { date: addDays(h.startedAt, pos.dayIndex), estimated: false };
  }
  return { date: addDays(progress.weekStartedAt, (pos.week - progress.currentWeek) * 7 + pos.dayIndex), estimated: true };
}
