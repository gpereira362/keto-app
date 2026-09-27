// Catálogo de alimentos (macros por unidad y alérgenos) y de comidas (ya escaladas al peso ideal).
import { useMemo, useState } from 'react';
import { Button, Card, Chip, EstimatedNote, MacroChips, cx, inputClass } from '../../components/ui';
import { FOOD_LIST, MEAL_LIST } from '../../engine/data';
import { mealCategory, type MealCategory } from '../../engine/plan';
import { macrosOf, scaleMealItems, scaledItem, totals } from '../../engine/scaling';
import { AISLE_ORDER } from '../../engine/shopping';
import { activeExclusions, isExcluded } from '../../engine/substitutions';
import type { Aisle } from '../../engine/types';
import { localDate } from '../../lib/date';
import { ALLERGEN_LABELS, fold } from '../../lib/labels';
import { useApp } from '../../store/useApp';

const CATEGORY_LABELS: Record<MealCategory, string> = {
  CAF: 'Café', DES: 'Desayunos', ALM: 'Almuerzos', CEN: 'Cenas', P2: 'Primera de 2 comidas',
  OM: 'OMAD (una comida)', RUP: 'Romper el ayuno', AYU: 'Ayuno', DB: 'Doble bolo',
};

export function Alimentos({ onBack }: { onBack: () => void }) {
  const { profile, exclusions } = useApp();
  const [tab, setTab] = useState<'alimentos' | 'comidas'>('alimentos');
  const [query, setQuery] = useState('');
  const [aisle, setAisle] = useState<Aisle | null>(null);
  const active = activeExclusions(exclusions, localDate());
  const kg = profile?.idealWeightKg ?? 60;

  const foods = useMemo(() => {
    const q = fold(query.trim());
    return FOOD_LIST.filter((f) => (!aisle || f.category === aisle) && (!q || fold(f.purchase.shopName).includes(q) || fold(f.unit).includes(q)));
  }, [query, aisle]);

  const categories = [...new Set(MEAL_LIST.map((m) => mealCategory(m.id)))];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} aria-label="Volver">‹</Button>
        <h1 className="text-2xl font-bold text-stone-900">Alimentos</h1>
      </header>

      <div role="tablist" aria-label="Catálogo" className="grid grid-cols-2 rounded-xl bg-stone-200/70 p-1">
        {(['alimentos', 'comidas'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cx('min-h-10 rounded-lg text-sm font-semibold', tab === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600')}
          >
            {t === 'alimentos' ? 'Alimentos' : 'Comidas'}
          </button>
        ))}
      </div>

      {tab === 'alimentos' ? (
        <>
          <input
            className={inputClass}
            placeholder="Buscar alimento"
            aria-label="Buscar alimento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip selected={aisle === null} onClick={() => setAisle(null)} className="shrink-0">Todos</Chip>
            {AISLE_ORDER.map((a) => (
              <Chip key={a} selected={aisle === a} onClick={() => setAisle(aisle === a ? null : a)} className="shrink-0">{a}</Chip>
            ))}
          </div>
          <p className="text-xs text-stone-500">{foods.length} alimentos · macros por unidad (o por 100 g)</p>
          <Card flush>
            <ul className="divide-y divide-stone-100">
              {foods.map((f) => {
                const excluded = isExcluded(f.id, active);
                // Los alimentos por gramo se muestran por 100 g (por 1 g todo redondea a 0).
                const perGram = f.unit.startsWith('g ');
                const per = perGram ? 100 : 1;
                return (
                  <li key={f.id} className={cx('px-4 py-3', excluded && 'bg-stone-50')}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cx('text-sm font-medium', excluded ? 'text-stone-400' : 'text-stone-900')}>{f.purchase.shopName}</span>
                      <MacroChips m={macrosOf(f.id, per)} className="shrink-0" />
                    </div>
                    <p className="text-xs text-stone-500">
                      por {perGram ? `100 ${f.unit}` : f.unit}{!f.scalable && ' · no se escala'}
                    </p>
                    {(f.allergens.length > 0 || excluded) && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {f.allergens.map((a) => (
                          <span key={a} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">{ALLERGEN_LABELS[a]}</span>
                        ))}
                        {excluded && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-700">excluido</span>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-600">
            Cantidades para tu peso ideal ({String(kg).replace('.', ',')} kg), sin tus cambios. Para cambiar una comida del plan, toca "Cambiar comida" en Hoy.
          </p>
          {categories.map((c) => (
            <Card key={c} flush>
              <h2 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{CATEGORY_LABELS[c]}</h2>
              <ul className="divide-y divide-stone-100">
                {MEAL_LIST.filter((m) => mealCategory(m.id) === c).map((m) => {
                  const items = scaleMealItems(m.id, kg);
                  return (
                    <li key={m.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-stone-900">{m.name}</span>
                        {items.length > 0 && <MacroChips m={totals(items)} className="shrink-0" />}
                      </div>
                      {items.length > 0 && (
                        <p className="text-xs text-stone-500">{items.map((i) => scaledItem(i).text).join(' · ')}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </>
      )}
      <EstimatedNote />
    </div>
  );
}
