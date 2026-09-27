import { describe, expect, it } from 'vitest';
import tabla from '../../docs/tabla-60kg.json';
import { WEEKS, programWeek } from './data';
import {
  addDays, eatingWindow, eatingWindowClose, fastingHours, formatDuration, getTodayPlan, getWeekPlan, isFastingWeek, mealCategory, planDay, programPositionForDate,
  mealSwapOptions, programDayDate, stepProgramDay, swapMeal, windowStatus,
} from './plan';
import { CARB_LIMIT } from './scaling';
import { isExcluded } from './substitutions';
import type { Exclusion, PlanProfile } from './types';

const profile = (kg: number, exclusions: Exclusion[] = []): PlanProfile => ({ idealWeightKg: kg, exclusions });
const allergy = (id: string): Exclusion[] => [{ type: 'allergen', id: id as Exclusion['id'], reason: 'alergia' }];

describe('con 60 kg los totales diarios coinciden con docs/tabla-60kg.json (±1 g)', () => {
  const rows = (tabla as { days: { week: number; day: string; protein: number; fat: number; carbs: number }[] }).days;
  it('cubre las 14 semanas', () => expect(rows).toHaveLength(98));
  for (const row of rows) {
    it(`semana ${row.week} ${row.day}`, () => {
      const d = programWeek(row.week).days.find((x) => x.day === row.day)!;
      const t = planDay(d, profile(60), { week: row.week }).totals;
      expect(Math.abs(t.protein - row.protein)).toBeLessThanOrEqual(1);
      expect(Math.abs(t.fat - row.fat)).toBeLessThanOrEqual(1);
      expect(Math.abs(t.carbs - row.carbs)).toBeLessThanOrEqual(1);
    });
  }
});

describe('reglas 1 y 9: ningún día pasa de 20 g de carbohidratos', () => {
  const variants: [string, Exclusion[]][] = [
    ['sin exclusiones', []],
    ...['huevo', 'lacteos', 'pescado', 'cerdo', 'mariscos'].map((a): [string, Exclusion[]] => [`alergia a ${a}`, allergy(a)]),
  ];
  for (const [name, ex] of variants) {
    it(`${name}, pesos ideales de 40 a 150 kg`, () => {
      for (let kg = 40; kg <= 150; kg += 1) {
        for (const w of WEEKS) {
          for (const d of w.days) {
            const c = planDay(d, profile(kg, ex), { week: w.week }).totals.carbs;
            expect(c, `${kg} kg, semana ${w.week} ${d.day}`).toBeLessThanOrEqual(CARB_LIMIT + 1e-9);
          }
        }
      }
    });
  }
});

describe('regla 8: una alergia no aparece en el plan', () => {
  for (const a of ['huevo', 'lacteos', 'pescado', 'cerdo', 'mariscos', 'mostaza', 'coco']) {
    it(a, () => {
      const ex = allergy(a);
      for (const kg of [45, 60, 90, 150]) {
        for (const w of WEEKS) {
          for (const day of getWeekPlan(profile(kg, ex), w.week)) {
            for (const s of day.slots) for (const i of s.items) expect(isExcluded(i.food, ex), i.food).toBe(false);
          }
        }
      }
    });
  }

  it('marca los ingredientes cambiados', () => {
    const d = planDay(programWeek(1).days[0], profile(60, allergy('huevo')), { week: 1 });
    // DES1 empieza con huevos: el sustituto ocupa su lugar.
    expect(d.slots[1].items[0]).toMatchObject({ food: 'tocino', replaces: 'huevo', changeReason: 'exclusion' });
    expect(d.changes.some((c) => c.original.food === 'huevo')).toBe(true);
  });
});

