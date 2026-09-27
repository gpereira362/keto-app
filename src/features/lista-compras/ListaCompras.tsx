// Lista de supermercado: por pasillo, con casillas, despensa ("Ya lo tengo"), 2 compras y compartir.
import { useCallback, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Toast, type ToastData } from '../../components/Toast';
import { Button, Card, cx, inputClass } from '../../components/ui';
import { food } from '../../engine/data';
import { isFastingWeek } from '../../engine/plan';
import { AISLE_ORDER, lineParts, shoppingList, shoppingListText } from '../../engine/shopping';
import type { FoodId, ShoppingLine } from '../../engine/types';
import { localDate } from '../../lib/date';
import { planProfile, useApp } from '../../store/useApp';

const UNIT_LABEL = { g: 'g', ml: 'ml', unid: 'unidades' } as const;

export function ListaCompras({ initialWeek }: { initialWeek?: number }) {
  const state = useApp();
  const { progress, overrides, mealSwaps, pantry, shoppingChecks, settings } = state;
  const [week, setWeek] = useState(initialWeek ?? progress?.currentWeek ?? 1);
  const [editing, setEditing] = useState<string | null>(null); // "alimento-compra"
  const [shareText, setShareText] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  if (!progress) return null;

  const today = localDate();
  const weekPantry = pantry.filter((p) => p.week === week);
  const list = shoppingList(week, planProfile(state, today), {
    overrides, mealSwaps, pantry: weekPantry, packSizes: settings.packSizes, split: settings.shoppingSplit,
  });
  const isChecked = (key: string, trip?: 1 | 2) =>
    shoppingChecks.some((c) => c.week === week && c.food === key && c.trip === trip);
  const done = list.lines.filter((l) => isChecked(l.food, l.trip)).length;
  const trips = settings.shoppingSplit ? ([1, 2] as const) : ([undefined] as const);

  /** Total que pide el plan para un alimento (antes de restar la despensa). */
  const totalNeed = (fid: FoodId) =>
    list.lines.filter((l) => l.food === fid).reduce((s, l) => s + l.need, 0) + (weekPantry.find((p) => p.food === fid)?.amount ?? 0);

  async function share() {
    const text = shoppingListText(list, (l) => isChecked(l.food, l.trip));
    try {
      await navigator.clipboard.writeText(text);
      setToast({ message: 'Lista copiada. Pégala donde quieras.' });
    } catch {
      setShareText(text); // sin portapapeles: mostrar el texto para seleccionarlo
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Button variant="secondary" aria-label="Semana anterior" disabled={week <= 1} onClick={() => setWeek(week - 1)}>‹</Button>
        <div className="text-center">
          <p className="text-sm font-medium text-emerald-800">Semana {week}{week === progress.currentWeek && ' · actual'}</p>
          <h1 className="text-xl font-bold text-stone-900">Lista de compras</h1>
          <p className="text-xs text-stone-500">{done} de {list.lines.length} comprados</p>
        </div>
        <Button variant="secondary" aria-label="Semana siguiente" disabled={week >= 14} onClick={() => setWeek(week + 1)}>›</Button>
      </header>

      <div className="flex items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-3 text-sm text-stone-800">
          <input
            type="checkbox"
            className="size-5 accent-emerald-700"
            checked={settings.shoppingSplit}
            onChange={(e) => state.setSettings({ shoppingSplit: e.target.checked })}
          />
          Dividir en 2 compras
        </label>
        <Button variant="secondary" onClick={share}>Compartir</Button>
      </div>
      {settings.shoppingSplit && (
        <p className="-mt-2 text-xs text-stone-500">La carne y el pescado se compran en dos veces (días 1–3 y 4–7) para que no se echen a perder. Lo demás va completo en la primera compra.</p>
      )}
      {isFastingWeek(week) && (
        <p className="rounded-2xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-sky-200">Semana de ayuno: los días sin comida no suman nada a la lista.</p>
      )}

      {trips.map((trip) => (
        <div key={trip ?? 0} className="space-y-3">
          {trip && <h2 className="pt-2 text-lg font-bold text-stone-900">{trip === 1 ? 'Compra 1 · días 1–3' : 'Compra 2 · días 4–7 (carne y pescado)'}</h2>}
          {AISLE_ORDER.map((aisle) => {
            const lines = list.lines.filter((l) => l.trip === trip && l.category === aisle);
            if (!lines.length) return null;
            return (
              <Card key={aisle} flush>
                <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{aisle}</h3>
                <ul className="divide-y divide-stone-100">
                  {lines.map((l) => {
                    const key = `${l.food}-${l.trip ?? 0}`;
                    return (
                    <LineRow
                      key={key}
                      line={l}
                      checked={isChecked(l.food, l.trip)}
                      onToggle={() => state.toggleShoppingCheck(week, l.food, l.trip)}
                      editing={editing === key}
                      onEdit={() => setEditing(editing === key ? null : key)}
                      total={totalNeed(l.food)}
                      current={weekPantry.find((p) => p.food === l.food)?.amount ?? 0}
                      onSave={(amount) => { state.setPantry(week, l.food, amount); setEditing(null); }}
                    />
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      ))}

      {list.lines.length === 0 && (
        <Card><p className="text-sm text-stone-600">No hace falta comprar nada para esta semana.</p></Card>
      )}

      {weekPantry.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold text-stone-900">Ya en casa</h2>
          {weekPantry.map((p) => {
            const f = food(p.food);
            return (
              <div key={p.food} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-stone-800">
                  {f.purchase.shopName} <span className="text-stone-500">— {String(p.amount).replace('.', ',')} {UNIT_LABEL[f.purchase.packUnit]}</span>
                </span>
                <Button variant="ghost" onClick={() => state.setPantry(week, p.food, 0)}>Quitar</Button>
              </div>
            );
          })}
        </Card>
      )}

      <Card flush>
        <h2 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Básicos</h2>
        <ul className="divide-y divide-stone-100">
          {list.staples.map((s) => (
            <li key={s}>
              <label className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
                <input type="checkbox" className="size-5 shrink-0 accent-emerald-700" checked={isChecked(s)} onChange={() => state.toggleShoppingCheck(week, s)} />
                <span className={cx(isChecked(s) ? 'text-stone-400 line-through' : 'text-stone-800')}>{s}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
      <p className="px-1 text-center text-xs text-stone-400">Cantidades estimadas, ya con tus cambios y exclusiones.</p>

      {shareText && (
        <Sheet title="Copiar lista" onClose={() => setShareText(null)}>
          <p className="mb-2 text-sm text-stone-600">Mantén presionado el texto para copiarlo.</p>
          <textarea
            readOnly
            className={`${inputClass} h-80 font-mono text-xs`}
            value={shareText}
            onFocus={(e) => e.currentTarget.select()}
            autoFocus
          />
        </Sheet>
      )}
      {toast && <Toast toast={toast} onDone={closeToast} />}
    </div>
  );
}

function LineRow({ line, checked, onToggle, editing, onEdit, total, current, onSave }: {
  line: ShoppingLine;
  checked: boolean;
  onToggle: () => void;
  editing: boolean;
  onEdit: () => void;
  total: number;
  current: number;
  onSave: (amount: number) => void;
}) {
  const p = lineParts(line);
  const [value, setValue] = useState(String(current || ''));
  const amount = Number(value.replace(',', '.'));
  return (
    <li className="px-4 py-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={`chk-${line.food}-${line.trip ?? 0}`}
          className="mt-1 size-5 shrink-0 accent-emerald-700"
          checked={checked}
          onChange={onToggle}
        />
        <label htmlFor={`chk-${line.food}-${line.trip ?? 0}`} className="min-w-0 flex-1">
          <span className={cx('block text-sm font-medium', checked ? 'text-stone-400 line-through' : 'text-stone-900')}>{line.name}</span>
          <span className={cx('block text-sm tabular-nums', checked ? 'text-stone-400' : 'text-stone-700')}>
            {p.amount}{p.packs && <> → <span className="font-medium">{p.packs}</span></>}
          </span>
          {p.note && <span className="block text-xs text-stone-500">{p.note}</span>}
        </label>
        <button
          type="button"
          onClick={onEdit}
          aria-expanded={editing}
          aria-label={`Ya tengo ${line.name}`}
          className="min-h-11 shrink-0 px-1 text-xs font-semibold text-emerald-800 hover:underline"
        >
          Ya lo tengo
        </button>
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl bg-stone-50 p-3">
          <label className="flex-1">
            <span className="text-xs text-stone-600">¿Cuánto tienes en casa? ({UNIT_LABEL[line.unit]})</span>
            <input className={inputClass} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </label>
          <Button disabled={!(amount > 0)} onClick={() => onSave(amount)}>Guardar</Button>
          <Button variant="secondary" onClick={() => onSave(Math.ceil(total))}>Tengo todo</Button>
        </div>
      )}
    </li>
  );
}
