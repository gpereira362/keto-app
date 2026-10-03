import { describe, expect, it } from 'vitest';
import { addDays } from './plan';
import {
  advanceWeek, progressAt, glucoseKetoneIndex, glucoseSeries, ratioSeries, weightSeries, indexZone, repeatWeek, startProgress, streak, suggestAdvance, type AdvanceInput,
} from './progress';
import type { DailyLog } from './types';

describe('índice glucosa-cetonas', () => {
  it('glucosa (mg/dL) ÷ cetonas (mmol/L)', () => {
    expect(glucoseKetoneIndex(90, 1.5)).toBe(60);
    expect(glucoseKetoneIndex(80, 0.5)).toBe(160);
  });

  it('glucosa en mmol/L se multiplica por 18', () => {
    expect(glucoseKetoneIndex(5, 1.5, 'mmol/L')).toBeCloseTo(60);
  });

  it('sin cetonas no hay ratio', () => {
    expect(glucoseKetoneIndex(90, 0)).toBeNull();
    expect(glucoseKetoneIndex(0, 1)).toBeNull();
  });

  it('zonas: > 80 insulina alta · < 80 pérdida de peso · < 40 autofagia · < 20 terapéutico', () => {
    expect(indexZone(120)).toBe('alta-insulina');
    expect(indexZone(80)).toBe('alta-insulina');
    expect(indexZone(79.9)).toBe('perdida-peso');
    expect(indexZone(40)).toBe('perdida-peso');
    expect(indexZone(39.9)).toBe('autofagia');
    expect(indexZone(20)).toBe('autofagia');
    expect(indexZone(19.9)).toBe('terapeutico');
  });
});

const today = '2026-10-20';
const log = (daysAgo: number, extra: Partial<DailyLog> = {}): DailyLog => ({
  date: addDays(today, -daysAgo),
  mealsEaten: ['CAF1', 'DES1', 'ALM1', 'CEN1'],
  ...extra,
});
const input = (week: number, logs: DailyLog[], extra: Partial<AdvanceInput> = {}): AdvanceInput => ({
  progress: { currentWeek: week, weekStartedAt: addDays(today, -13), history: [] },
  logs,
  today,
  profile: { onBpMeds: false, onGlucoseMeds: false },
  ...extra,
});
const days = (n: number, extra: Partial<DailyLog> = {}) => Array.from({ length: n }, (_, i) => log(i, extra));

