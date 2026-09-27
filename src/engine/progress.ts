// Ratio Dr. Boz y criterios para SUGERIR avanzar de semana. La app nunca avanza sola.
import { addDays } from './plan';
import type { DailyLog, DrBozZone, Profile, ProgressState } from './types';

export const MGDL_PER_MMOL = 18;

/** Glucosa (mg/dL) ÷ cetonas (mmol/L). Si la glucosa viene en mmol/L se multiplica por 18. */
export function drBozRatio(glucose: number, ketonesMmol: number, glucoseUnit: Profile['units']['glucose'] = 'mg/dL'): number | null {
  if (!(ketonesMmol > 0) || !(glucose > 0)) return null;
  const mgdl = glucoseUnit === 'mmol/L' ? glucose * MGDL_PER_MMOL : glucose;
  return mgdl / ketonesMmol;
}

/** < 20 terapéutico · < 40 autofagia · < 80 pérdida de peso · 80 o más: insulina alta. */
export function drBozZone(ratio: number): DrBozZone {
  if (ratio < 20) return 'terapeutico';
  if (ratio < 40) return 'autofagia';
  if (ratio < 80) return 'perdida-peso';
  return 'alta-insulina';
}

export const ZONE_LABELS: Record<DrBozZone, string> = {
  'alta-insulina': 'Insulina alta',
  'perdida-peso': 'Pérdida de peso',
  autofagia: 'Autofagia',
  terapeutico: 'Terapéutico',
};

// ---------------------------------------------------------------- criterios para avanzar

export interface AdvanceInput {
  progress: ProgressState;
  logs: DailyLog[];
  today: string;
  profile: Pick<Profile, 'onBpMeds' | 'onGlucoseMeds'>;
  /** S9→S10: la persona dice que 18:6 le resulta cómodo. */
  comfortableIn18_6?: boolean;
}

export interface AdvanceSuggestion {
  ready: boolean;
  /** Qué falta o por qué se sugiere avanzar, en español. */
  reason: string;
  /** Requiere que la persona confirme la advertencia médica antes de avanzar. */
  needsMedicalAck?: boolean;
  /** No hay criterio automático: la persona decide. */
  selfAssessed?: boolean;
}

function logsByDate(logs: DailyLog[]): Map<string, DailyLog> {
  return new Map(logs.map((l) => [l.date, l]));
}