describe('cambios puntuales y cambio de comida', () => {
  const lun = programWeek(1).days[0];

  it('"solo esta comida" reemplaza el ingrediente en esa comida', () => {
    const d = planDay(lun, profile(60), {
      week: 1,
      overrides: [{ scope: 'comida', week: 1, day: 'Lun', slotIndex: 1, food: 'huevo', replacement: [{ food: 'tocino', qty: 6 }] }],
    });
    expect(d.slots[1].items.find((i) => i.food === 'tocino')?.replaces).toBe('huevo');
    expect(d.slots[1].items.some((i) => i.food === 'huevo')).toBe(false);
  });

  it('"toda esta semana" ajusta la cantidad a cada comida', () => {
    // DES2 (martes) lleva 2 huevos; el cambio se guardó para 3 huevos → 6 lonjas.
    const mar = programWeek(1).days[1];
    const d = planDay(mar, profile(60), {
      week: 1,
      overrides: [{ scope: 'semana', week: 1, food: 'huevo', originalQty: 3, replacement: [{ food: 'molida', qty: 110 }] }],
    });
    const molida = d.slots[1].items.filter((i) => i.replaces === 'huevo');
    expect(molida).toHaveLength(1);
    expect(molida[0].qty).toBe(75); // 110 × 2/3 = 73.3 → 75
  });

  it('un cambio manual que pasaría de 20 g se rechaza con aviso', () => {
    const d = planDay(lun, profile(60), {
      week: 1,
      overrides: [{ scope: 'semana', week: 1, food: 'huevo', replacement: [{ food: 'chucrut', qty: 10 }] }],
    });
    expect(d.totals.carbs).toBeLessThanOrEqual(CARB_LIMIT);
    expect(d.changes.some((c) => c.warning)).toBe(true);
  });

  it('solo se cambia una comida por otra de la misma categoría', () => {
    expect(mealCategory('P2A')).toBe('P2');
    expect(mealCategory('RUPS')).toBe('RUP');
    const swaps = swapMeal([], { week: 1, day: 'Lun', slotIndex: 3, meal: 'CEN2' });
    expect(planDay(lun, profile(60), { week: 1, mealSwaps: swaps }).slots[3].mealId).toBe('CEN2');
    expect(() => swapMeal([], { week: 1, day: 'Lun', slotIndex: 3, meal: 'DES1' })).toThrow();
  });
});

describe('hoy y horario', () => {
  it('cualquier fecha entre el inicio y el día 98 cae en una semana y día del programa', () => {
    const start = '2026-10-05';
    for (let n = 0; n < 98; n++) {
      const date = addDays(start, n);
      const pos = programPositionForDate(start, date)!;
      expect(pos).toEqual({ week: Math.floor(n / 7) + 1, dayIndex: n % 7 });
      const weekStartedAt = addDays(start, (pos.week - 1) * 7);
      const today = getTodayPlan(profile(60), { currentWeek: pos.week, weekStartedAt, history: [] }, date);
      expect(today.week).toBe(pos.week);
      expect(today.day).toBe(programWeek(pos.week).days[pos.dayIndex].day);
    }
    expect(programPositionForDate(start, '2026-10-04')).toBeNull();
    expect(programPositionForDate(start, addDays(start, 98))).toBeNull();
  });

  it('si no avanza de semana, la semana se repite', () => {
    const t = getTodayPlan(profile(60), { currentWeek: 1, weekStartedAt: '2026-10-05', history: [] }, '2026-10-13');
    expect(t.week).toBe(1);
    expect(t.dayIndex).toBe(1);
    expect(t.daysInWeek).toBe(9);
  });

  it('desde la semana 11 la comida termina dentro de las 11 h después del amanecer', () => {
    expect(eatingWindowClose('06:00')).toBe('17:00');
    // Jueves de la semana 12: comida 2 a las 15:30; con amanecer a las 05:00 debe empezar a más tardar a las 15:00.
    const t = getTodayPlan(
      { ...profile(60), sunriseTime: '05:00' },
      { currentWeek: 12, weekStartedAt: '2026-10-05', history: [] },
      '2026-10-08',
    );
    expect(t.slots.at(-1)!.time).toBe('15:00');
    expect(t.slots[0].time).toBe('07:00'); // el café no se mueve
  });

  it('semanas de ayuno', () => {
    expect([11, 12, 13, 14].map(isFastingWeek)).toEqual([false, true, true, true]);
  });
});

