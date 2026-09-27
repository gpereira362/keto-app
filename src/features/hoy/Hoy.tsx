// Pantalla de inicio: qué comer hoy.
import { useCallback, useEffect, useState } from 'react';
import { Toast, type ToastData } from '../../components/Toast';
import { MealSwapSheet } from '../alimentos/MealSwapSheet';
import { ChangeSheet } from '../cambiar-ingrediente/ChangeSheet';
import { MedicalWarning } from '../../components/MedicalWarning';
import { Button, Card, EstimatedNote } from '../../components/ui';
import { programWeek } from '../../engine/data';
import {
  eatingWindow, formatDuration, getTodayPlan, isFastingWeek, mealCategory, mealsInCategory, planDay, programDayDate,
  stepProgramDay, windowStatus, type ProgramDay,
} from '../../engine/plan';
import type { DailyLog, PlannedItem } from '../../engine/types';
import { localDate, localTime, longDate } from '../../lib/date';
import { foodName } from '../../lib/labels';
import { planProfile, useApp } from '../../store/useApp';
import { AdvanceBanner } from './AdvanceBanner';
import { DayTotals } from './DayTotals';
import { FastingCard } from './FastingCard';
import { MealCard } from './MealCard';

/** Hora actual, actualizada cada 30 s para la cuenta regresiva. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Ayuno en curso: el último inicio de esta semana que aún no se rompió. */
function activeFast(logs: DailyLog[], weekStartedAt: string): string | undefined {
  const started = logs.filter((l) => l.date >= weekStartedAt && l.fastStartedAt).at(-1);
  if (!started) return undefined;
  const broken = logs.some((l) => l.date > started.date && l.mealsEaten.some((m) => mealCategory(m) === 'RUP'));
  return broken ? undefined : started.fastStartedAt;
}

