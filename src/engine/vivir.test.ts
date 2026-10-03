import { describe, expect, it } from 'vitest';
import { addDays, planDay } from './plan';
import { startProgress } from './progress';
import {
  applyCheckin, checkinDue, inReset, portionsThatFit, resetSuggestion, startReset, startVivir, todayCarbLimit, vivirDay,
  VIVIR_MAX_LEVEL, VIVIR_START_LEVEL,
} from './vivir';
import type { VivirState } from './types';

const start = '2027-01-04';
const base = (): VivirState => startVivir(startProgress('2026-09-27'), start).vivir!;

describe('fase Vivir', () => {
  it('empieza en 30 g y cierra la última semana del historial', () => {
    const p = startVivir({ ...startProgress('2026-09-27'), currentWeek: 14 }, start);
    expect(p.vivir).toEqual({ startedAt: start, level: VIVIR_START_LEVEL, checkins: [] });
    expect(p.history.at(-1)!.endedAt).toBe(start);
  });

  it('la pregunta semanal llega cada 7 días mientras se busca el equilibrio', () => {
    const v = base();
    expect(checkinDue(v, addDays(start, 6))).toBe(false);
    expect(checkinDue(v, addDays(start, 7))).toBe(true);
    const after = applyCheckin(v, addDays(start, 7), false);
    expect(checkinDue(after, addDays(start, 13))).toBe(false);
    expect(checkinDue(after, addDays(start, 14))).toBe(true);
  });

  it('sin subidas se suman 10 g por semana; con subida, el equilibrio es el nivel anterior', () => {
    let v = base();
    v = applyCheckin(v, addDays(start, 7), false);
    expect(v.level).toBe(40);
    v = applyCheckin(v, addDays(start, 14), false);
    expect(v.level).toBe(50);
    v = applyCheckin(v, addDays(start, 21), true);
    expect(v).toMatchObject({ level: 40, equilibrium: 40 });
    expect(checkinDue(v, addDays(start, 60))).toBe(false); // ya no pregunta
  });

  it('nunca baja de 20 g ni pasa del máximo', () => {
    expect(applyCheckin(base(), start, true).equilibrium).toBe(20);
    let v = base();
    for (let i = 1; i <= 10; i++) v = applyCheckin(v, addDays(start, 7 * i), false);
    expect(v).toMatchObject({ level: VIVIR_MAX_LEVEL, equilibrium: VIVIR_MAX_LEVEL });
  });

  it('reinicio de 7 días a 20 g', () => {
    const v = startReset({ ...base(), level: 50 }, addDays(start, 30));
    expect(inReset(v, addDays(start, 30))).toBe(true);
    expect(inReset(v, addDays(start, 36))).toBe(true);
    expect(inReset(v, addDays(start, 37))).toBe(false);
    expect(todayCarbLimit(v, addDays(start, 31))).toBe(20);
    expect(todayCarbLimit(v, addDays(start, 40))).toBe(50);
    expect(checkinDue(v, addDays(start, 31))).toBe(false);
  });

  it('sugiere reinicio si la cintura sube 2 cm o la glucosa promedia 100', () => {
    const v = base();
    const today = addDays(start, 20);
    expect(resetSuggestion(v, [
      { date: addDays(start, 2), mealsEaten: [], waistCm: 80 },
      { date: addDays(start, 19), mealsEaten: [], waistCm: 82.5 },
    ], today)).toMatch(/cintura subió 2,5 cm/);
    expect(resetSuggestion(v, [
      { date: addDays(today, -1), mealsEaten: [], bloodGlucose: 104 },
      { date: addDays(today, -2), mealsEaten: [], bloodGlucose: 99 },
      { date: addDays(today, -3), mealsEaten: [], bloodGlucose: 101 },
    ], today)).toMatch(/promedia 101/);
    expect(resetSuggestion(v, [{ date: addDays(today, -1), mealsEaten: [], bloodGlucose: 120 }], today)).toBeNull();
  });

  it('el día usa la plantilla de dos comidas, bajo 20 g, y deja lugar para carbohidratos de verdad', () => {
    const d = vivirDay(base(), addDays(start, 8));
    expect(d.dayNumber).toBe(9);
    const planned = planDay(d.template, { idealWeightKg: 60, exclusions: [] }, { week: d.week });
    expect(planned.totals.carbs).toBeLessThanOrEqual(20);
    const remaining = 40 - planned.totals.carbs;
    expect(portionsThatFit(remaining).every((p) => p.carbs <= remaining)).toBe(true);
    expect(portionsThatFit(5)).toEqual([]);
  });
});
