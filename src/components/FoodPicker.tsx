// Buscador de alimentos (sin tildes). Los que comparten nombre se eligen juntos.
import { useMemo, useState } from 'react';
import { FOOD_LIST } from '../engine/data';
import type { FoodId } from '../engine/types';
import { fold, sameNameFoods } from '../lib/labels';
import { inputClass } from './ui';

export function FoodPicker({ hidden, onPick, placeholder = 'Buscar alimento (p. ej. hígado)', actionLabel = 'Agregar' }: {
  /** Alimentos que no se ofrecen (ya elegidos o con alergia). */
  hidden: (id: FoodId) => boolean;
  onPick: (ids: FoodId[]) => void;
  placeholder?: string;
  actionLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return FOOD_LIST.filter((f) => !hidden(f.id) && (fold(f.purchase.shopName).includes(q) || fold(f.unit).includes(q)))
      .filter((f, i, all) => all.findIndex((g) => g.purchase.shopName === f.purchase.shopName) === i)
      .slice(0, 8);
  }, [query, hidden]);

  return (
    <div className="space-y-2">
      <input className={inputClass} placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      {matches.length > 0 && (
        <ul className="divide-y divide-stone-100 rounded-xl bg-white ring-1 ring-stone-200">
          {matches.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50"
                onClick={() => { onPick(sameNameFoods(f.id)); setQuery(''); }}
              >
                <span>{f.purchase.shopName}</span>
                <span className="text-emerald-800">{actionLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && matches.length === 0 && <p className="text-sm text-stone-500">Sin resultados.</p>}
    </div>
  );
}