describe('ventana de comida', () => {
  const plan = (week: number, dayIndex: number) => planDay(programWeek(week).days[dayIndex], profile(60), { week });

  it('de la primera comida a 1 h después de la última (el café no cuenta)', () => {
    expect(eatingWindow(plan(1, 0))).toEqual({ opens: '07:30', closes: '19:30' });
    expect(eatingWindow(plan(6, 0))).toEqual({ opens: '09:00', closes: '17:30' });
    expect(eatingWindow(plan(11, 0))).toEqual({ opens: '11:00', closes: '12:00' });
  });

  it('día de ayuno: sin ventana', () => {
    expect(eatingWindow(plan(12, 1))).toBeNull();
    expect(windowStatus(null, '10:00')).toEqual({ state: 'ayuno' });
  });

  it('cuenta regresiva', () => {
    const w = { opens: '09:00', closes: '17:00' };
    expect(windowStatus(w, '07:30')).toEqual({ state: 'antes', minutes: 90 });
    expect(windowStatus(w, '16:15')).toEqual({ state: 'abierta', minutes: 45 });
    expect(windowStatus(w, '17:00')).toEqual({ state: 'cerrada' });
    expect(formatDuration(125)).toBe('2 h 05 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('horas de ayuno', () => {
    expect(fastingHours('2026-10-05T17:00:00Z', '2026-10-07T05:30:00Z')).toBe(36);
  });
});

describe('cambiar una comida completa', () => {
  it('ofrece solo comidas de la misma categoría, marcando la actual', () => {
    const lun = programWeek(1).days[0];
    const opts = mealSwapOptions(lun, 3, profile(60), { week: 1 });
    expect(opts.every((o) => mealCategory(o.mealId) === 'CEN')).toBe(true);
    expect(opts.find((o) => o.current)?.mealId).toBe('CEN1');
    expect(opts.length).toBe(6);
  });

  it('indica qué ingredientes se cambian solos por las exclusiones', () => {
    const lun = programWeek(1).days[0];
    const opts = mealSwapOptions(lun, 3, profile(60, allergy('pescado')), { week: 1 });
    expect(opts.find((o) => o.mealId === 'CEN3')?.replaced).toEqual(['salmon']);
    expect(opts.find((o) => o.mealId === 'CEN2')?.replaced).toEqual([]);
  });

  it('cada opción trae los carbohidratos del día y marca si se pasa de 20 g', () => {
    for (const w of WEEKS) {
      for (const d of w.days) {
        d.slots.forEach((_, si) => {
          for (const o of mealSwapOptions(d, si, profile(120, allergy('huevo')), { week: w.week })) {
            expect(o.exceeds).toBe(o.dayCarbs > CARB_LIMIT);
          }
        });
      }
    }
  });
});

describe('recorrer los días del programa', () => {
  it('avanza y retrocede cruzando semanas, sin salirse de las 14', () => {
    expect(stepProgramDay({ week: 1, dayIndex: 0 }, 1)).toEqual({ week: 1, dayIndex: 1 });
    expect(stepProgramDay({ week: 1, dayIndex: 6 }, 1)).toEqual({ week: 2, dayIndex: 0 });
    expect(stepProgramDay({ week: 2, dayIndex: 0 }, -1)).toEqual({ week: 1, dayIndex: 6 });
    expect(stepProgramDay({ week: 1, dayIndex: 0 }, -1)).toBeNull();
    expect(stepProgramDay({ week: 14, dayIndex: 6 }, 1)).toBeNull();
  });

  it('fecha real en semanas empezadas y estimada en las siguientes', () => {
    const progress = {
      currentWeek: 2, weekStartedAt: '2026-10-12',
      history: [
        { week: 1, startedAt: '2026-10-05', endedAt: '2026-10-12', repeated: false },
        { week: 2, startedAt: '2026-10-12', repeated: false },
      ],
    };
    expect(programDayDate(progress, { week: 1, dayIndex: 2 })).toEqual({ date: '2026-10-07', estimated: false });
    expect(programDayDate(progress, { week: 2, dayIndex: 3 })).toEqual({ date: '2026-10-15', estimated: false });
    expect(programDayDate(progress, { week: 4, dayIndex: 0 })).toEqual({ date: '2026-10-26', estimated: true });
  });
});
