import { useId, useState } from 'react';
import { Button, Card, MacroChips, cx } from '../../components/ui';
import { mealCategory } from '../../engine/plan';
import type { PlannedItem, PlannedSlot } from '../../engine/types';
import { foodName } from '../../lib/labels';
import { mealTheme } from '../../lib/theme';

export function MealCard({ slot, eaten, onToggleEaten, onChangeItem, onSwapMeal, disabled }: {
  slot: PlannedSlot;
  eaten: boolean;
  onToggleEaten?: () => void;
  onChangeItem?: (item: PlannedItem) => void;
  onSwapMeal?: () => void;
  disabled?: boolean;
}) {
  const category = mealCategory(slot.mealId);
  const fasting = category === 'AYU';
  const theme = mealTheme(category);
  const hasFood = slot.items.length > 0;
  // Cerrada: solo el momento, la hora y la comida. Al tocarla se abren los ingredientes.
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  return (
    <Card className={cx('border-l-4', theme.bar, eaten && 'bg-emerald-50/60 ring-emerald-200')}>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => hasFood && setOpen(!open)}
          aria-expanded={hasFood ? open : undefined}
          aria-controls={hasFood ? detailsId : undefined}
          className={cx('-m-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left', hasFood && 'hover:bg-stone-50')}
        >
          <span aria-hidden className={cx('flex size-10 shrink-0 items-center justify-center rounded-full text-lg', theme.badge)}>
            {eaten ? '✓' : theme.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className={cx('block text-xs font-semibold uppercase tracking-wide', theme.label)}>
              {slot.label}
              {slot.time !== '—' && <span className="ml-2 font-normal normal-case tabular-nums">{slot.time}</span>}
              {eaten && <span className="ml-2 font-semibold normal-case text-emerald-800">✓ comido</span>}
            </span>
            <span className="mt-0.5 block font-semibold text-stone-900">{slot.mealName}</span>
          </span>
          {hasFood && (
            <span aria-hidden className={cx('shrink-0 text-lg text-stone-400 transition-transform', open && 'rotate-180')}>⌄</span>
          )}
        </button>
        {onSwapMeal && !fasting && (
          <button
            type="button"
            onClick={onSwapMeal}
            className="min-h-11 shrink-0 text-xs font-semibold text-emerald-800 hover:underline"
            aria-label={`Cambiar comida: ${slot.mealName}`}
          >
            Cambiar comida
          </button>
        )}
      </div>

      {hasFood && open && (
      <div id={detailsId}>
        <ul className="mt-3 space-y-2">
          {slot.items.map((it, i) => (
            <li key={`${it.food}-${i}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-stone-800">
                  {it.text}
                  {it.replaces && (
                    <span
                      className="ml-2 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800"
                      title={`Cambiado: en lugar de ${foodName(it.replaces)}`}
                    >
                      ↻ cambiado
                    </span>
                  )}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
                  {it.replaces && <span>en lugar de {foodName(it.replaces)}</span>}
                  {onChangeItem && (
                    <button
                      type="button"
                      onClick={() => onChangeItem(it)}
                      className="-my-2 min-h-11 font-semibold text-emerald-800 hover:underline"
                      aria-label={`Cambiar ${it.text}`}
                    >
                      Cambiar
                    </button>
                  )}
                </p>
              </div>
              <MacroChips m={it.macros} className="shrink-0 pt-0.5" />
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <MacroChips m={slot.macros} className="font-medium text-stone-700" />
          {onToggleEaten && !fasting && (
            <Button variant={eaten ? 'secondary' : 'primary'} onClick={onToggleEaten} disabled={disabled} aria-pressed={eaten}>
              {eaten ? '✓ Comido' : 'Comí esto'}
            </Button>
          )}
        </div>
      </div>
      )}
    </Card>
  );
}
