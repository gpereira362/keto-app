// Registro del día: tira de orina, glucosa y cetonas (índice glucosa-cetonas), peso, hambre y comidas cumplidas.
import { useEffect, useState } from 'react';
import { Button, Card, Chip, Field, cx, inputClass } from '../../components/ui';
import { addDays, getTodayPlan, mealCategory } from '../../engine/plan';
import { ZONE_LABELS, glucoseKetoneIndex, indexZone, progressAt } from '../../engine/progress';
import type { DailyLog } from '../../engine/types';
import { localDate, longDate } from '../../lib/date';
import {
  fmt, glucoseFromInput, glucoseToDisplay, parseNumber, weightFromInput, weightToDisplay,
} from '../../lib/units';
import { planProfile, useApp } from '../../store/useApp';

/** Tira de cetonas en orina: 5 colores, siempre con su nombre (nunca solo el color). */
export const URINE_LEVELS: { value: NonNullable<DailyLog['urineKetone']>; label: string; color: string }[] = [
  { value: 0, label: 'Negativo', color: '#efe3c4' },
  { value: 1, label: 'Trazas (rosa)', color: '#f2bfc8' },
  { value: 2, label: 'Poco', color: '#e28aa6' },
  { value: 3, label: 'Moderado', color: '#b24d7f' },
  { value: 4, label: 'Mucho (morado)', color: '#6d2459' },
];

const HUNGER = ['Nada', 'Poca', 'Normal', 'Bastante', 'Mucha'];

