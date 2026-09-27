import { Button, Card, MacroChips, cx } from '../../components/ui';
import { mealCategory } from '../../engine/plan';
import type { PlannedItem, PlannedSlot } from '../../engine/types';
import { foodName } from '../../lib/labels';

export function MealCard({ slot, eaten, onToggleEaten, onChangeItem, onSwapMeal, disabled }: {
  slot: PlannedSlot;
  eaten: boolean;
  onToggleEaten?: () => void;
  onChangeItem?: (item: PlannedItem) => void;
  onSwapMeal?: () => void;
  disabled?: boolean;
}) {
  const fasting = mealCategory(slot.mealId) === 'AYU';
  const hasFood = slot.items.length > 0;
  return (
    <Card className={cx(eaten && 'bg-emerald-50/60 ring-emerald-200')}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{slot.label}</p>
        <p className="text-sm tabular-nums text-stone-500">{slot.time}</p>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-stone-900">{slot.mealName}</h3>
        {onSwapMeal && !fasting && (
          <button
            type="button"
            onClick={onSwapMeal}
            className="-my-2 min-h-11 shrink-0 text-xs font-semibold text-emerald-800 hover:underline"
            aria-label={`Cambiar comida: ${slot.mealName}`}
          >
            Cambiar comida
          </button>
        )}
      </div>

      {hasFood && (
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
      )}

      {hasFood && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
          <MacroChips m={slot.macros} className="font-medium text-stone-700" />
          {onToggleEaten && !fasting && (
            <Button variant={eaten ? 'secondary' : 'primary'} onClick={onToggleEaten} disabled={disabled} aria-pressed={eaten}>
              {eaten ? '✓ Comido' : 'Comí esto'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