/** Días seguidos, terminando hoy o ayer, que cumplen `ok`. */
export function streak(logs: DailyLog[], today: string, ok: (l: DailyLog) => boolean): number {
  const byDate = logsByDate(logs);
  let d = byDate.get(today) && ok(byDate.get(today)!) ? today : addDays(today, -1);
  let n = 0;
  for (let l = byDate.get(d); l && ok(l); l = byDate.get(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Comidas reales del día (el café y el ayuno no cuentan). */
export function realMeals(l: DailyLog): number {
  return l.mealsEaten.filter((m) => !m.startsWith('CAF') && !m.startsWith('AYU')).length;
}

export const under20 = (l: DailyLog): boolean => l.carbsUnder20 ?? l.mealsEaten.length > 0;

function lastDays(logs: DailyLog[], today: string, n: number): DailyLog[] {
  const byDate = logsByDate(logs);
  return Array.from({ length: n }, (_, i) => byDate.get(addDays(today, -i))).filter((l): l is DailyLog => !!l);
}

function logsSince(logs: DailyLog[], from: string): DailyLog[] {
  return logs.filter((l) => l.date >= from);
}

/** Glucosa en ayunas estable: al menos 3 lecturas en los últimos 7 días, con menos de 15 mg/dL de diferencia. */
export function fastingGlucoseStable(logs: DailyLog[], today: string): boolean {
  const readings = lastDays(logs, today, 7)
    .map((l) => l.bloodGlucose)
    .filter((g): g is number => typeof g === 'number');
  return readings.length >= 3 && Math.max(...readings) - Math.min(...readings) < 15;
}

export function suggestAdvance(input: AdvanceInput): AdvanceSuggestion {
  const { progress, logs, today, profile } = input;
  const week = progress.currentWeek;
  const thisWeek = logsSince(logs, progress.weekStartedAt);

  switch (week) {
    case 1: {
      const n = streak(logs, today, under20);
      return n >= 7
        ? { ready: true, reason: '7 días seguidos bajo 20 g de carbohidratos.' }
        : { ready: false, reason: `Llevas ${n} de 7 días seguidos bajo 20 g.` };
    }
    case 2: {
      const pink = lastDays(logs, today, 5).filter((l) => (l.urineKetone ?? 0) >= 1).length;
      return pink >= 3
        ? { ready: true, reason: `Tira rosa en ${pink} de los últimos 5 días.` }
        : { ready: false, reason: `Tira rosa en ${pink} de los últimos 5 días; buscamos 3.` };
    }
    case 4: {
      const missed = thisWeek.some((l) => l.missedMealByAccident);
      return missed
        ? { ready: true, reason: 'Te saltaste una comida sin querer: señal de adaptación.' }
        : { ready: false, reason: 'Aún no te has saltado una comida sin querer. Puedes repetir las semanas 3–4.' };
    }
    case 5: {
      const n = streak(logs, today, (l) => realMeals(l) === 2);
      return n >= 7
        ? { ready: true, reason: '7 días seguidos con 2 comidas.' }
        : { ready: false, reason: `Llevas ${n} de 7 días seguidos con 2 comidas.` };
    }
    case 7: {
      const n = streak(logs, today, (l) => !!l.followedWeekRule);
      return n >= 14
        ? { ready: true, reason: '14 días en 16:8.' }
        : { ready: false, reason: `Llevas ${n} de 14 días seguidos en 16:8.` };
    }
    case 9:
      return input.comfortableIn18_6
        ? { ready: true, reason: '18:6 te resulta cómodo.', selfAssessed: true }
        : { ready: false, reason: '¿18:6 te resulta cómodo? Si no, quédate aquí: no hay prisa.', selfAssessed: true };
    case 11: {
      const stable = fastingGlucoseStable(logs, today);
      const onMeds = profile.onBpMeds || profile.onGlucoseMeds;
      const acked = logs.some((l) => l.medicalWarningAcknowledged);
      if (!stable) return { ready: false, reason: 'Registra la glucosa en ayunas al menos 3 días; debe estar estable.' };
      if (onMeds && !acked) {
        return { ready: false, needsMedicalAck: true, reason: 'Tomas medicamentos: confirma que hablaste con tu médico antes del ayuno de 36 h.' };
      }
      return { ready: true, reason: 'Glucosa en ayunas estable.', needsMedicalAck: onMeds };
    }
    case 14:
      return { ready: false, reason: 'Terminaste las 14 semanas. El paso 12 (ayuno de 72 h) solo con aval médico.' };
    default: {
      // Sin criterio medible: sugerir tras completar los 7 días de la semana.
      const days = new Set(thisWeek.map((l) => l.date)).size;
      return days >= 7
        ? { ready: true, reason: 'Completaste los 7 días de la semana.', selfAssessed: true }
        : { ready: false, reason: `Llevas ${days} de 7 días registrados esta semana.`, selfAssessed: true };
    }
  }
}

/** Avanzar o repetir la semana. Lo decide siempre la persona. */
export function advanceWeek(progress: ProgressState, today: string): ProgressState {
  if (progress.currentWeek >= 14) return progress;
  const history = closeCurrent(progress, today);
  return { currentWeek: progress.currentWeek + 1, weekStartedAt: today, history: [...history, { week: progress.currentWeek + 1, startedAt: today, repeated: false }] };
}

export function repeatWeek(progress: ProgressState, today: string): ProgressState {
  const history = closeCurrent(progress, today);
  return { ...progress, weekStartedAt: today, history: [...history, { week: progress.currentWeek, startedAt: today, repeated: true }] };
}

function closeCurrent(progress: ProgressState, today: string): ProgressState['history'] {
  const h = [...progress.history];
  const last = h[h.length - 1];
  if (last && !last.endedAt) h[h.length - 1] = { ...last, endedAt: today };
  return h;
}

export function startProgress(startDate: string): ProgressState {
  return { currentWeek: 1, weekStartedAt: startDate, history: [{ week: 1, startedAt: startDate, repeated: false }] };
}

/** Días seguidos que cumplen la regla de la semana (pantalla Progreso). */
export function ruleStreak(logs: DailyLog[], today: string): number {
  return streak(logs, today, (l) => !!l.followedWeekRule);
}

// ---------------------------------------------------------------- series para las gráficas

export interface Point { date: string; value: number }

function series(logs: DailyLog[], pick: (l: DailyLog) => number | null | undefined): Point[] {
  return logs
    .map((l) => ({ date: l.date, value: pick(l) }))
    .filter((p): p is Point => typeof p.value === 'number' && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const weightSeries = (logs: DailyLog[]) => series(logs, (l) => l.weightKg);
/** Glucosa en ayunas, en mg/dL. */
export const glucoseSeries = (logs: DailyLog[]) => series(logs, (l) => l.bloodGlucose);
export const ratioSeries = (logs: DailyLog[]) =>
  series(logs, (l) => (l.bloodGlucose && l.bloodKetoneMmol ? drBozRatio(l.bloodGlucose, l.bloodKetoneMmol) : null));

/** Semana que estaba en curso en una fecha (según el historial), para ver días pasados. */
export function progressAt(progress: ProgressState, date: string): ProgressState {
  const entry = [...progress.history].reverse().find((h) => h.startedAt <= date);
  if (!entry || date >= progress.weekStartedAt) return progress;
  return { ...progress, currentWeek: entry.week, weekStartedAt: entry.startedAt };
}