describe('criterios para sugerir avanzar', () => {
  it('rachas: cuenta días seguidos y se corta con un hueco', () => {
    expect(streak(days(5), today, () => true)).toBe(5);
    expect(streak([log(0), log(1), log(3)], today, () => true)).toBe(2);
    expect(streak([log(1), log(2)], today, () => true)).toBe(2); // hoy aún sin registro
  });

  it('S1→S2: 7 días seguidos bajo 20 g', () => {
    expect(suggestAdvance(input(1, days(7))).ready).toBe(true);
    expect(suggestAdvance(input(1, days(6))).ready).toBe(false);
    const broken = days(7).map((l, i) => (i === 3 ? { ...l, carbsUnder20: false } : l));
    expect(suggestAdvance(input(1, broken)).ready).toBe(false);
  });

  it('S2→S3: tira rosa (≥ 1) en 3 de los últimos 5 días', () => {
    const pink = [log(0, { urineKetone: 1 }), log(1, { urineKetone: 0 }), log(2, { urineKetone: 2 }), log(4, { urineKetone: 1 })];
    expect(suggestAdvance(input(2, pink)).ready).toBe(true);
    expect(suggestAdvance(input(2, pink.slice(0, 3))).ready).toBe(false);
  });

  it('S4→S5: al menos una comida saltada sin querer', () => {
    expect(suggestAdvance(input(4, [log(2, { missedMealByAccident: true })])).ready).toBe(true);
    expect(suggestAdvance(input(4, days(7))).ready).toBe(false);
  });

  it('S5→S6: 7 días seguidos con 2 comidas (el café no cuenta)', () => {
    expect(suggestAdvance(input(5, days(7, { mealsEaten: ['CAF1', 'P2A', 'CEN2'] }))).ready).toBe(true);
    expect(suggestAdvance(input(5, days(7))).ready).toBe(false);
  });

  it('S7→S8: 14 días en 16:8', () => {
    expect(suggestAdvance(input(7, days(14, { followedWeekRule: true }))).ready).toBe(true);
    expect(suggestAdvance(input(7, days(13, { followedWeekRule: true }))).ready).toBe(false);
  });

  it('S9→S10: autoevaluación de 18:6', () => {
    expect(suggestAdvance(input(9, [], { comfortableIn18_6: true })).ready).toBe(true);
    expect(suggestAdvance(input(9, [])).ready).toBe(false);
  });

  it('S11→S12: glucosa estable y advertencia médica si toma medicamentos', () => {
    const stable = [log(0, { bloodGlucose: 92 }), log(1, { bloodGlucose: 88 }), log(2, { bloodGlucose: 95 })];
    expect(suggestAdvance(input(11, stable)).ready).toBe(true);
    expect(suggestAdvance(input(11, [...stable.slice(0, 2), log(2, { bloodGlucose: 120 })])).ready).toBe(false);

    const meds = { onBpMeds: true, onGlucoseMeds: false };
    const noAck = suggestAdvance(input(11, stable, { profile: meds }));
    expect(noAck.ready).toBe(false);
    expect(noAck.needsMedicalAck).toBe(true);
    const acked = suggestAdvance(input(11, [...stable, log(3, { medicalWarningAcknowledged: true })], { profile: meds }));
    expect(acked.ready).toBe(true);
  });

  it('series para las gráficas: ordenadas y sin huecos', () => {
    const logs = [
      log(0, { weightKg: 70, bloodGlucose: 90, bloodKetoneMmol: 1.5 }),
      log(2, { weightKg: 71 }),
      log(1, { bloodGlucose: 95 }),
    ];
    expect(weightSeries(logs)).toEqual([{ date: addDays(today, -2), value: 71 }, { date: today, value: 70 }]);
    expect(glucoseSeries(logs).map((p) => p.value)).toEqual([95, 90]);
    expect(ratioSeries(logs)).toEqual([{ date: today, value: 60 }]);
  });
});

describe('la app nunca avanza sola', () => {
  it('suggestAdvance no cambia el progreso', () => {
    const i = input(1, days(7));
    const before = JSON.stringify(i.progress);
    suggestAdvance(i);
    expect(JSON.stringify(i.progress)).toBe(before);
  });

  it('avanzar y repetir los decide la persona', () => {
    const p = startProgress('2026-10-01');
    const p2 = advanceWeek(p, '2026-10-08');
    expect(p2.currentWeek).toBe(2);
    expect(p2.history[0].endedAt).toBe('2026-10-08');
    const p3 = repeatWeek(p2, '2026-10-15');
    expect(p3.currentWeek).toBe(2);
    expect(p3.weekStartedAt).toBe('2026-10-15');
    expect(p3.history.at(-1)).toEqual({ week: 2, startedAt: '2026-10-15', repeated: true });
    expect(advanceWeek({ ...p3, currentWeek: 14 }, '2026-12-01').currentWeek).toBe(14);
  });
});

describe('semana en una fecha pasada', () => {
  it('usa el historial', () => {
    let p = startProgress('2026-10-01');
    p = advanceWeek(p, '2026-10-08');
    p = repeatWeek(p, '2026-10-15');
    expect(progressAt(p, '2026-10-03')).toMatchObject({ currentWeek: 1, weekStartedAt: '2026-10-01' });
    expect(progressAt(p, '2026-10-10')).toMatchObject({ currentWeek: 2, weekStartedAt: '2026-10-08' });
    expect(progressAt(p, '2026-10-16')).toMatchObject({ currentWeek: 2, weekStartedAt: '2026-10-15' });
  });
});