export function Hoy() {
  const state = useApp();
  const { profile, progress, logs, overrides, mealSwaps } = state;
  const now = useNow();
  const [changing, setChanging] = useState<{ slotIndex: number; item: PlannedItem } | null>(null);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  /** Día del programa que se está mirando; null = hoy. */
  const [viewing, setViewing] = useState<ProgramDay | null>(null);
  if (!profile || !progress) return null;

  const today = localDate(now);
  const notStarted = today < profile.startDate;
  const date = notStarted ? profile.startDate : today;
  const profileForPlan = planProfile(state, today);
  const todayPlan = getTodayPlan(profileForPlan, progress, date, { overrides, mealSwaps });
  const todayPos: ProgramDay = { week: todayPlan.week, dayIndex: todayPlan.dayIndex };
  const pos = viewing ?? todayPos;
  const isToday = pos.week === todayPos.week && pos.dayIndex === todayPos.dayIndex;
  const plan = isToday
    ? todayPlan
    : planDay(programWeek(pos.week).days[pos.dayIndex], profileForPlan, {
      week: pos.week, overrides, mealSwaps, sunriseTime: profile.sunriseTime,
    });
  const shown = programDayDate(progress, pos);
  const prev = stepProgramDay(pos, -1);
  const next = stepProgramDay(pos, 1);
  const week = programWeek(plan.week);
  const log = logs.find((l) => l.date === today);
  const win = eatingWindow(plan);
  const status = windowStatus(win, localTime(now));
  const fasting = isFastingWeek(plan.week);
  const missing = plan.changes.filter((c) => c.replacement === null);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-medium text-emerald-800 first-letter:uppercase">
          {isToday ? longDate(today) : `${longDate(shown.date)}${shown.estimated ? ' (estimada)' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" aria-label="Día anterior" disabled={!prev} onClick={() => prev && setViewing(prev)}>‹</Button>
          <h1 className="flex-1 text-center text-2xl font-bold text-stone-900" aria-live="polite">
            Semana {plan.week} · día {plan.dayIndex + 1}
          </h1>
          <Button variant="secondary" aria-label="Día siguiente" disabled={!next} onClick={() => next && setViewing(next)}>›</Button>
        </div>
        <p className="text-sm text-stone-600">Paso {week.step} · {week.title}</p>
        <p className="text-xs text-stone-500">
          {notStarted ? 'Empiezas' : 'Empezaste'} el {longDate(profile.startDate)} · se cambia en Ajustes
        </p>
        {!isToday && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-stone-100 px-3 py-1 text-sm text-stone-700">
            <span>{(pos.week - todayPos.week) * 7 + pos.dayIndex - todayPos.dayIndex < 0 ? 'Día anterior' : 'Vista previa'}</span>
            <Button variant="ghost" onClick={() => setViewing(null)}>Volver a hoy</Button>
          </div>
        )}
      </header>

      {notStarted && (
        <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900 ring-1 ring-sky-200">
          <p>Empiezas el <span className="font-semibold">{longDate(profile.startDate)}</span>. Así se verá tu primer día.</p>
          <Button className="mt-3" onClick={() => { state.setStartDate(today); setViewing(null); }}>Empezar hoy</Button>
        </div>
      )}

      {!notStarted && isToday && (
        <AdvanceBanner
          progress={progress}
          logs={logs}
          today={today}
          profile={profile}
          daysInWeek={todayPlan.daysInWeek}
          onAdvance={() => state.advance(today)}
          onRepeat={() => state.repeat(today)}
          onAcknowledge={() => state.updateLog(today, { medicalWarningAcknowledged: true })}
        />
      )}

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Ventana de comida</p>
          <p className="text-lg font-semibold tabular-nums text-stone-900">{win ? `${win.opens} – ${win.closes}` : 'Día de ayuno'}</p>
        </div>
        {!notStarted && isToday && (
          <p className="text-right text-sm text-stone-600" aria-live="polite">
            {status.state === 'antes' && <>Abre en<br /><span className="font-semibold text-stone-900">{formatDuration(status.minutes)}</span></>}
            {status.state === 'abierta' && <>Cierra en<br /><span className="font-semibold text-emerald-800">{formatDuration(status.minutes)}</span></>}
            {status.state === 'cerrada' && 'Cerrada hasta mañana'}
            {status.state === 'ayuno' && 'Agua, sal, café negro o té'}
          </p>
        )}
      </Card>

      {/* Regla 6: en semanas de ayuno la advertencia se ve siempre; el ayuno solo se inicia desde el día de hoy. */}
      {fasting && !isToday && <MedicalWarning />}
      {fasting && isToday && (
        <FastingCard
          log={log}
          activeFastStart={activeFast(logs, progress.weekStartedAt)}
          nowIso={now.toISOString()}
          onStart={(ack) => state.startFast(today, new Date().toISOString(), ack)}
        />
      )}

      {missing.map((c, i) => (
        <div key={i} role="alert" className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-300">
          No hay un sustituto que quepa en 20 g para {foodName(c.original.food)}: elige otra comida.
        </div>
      ))}

      {plan.slots.map((slot) => (
        <MealCard
          key={`${plan.week}-${plan.dayIndex}-${slot.slotIndex}`}
          slot={slot}
          eaten={isToday && !!log?.mealsEaten.includes(slot.mealId)}
          disabled={notStarted}
          onToggleEaten={isToday ? () => state.toggleMealEaten(today, slot.mealId) : undefined}
          onChangeItem={(item) => setChanging({ slotIndex: slot.slotIndex, item })}
          onSwapMeal={mealsInCategory(mealCategory(slot.mealId)).length > 1 ? () => setSwapping(slot.slotIndex) : undefined}
        />
      ))}

      {/* En un día de ayuno no hay meta de proteína que cumplir. */}
      {win && <DayTotals totals={plan.totals} idealWeightKg={profile.idealWeightKg} week={plan.week} />}
      <EstimatedNote />

      {changing && (
        <ChangeSheet
          day={plan}
          slotIndex={changing.slotIndex}
          item={changing.item}
          today={today}
          onClose={() => setChanging(null)}
          onApplied={(prev, message) => {
            setChanging(null);
            setToast({ message, actionLabel: 'Deshacer', onAction: () => state.restoreChanges(prev) });
          }}
        />
      )}
      {swapping !== null && (
        <MealSwapSheet
          day={plan}
          slotIndex={swapping}
          today={today}
          onClose={() => setSwapping(null)}
          onApplied={(prev, message) => {
            setSwapping(null);
            setToast({ message, actionLabel: 'Deshacer', onAction: () => state.restoreMealSwaps(prev) });
          }}
        />
      )}
      {toast && <Toast toast={toast} onDone={closeToast} />}
    </div>
  );
}
