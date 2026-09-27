// Cambiar una comida completa por otra de la misma categoría (sin pasar de 20 g en el día).
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button, MacroChips, cx, grams } from '../../components/ui';
import { programWeek } from '../../engine/data';
import { mealSwapOptions } from '../../engine/plan';
import type { MealSwap, PlannedDay } from '../../engine/types';
import { foodName } from '../../lib/labels';
import { planProfile, useApp } from '../../store/useApp';

export function MealSwapSheet({ day, slotIndex, today, onClose, onApplied }: {
  day: PlannedDay;
  slotIndex: number;
  today: string;
  onClose: () => void;
  onApplied: (prev: MealSwap[], message: string) => void;
}) {
  const state = useApp();
  const template = programWeek(day.week).days[day.dayIndex];
  const options = mealSwapOptions(template, slotIndex, planProfile(state, today), {
    week: day.week, overrides: state.overrides, mealSwaps: state.mealSwaps,
  });
  const [picked, setPicked] = useState(options.find((o) => o.current)?.mealId);
  const choice = options.find((o) => o.mealId === picked);

  function apply() {
    if (!choice || choice.current) return onClose();
    const prev = state.swapMeal({ week: day.week, day: day.day, slotIndex, meal: choice.mealId });
    onApplied(prev, `Comida cambiada: ${choice.name}`);
  }

  return (
    <Sheet
      title="Cambiar comida"
      onClose={onClose}
      footer={<Button className="w-full" disabled={!choice || choice.exceeds} onClick={apply}>Cambiar</Button>}
    >
      <p className="text-sm text-stone-600">
        {day.slots[slotIndex].label}: elige otra comida del mismo tipo. Las cantidades ya están ajustadas a tu peso ideal y tus exclusiones.
      </p>
      <ul className="mt-3 space-y-2" role="radiogroup" aria-label="Comidas">
        {options.map((o) => (
          <li key={o.mealId}>
            <button
              type="button"
              role="radio"
              aria-checked={picked === o.mealId}
              aria-label={`${o.name}${o.current ? ' (actual)' : ''}${o.exceeds ? ', pasa de 20 g de carbohidratos en el día' : ''}`}
              disabled={o.exceeds}
              onClick={() => setPicked(o.mealId)}
              className={cx(
                'w-full rounded-2xl p-3 text-left ring-1',
                picked === o.mealId ? 'bg-emerald-50 ring-2 ring-emerald-700' : 'bg-white ring-stone-200',
                o.exceeds && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-stone-900">{o.name}</span>
                {o.current && <span className="text-xs text-emerald-800">actual</span>}
              </span>
              <MacroChips m={o.macros} />
              {o.replaced.length > 0 && (
                <span className="block text-xs text-sky-800">
                  Sin {o.replaced.map((f) => foodName(f).toLowerCase()).join(', ')}: cambiado por tus exclusiones
                </span>
              )}
              <span className={cx('block text-xs', o.exceeds ? 'text-red-800' : 'text-stone-500')}>
                Día: {grams(o.dayCarbs, 1)} de carbohidratos{o.exceeds && ' — pasa de 20 g'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
