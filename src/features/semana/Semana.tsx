// Semana: 7 días × comidas con P/G/C, reglas, objetivo, qué medir y cuándo avanzar.
import { useState } from 'react';
import { MedicalWarning } from '../../components/MedicalWarning';
import { Button, Card, EstimatedNote, MacroChips, cx } from '../../components/ui';
import { proteinTargets } from '../../engine/body';
import { programWeek } from '../../engine/data';
import { addDays, daysBetween, getWeekPlan, isFastingWeek } from '../../engine/plan';
import { localDate, shortDate } from '../../lib/date';
import { planProfile, useApp } from '../../store/useApp';

export function Semana({ initialWeek, onShoppingList }: { initialWeek?: number; onShoppingList: (week: number) => void }) {
  const state = useApp();
  const { profile, progress, overrides, mealSwaps } = state;
  const [viewWeek, setViewWeek] = useState(initialWeek && initialWeek >= 1 && initialWeek <= 14 ? initialWeek : (progress?.currentWeek ?? 1));
  if (!profile || !progress) return null;

  const today = localDate();
  const w = programWeek(viewWeek);
  const days = getWeekPlan(planProfile(state, today), viewWeek, { overrides, mealSwaps, sunriseTime: profile.sunriseTime });
  const isCurrent = viewWeek === progress.currentWeek;
  const todayIndex = isCurrent && today >= profile.startDate ? Math.max(0, daysBetween(progress.weekStartedAt, today)) % 7 : -1;
  const p = proteinTargets(profile.idealWeightKg, viewWeek);
  // Fechas estimadas si se avanza una semana cada 7 días desde la semana actual.
  const weekStart = addDays(progress.weekStartedAt, (viewWeek - progress.currentWeek) * 7);
  const perKg = (n: number) => String(n).replace('.', ',');

  function advanceManually() {
    if (window.confirm(`¿Pasar a la semana ${progress!.currentWeek + 1}? Puedes volver a repetir una semana cuando quieras.`)) {
      state.advance(today);
      setViewWeek(progress!.currentWeek + 1);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Button variant="secondary" aria-label="Semana anterior" disabled={viewWeek <= 1} onClick={() => setViewWeek(viewWeek - 1)}>‹</Button>
        <div className="min-w-0 text-center">
          <p className="text-sm font-medium text-emerald-800">
            Semana {viewWeek} de 14{isCurrent && ' · actual'}
          </p>
          <h1 className="text-xl font-bold text-stone-900">{w.title}</h1>
          <p className="text-xs text-stone-500">Paso {w.step} · {w.phase}</p>
        </div>
        <Button variant="secondary" aria-label="Semana siguiente" disabled={viewWeek >= 14} onClick={() => setViewWeek(viewWeek + 1)}>›</Button>
      </header>

      {isFastingWeek(viewWeek) && <MedicalWarning />}

      <Button variant="secondary" className="w-full" onClick={() => onShoppingList(viewWeek)}>
        Lista de compras de la semana {viewWeek}
      </Button>

      <Card className="space-y-3 text-sm">
        <div>
          <h2 className="font-semibold text-stone-900">Objetivo</h2>
          <p className="text-stone-700">{w.goal}</p>
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">Horario</h2>
          <p className="text-stone-700">{w.schedule}</p>
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">Reglas</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-stone-700">
            {w.rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">Qué medir</h2>
          <p className="text-stone-700">{w.measure}</p>
        </div>
        <div>
          <h2 className="font-semibold text-stone-900">Cuándo avanzar</h2>
          <p className="text-stone-700">{w.advanceWhen}</p>
        </div>
        <p className="text-xs text-stone-500">
          Proteína: {Math.round(p.weekMin)}–{Math.round(p.weekMax)} g al día ({perKg(w.proteinGPerKg.min)}–{perKg(w.proteinGPerKg.max)} g/kg de peso ideal) · carbohidratos: máximo 20 g.
        </p>
      </Card>

      {days.map((d) => (
        <Card key={d.day} flush className={cx('pb-1', d.dayIndex === todayIndex && 'ring-2 ring-emerald-600')}>
          <div className="flex items-baseline justify-between px-4 pt-3">
            <h2 className="font-semibold text-stone-900">
              Día {d.dayIndex + 1}
              <span className="ml-2 text-sm font-normal text-stone-500">{shortDate(addDays(weekStart, d.dayIndex))}</span>
              {d.dayIndex === todayIndex && <span className="ml-2 text-xs font-medium text-emerald-800">hoy</span>}
            </h2>
            <MacroChips m={d.totals} className="font-medium text-stone-700" />
          </div>
          <table className="mt-2 w-full text-sm">
            <tbody className="divide-y divide-stone-100">
              {d.slots.map((s) => (
                <tr key={s.slotIndex} className="align-top">
                  <td className="w-16 py-2 pl-4 text-xs tabular-nums text-stone-500">{s.time}</td>
                  <td className="py-2 pr-2">
                    <span className="text-stone-800">{s.mealName}</span>
                    {s.items.some((i) => i.replaces) && <span className="ml-1 text-xs text-sky-700" title="Con ingredientes cambiados">↻</span>}
                    <span className="block text-xs text-stone-500">{s.label}</span>
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {s.items.length > 0 && <MacroChips m={s.macros} className="flex-col items-end gap-0 sm:flex-row sm:gap-2" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {isCurrent && progress.currentWeek < 14 && (
        <div className="text-center">
          <Button variant="ghost" onClick={advanceManually}>Pasar a la semana {progress.currentWeek + 1}</Button>
        </div>
      )}
      <EstimatedNote />
    </div>
  );
}
