// Hoy en la fase 5 · Vivir: dos comidas base + carbohidratos de verdad dentro de tu nivel del día.
import { Button, Card, EstimatedNote, cx } from '../../components/ui';
import { eatingWindow, planDay } from '../../engine/plan';
import type { VivirState } from '../../engine/types';
import {
  VIVIR_RULES, checkinDue, inReset, portionsThatFit, resetSuggestion, todayCarbLimit, vivirDay,
} from '../../engine/vivir';
import { longDate, shortDate } from '../../lib/date';
import { planProfile, useApp } from '../../store/useApp';
import { DayTotals } from './DayTotals';
import { MealCard } from './MealCard';

export function VivirHoy({ today }: { today: string }) {
  const state = useApp();
  const { profile, progress, logs } = state;
  if (!profile || !progress?.vivir) return null;
  const v: VivirState = progress.vivir;
  const { dayNumber, template, week } = vivirDay(v, today);
  const plan = planDay(template, planProfile(state, today), { week, sunriseTime: profile.sunriseTime });
  const limit = todayCarbLimit(v, today);
  const reset = inReset(v, today);
  const remaining = Math.max(0, limit - plan.totals.carbs);
  const portions = portionsThatFit(remaining);
  const due = checkinDue(v, today);
  const suggestion = resetSuggestion(v, logs, today);
  const win = eatingWindow(plan);
  const log = logs.find((l) => l.date === today);

  return (
    <div className="space-y-4">
      <header className="rounded-3xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-4 text-white shadow-md">
        <p className="text-sm font-medium text-emerald-50 first-letter:uppercase">{longDate(today)}</p>
        <h1 className="mt-1 text-2xl font-bold">Fase 5 · Vivir · día {dayNumber}</h1>
        <p className="mt-1 text-sm text-emerald-50">Tu forma de comer para siempre, con tu propio punto de equilibrio.</p>
      </header>

      <Card className={cx(reset ? 'bg-amber-50 ring-amber-200' : 'bg-rose-50 ring-rose-200')}>
        <p className={cx('text-xs font-semibold uppercase tracking-wide', reset ? 'text-amber-800' : 'text-rose-800')}>
          {reset ? 'Reinicio de 7 días' : v.equilibrium !== undefined ? 'Tu punto de equilibrio' : 'Buscando tu equilibrio'}
        </p>
        <p className="text-2xl font-bold tabular-nums text-stone-900">{limit} g de carbohidratos al día</p>
        <p className="mt-1 text-sm text-stone-700">
          {reset
            ? `Vuelves a 20 g hasta el ${shortDate(v.resetUntil!)}. Después regresas a tus ${v.level} g.`
            : v.equilibrium !== undefined
              ? 'Ya encontraste cuánto tolera tu cuerpo. Quédate aquí y revisa una vez al mes.'
              : 'Cada semana subimos 10 g, mientras tu glucosa en ayunas y tu cintura no suban.'}
        </p>
      </Card>

      {due && (
        <Card className="space-y-3 bg-sky-50 ring-sky-200">
          <p className="font-semibold text-sky-950">Pregunta de la semana</p>
          <p className="text-sm text-sky-950">
            Con {v.level} g al día, ¿subieron tu glucosa en ayunas o tu cintura esta semana? Mira tus números en Registro antes de responder.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => state.vivirCheckin(today, false)}>No, siguen igual</Button>
            <Button variant="secondary" onClick={() => state.vivirCheckin(today, true)}>Sí, subieron</Button>
          </div>
        </Card>
      )}

      {suggestion && (
        <Card className="space-y-3 bg-amber-50 ring-amber-200">
          <p className="font-semibold text-amber-950">¿Un reinicio de 7 días?</p>
          <p className="text-sm text-amber-950">{suggestion} Una semana a 20 g suele devolverte a tu punto.</p>
          <Button onClick={() => state.startVivirReset(today)}>Empezar reinicio de 7 días</Button>
        </Card>
      )}

      <Card className="flex items-center justify-between gap-3 bg-amber-50 ring-amber-200">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">⏰ Ventana de comida</p>
          <p className="text-lg font-semibold tabular-nums text-stone-900">{win ? `${win.opens} – ${win.closes}` : '—'}</p>
        </div>
        <p className="text-right text-xs text-stone-600">De 8 a 10 horas<br />casi todos los días</p>
      </Card>

      {plan.slots.map((slot) => (
        <MealCard
          key={`vivir-${dayNumber}-${slot.slotIndex}`}
          slot={slot}
          eaten={!!log?.mealsEaten.includes(slot.mealId)}
          onToggleEaten={() => state.toggleMealEaten(today, slot.mealId)}
        />
      ))}

      {!reset && (
        <Card className="space-y-2">
          <h2 className="font-semibold text-stone-900">Carbohidratos de verdad para hoy</h2>
          <p className="text-sm text-stone-600">
            Tus comidas suman {String(Math.round(plan.totals.carbs * 10) / 10).replace('.', ',')} g. Puedes agregar hasta{' '}
            <span className="font-semibold text-rose-800">{Math.floor(remaining)} g</span> con una o más de estas opciones:
          </p>
          {portions.length === 0 ? (
            <p className="text-sm text-stone-500">Hoy no queda espacio para más carbohidratos.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {portions.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-stone-800">{p.label}</span>
                  <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-xs tabular-nums text-rose-800">C {p.carbs} g</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-stone-400">Valores aproximados.</p>
        </Card>
      )}

      <DayTotals totals={plan.totals} idealWeightKg={profile.idealWeightKg} week={14} carbLimit={limit} />

      <Card>
        <h2 className="font-semibold text-stone-900">Reglas de la fase Vivir</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
          {VIVIR_RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p className="mt-2 text-xs text-stone-500">Es una propuesta de estilo de vida, no un tratamiento. Revísala con tu médico.</p>
      </Card>
      <EstimatedNote />
    </div>
  );
}