/** Campo numérico que guarda al salir (o con Enter). Vacío borra el valor. */
function NumberField({ label, hint, value, onCommit }: {
  label: string; hint?: string; value: number | undefined; onCommit: (n: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : fmt(value));
  useEffect(() => setText(value === undefined ? '' : fmt(value)), [value]);
  const commit = () => {
    const n = parseNumber(text);
    if (text.trim() && n === undefined) return; // inválido: no se guarda
    if (n !== value) onCommit(n);
  };
  return (
    <Field label={label} hint={hint}>
      <input
        className={inputClass}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </Field>
  );
}

export function Registro() {
  const state = useApp();
  const { profile, progress, logs, overrides, mealSwaps } = state;
  const today = localDate();
  const [date, setDate] = useState(today);
  if (!profile || !progress) return null;

  const units = profile.units;
  const log: DailyLog = logs.find((l) => l.date === date) ?? { date, mealsEaten: [] };
  const update = (patch: Partial<DailyLog>) => state.updateLog(date, patch);
  const ratio = log.bloodGlucose && log.bloodKetoneMmol ? glucoseKetoneIndex(log.bloodGlucose, log.bloodKetoneMmol) : null;
  const beforeStart = date < profile.startDate;
  const plan = beforeStart ? null : getTodayPlan(planProfile(state, date), progressAt(progress, date), date, { overrides, mealSwaps });
  const meals = plan?.slots.filter((s) => !['CAF', 'AYU'].includes(mealCategory(s.mealId))) ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Button variant="secondary" aria-label="Día anterior" onClick={() => setDate(addDays(date, -1))}>‹</Button>
        <div className="text-center">
          <p className="text-sm font-medium text-emerald-800">{date === today ? 'Hoy' : 'Registro'}</p>
          <h1 className="text-lg font-bold text-stone-900 first-letter:uppercase">{longDate(date)}</h1>
        </div>
        <Button variant="secondary" aria-label="Día siguiente" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>›</Button>
      </header>

      <Card className="space-y-3">
        <h2 className="font-semibold text-stone-900">Tira de cetonas en orina</h2>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Color de la tira">
          {URINE_LEVELS.map((u) => {
            const selected = log.urineKetone === u.value;
            return (
              <button
                key={u.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={u.label}
                onClick={() => update({ urineKetone: selected ? undefined : u.value })}
                className={cx('flex flex-col items-center gap-1 rounded-xl p-1.5 text-center', selected ? 'bg-emerald-50 ring-2 ring-emerald-700' : 'ring-1 ring-stone-200')}
              >
                <span className="block h-8 w-full rounded-lg ring-1 ring-black/10" style={{ background: u.color }} aria-hidden />
                <span className="text-[11px] leading-tight text-stone-700">{u.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-stone-900">Sangre (al despertar)</h2>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            key={`${date}-g`}
            label={`Glucosa (${units.glucose})`}
            value={log.bloodGlucose === undefined ? undefined : glucoseToDisplay(log.bloodGlucose, units.glucose)}
            onCommit={(n) => update({ bloodGlucose: n === undefined ? undefined : glucoseFromInput(n, units.glucose) })}
          />
          <NumberField
            key={`${date}-k`}
            label="Cetonas (mmol/L)"
            value={log.bloodKetoneMmol}
            onCommit={(n) => update({ bloodKetoneMmol: n })}
          />
        </div>
        <div className="rounded-xl bg-stone-50 p-3 text-sm" aria-live="polite">
          {ratio !== null ? (
            <p>
              Índice glucosa-cetonas: <span className="text-lg font-bold tabular-nums text-stone-900">{Math.round(ratio)}</span>{' '}
              <span className="font-medium text-stone-700">· {ZONE_LABELS[indexZone(ratio)]}</span>
            </p>
          ) : (
            <p className="text-stone-500">Anota glucosa y cetonas para ver tu índice glucosa-cetonas (glucosa ÷ cetonas).</p>
          )}
          <p className="mt-1 text-xs text-stone-500">Menos de 80: pérdida de peso · menos de 40: autofagia · menos de 20: terapéutico.</p>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            key={`${date}-w`}
            label={`Peso (${units.weight})`}
            value={log.weightKg === undefined ? undefined : weightToDisplay(log.weightKg, units.weight)}
            onCommit={(n) => update({ weightKg: n === undefined ? undefined : weightFromInput(n, units.weight) })}
          />
          <NumberField
            key={`${date}-c`}
            label="Cintura (cm)"
            hint="A la altura del ombligo"
            value={log.waistCm}
            onCommit={(n) => update({ waistCm: n })}
          />
        </div>
        <div>
          <span className="text-sm font-medium text-stone-700">Hambre</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {HUNGER.map((h, i) => {
              const v = (i + 1) as NonNullable<DailyLog['hunger']>;
              return (
                <Chip key={h} selected={log.hunger === v} onClick={() => update({ hunger: log.hunger === v ? undefined : v })}>
                  {v} · {h}
                </Chip>
              );
            })}
          </div>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold text-stone-900">Comidas cumplidas</h2>
        {beforeStart && <p className="text-sm text-stone-500">El plan aún no había empezado.</p>}
        {!beforeStart && meals.length === 0 && <p className="text-sm text-stone-500">Día de ayuno: sin comidas.</p>}
        {meals.map((s) => (
          <label key={s.slotIndex} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-emerald-700"
              checked={log.mealsEaten.includes(s.mealId)}
              onChange={() => state.toggleMealEaten(date, s.mealId)}
            />
            <span>
              <span className="text-stone-900">{s.mealName}</span>
              <span className="block text-xs text-stone-500">{s.label} · {s.time}</span>
            </span>
          </label>
        ))}
        <div className="border-t border-stone-100 pt-2">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-emerald-700" checked={log.carbsUnder20 ?? log.mealsEaten.length > 0}
              onChange={(e) => update({ carbsUnder20: e.target.checked })} />
            Me mantuve bajo 20 g de carbohidratos
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-emerald-700" checked={!!log.followedWeekRule}
              onChange={(e) => update({ followedWeekRule: e.target.checked })} />
            Cumplí la regla de la semana
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="size-5 accent-emerald-700" checked={!!log.missedMealByAccident}
              onChange={(e) => update({ missedMealByAccident: e.target.checked })} />
            Me salté una comida sin querer (no tenía hambre)
          </label>
        </div>
      </Card>

      <Card>
        <Field label="Notas">
          <textarea
            className={`${inputClass} min-h-20`}
            defaultValue={log.notes ?? ''}
            key={date}
            placeholder="Energía, sueño, cómo te sentiste…"
            onBlur={(e) => e.target.value !== (log.notes ?? '') && update({ notes: e.target.value || undefined })}
          />
        </Field>
      </Card>
    </div>
  );
}
