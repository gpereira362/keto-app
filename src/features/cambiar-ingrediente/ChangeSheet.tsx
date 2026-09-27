// Hoja "Cambiar ingrediente": opciones equivalentes, diferencia de P/G/C, alcance y motivo.
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button, Chip, MacroChips, cx } from '../../components/ui';
import { SCOPE_LABELS, allergensOf, changeSheet, deltaText, type ChangeScope, type ChangeState } from '../../engine/changes';
import { endOfWeek, foodsWithAllergen } from '../../engine/substitutions';
import { macrosOf, portionText } from '../../engine/scaling';
import type { Allergen, PlannedDay, PlannedItem, SubFlag } from '../../engine/types';
import { shortDate } from '../../lib/date';
import { ALLERGEN_LABELS, foodName } from '../../lib/labels';
import { planProfile, useApp } from '../../store/useApp';

const FLAG_LABELS: Record<SubFlag, string> = {
  magro: 'magro',
  'grasa-añadida': '+ grasa añadida',
  'excede-carbohidratos': 'pasa de 20 g',
};

const SCOPES: ChangeScope[] = ['comida', 'semana', 'siempre', 'no-disponible', 'alergia'];

export function ChangeSheet({ day, slotIndex, item, today, onClose, onApplied }: {
  day: PlannedDay;
  slotIndex: number;
  item: PlannedItem;
  today: string;
  onClose: () => void;
  onApplied: (prev: ChangeState, message: string) => void;
}) {
  const state = useApp();
  const { exclusions } = planProfile(state, today);
  const sheet = changeSheet(day, slotIndex, item, exclusions);
  const [picked, setPicked] = useState(0);
  const [scope, setScope] = useState<ChangeScope>('comida');
  const groups = allergensOf(sheet.original.food);
  const [allergen, setAllergen] = useState<Allergen | undefined>(groups[0]);
  const [showAll, setShowAll] = useState(false);

  const usable = sheet.options.filter((o) => !o.flags.includes('excede-carbohidratos'));
  const option = sheet.options[picked];
  const canApply = !!option && !option.flags.includes('excede-carbohidratos');
  const visible = showAll ? sheet.options : sheet.options.slice(0, 6);
  const originalName = foodName(sheet.original.food);

  function apply() {
    if (!option) return;
    const prev = state.applyChange({
      scope,
      week: day.week,
      day: day.day,
      slotIndex,
      original: sheet.original,
      replacement: option.items,
      today,
      allergen: scope === 'alergia' ? allergen : undefined,
    });
    const what = `${originalName} → ${foodName(option.food)}`;
    const msg: Record<ChangeScope, string> = {
      comida: `Cambiado en esta comida: ${what}`,
      semana: `Cambiado toda la semana: ${what}`,
      siempre: `${originalName} ya no aparecerá en tu plan`,
      'no-disponible': `${originalName} fuera hasta el ${shortDate(endOfWeek(today))}`,
      alergia: `Alergia guardada: ${allergen ? ALLERGEN_LABELS[allergen] : originalName}`,
    };
    onApplied(prev, msg[scope]);
  }

  return (
    <Sheet
      title="Cambiar ingrediente"
      onClose={onClose}
      footer={
        <Button className="w-full" disabled={!canApply} onClick={apply}>
          {scope === 'alergia' ? 'Confirmar alergia y cambiar' : 'Cambiar'}
        </Button>
      }
    >
      {/* Encabezado: el original con su cantidad y P/G/C */}
      <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Original</p>
        <p className="font-semibold text-stone-900">{portionText(sheet.original.food, sheet.original.qty)}</p>
        <MacroChips m={macrosOf(sheet.original.food, sheet.original.qty)} />
        {item.replaces && (
          <p className="mt-1 text-xs text-sky-800">Ahora: {sheet.current.map((i) => i.text).join(' + ')}</p>
        )}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-stone-700">Opciones equivalentes</h3>
      {sheet.options.length === 0 && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          No hay sustitutos para este ingrediente. Elige otra comida.
        </p>
      )}
      {sheet.options.length > 0 && usable.length === 0 && (
        <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Ninguna opción cabe en los 20 g de carbohidratos de hoy: elige otra comida.
        </p>
      )}
      <ul className="mt-2 space-y-2" role="radiogroup" aria-label="Opciones equivalentes">
        {visible.map((o, i) => {
          const exceeds = o.flags.includes('excede-carbohidratos');
          const selected = i === picked;
          return (
            <li key={o.food}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${o.items.map((x) => portionText(x.food, x.qty)).join(' + ')}. ${deltaText(o.delta)}${o.flags.length ? `. ${o.flags.map((f) => FLAG_LABELS[f]).join(', ')}` : ''}`}
                disabled={exceeds}
                onClick={() => setPicked(i)}
                className={cx(
                  'w-full rounded-2xl p-3 text-left ring-1 transition',
                  selected ? 'bg-emerald-50 ring-2 ring-emerald-700' : 'bg-white ring-stone-200',
                  exceeds && 'cursor-not-allowed opacity-50',
                )}
              >
                <span className="block text-sm font-medium text-stone-900">
                  {o.items.map((x) => portionText(x.food, x.qty)).join(' + ')}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-stone-700">
                    {deltaText(o.delta)}
                  </span>
                  {o.flags.map((f) => (
                    <span
                      key={f}
                      className={cx(
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        f === 'excede-carbohidratos' ? 'bg-red-100 text-red-800' : f === 'magro' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-800',
                      )}
                    >
                      {FLAG_LABELS[f]}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!showAll && sheet.options.length > visible.length && (
        <Button variant="ghost" className="mt-1 w-full" onClick={() => setShowAll(true)}>
          Ver {sheet.options.length - visible.length} opciones más
        </Button>
      )}

      <h3 className="mt-4 text-sm font-semibold text-stone-700">¿Por qué y hasta cuándo?</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {SCOPES.map((s) => (
          <Chip key={s} selected={scope === s} onClick={() => setScope(s)}>{SCOPE_LABELS[s]}</Chip>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        {scope === 'comida' && 'Solo cambia esta comida de hoy.'}
        {scope === 'semana' && `Cambia ${originalName} en todas las comidas de la semana ${day.week}.`}
        {scope === 'siempre' && `${originalName} no volverá a aparecer. Esta semana se usa la opción elegida; las demás, la mejor equivalente.`}
        {scope === 'no-disponible' && `${originalName} queda fuera del plan y de la lista de compras hasta el ${shortDate(endOfWeek(today))}.`}
      </p>

      {scope === 'alergia' && (
        <div className="mt-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-300">
          {groups.length > 0 ? (
            <>
              <p className="font-semibold">Confirma el grupo</p>
              {groups.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <Chip key={g} selected={allergen === g} onClick={() => setAllergen(g)}>{ALLERGEN_LABELS[g]}</Chip>
                  ))}
                </div>
              )}
              {allergen && (
                <p className="mt-2">
                  Se quitará todo lo que lleva <span className="font-semibold">{ALLERGEN_LABELS[allergen].toLowerCase()}</span>:{' '}
                  {[...new Set(foodsWithAllergen(allergen).map(foodName))].join(', ')}. No aparecerá en el plan, las opciones ni la lista de compras.
                </p>
              )}
            </>
          ) : (
            <p>{originalName} no pertenece a un grupo de alérgenos. Se quitará solo este alimento, en todo el plan y la lista de compras.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
