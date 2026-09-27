// Mis exclusiones: alergias (por grupo), "no me gusta", "no lo encuentro" (con vencimiento) y cambios guardados.
import { useCallback, useState } from 'react';
import { FoodPicker } from '../../components/FoodPicker';
import { Toast, type ToastData } from '../../components/Toast';
import { Button, Card, Chip, inputClass } from '../../components/ui';
import { ALLERGENS, activeExclusions, endOfWeek, foodsWithAllergen, isExcluded } from '../../engine/substitutions';
import type { Allergen, Exclusion, ExclusionReason, FoodId, Override } from '../../engine/types';
import { localDate, shortDate } from '../../lib/date';
import { ALLERGEN_LABELS, foodName } from '../../lib/labels';
import { useApp } from '../../store/useApp';

/** Un renglón por nombre visible (los alimentos que comparten nombre se muestran una vez). */
function uniqueByName(list: Exclusion[]): Exclusion[] {
  return list.filter((e, i) => list.findIndex((x) => foodName(x.id) === foodName(e.id)) === i);
}

function overrideText(o: Override): string {
  const repl = o.replacement.map((r) => foodName(r.food)).join(' + ');
  const where = o.scope === 'semana' ? `Semana ${o.week}, toda la semana` : `Semana ${o.week}, ${o.day}, comida ${(o.slotIndex ?? 0) + 1}`;
  return `${where}: ${foodName(o.food)} → ${repl}`;
}

export function Exclusiones({ onBack }: { onBack: () => void }) {
  const { exclusions, overrides, setExclusions, removeOverride, restoreChanges } = useApp();
  const today = localDate();
  const [toast, setToast] = useState<ToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const active = activeExclusions(exclusions, today);
  const allergenIds = active.filter((e) => e.type === 'allergen').map((e) => e.id as Allergen);
  const foodExclusions = (reason: ExclusionReason) => active.filter((e) => e.type === 'food' && e.reason === reason);
  const allergyFoods = foodExclusions('alergia');
  const dislikes = foodExclusions('no-me-gusta');
  const unavailable = foodExclusions('no-disponible');
  const allergyOnly = active.filter((e) => e.reason === 'alergia');

  /** Guarda y ofrece deshacer. Además limpia las exclusiones vencidas. */
  function save(next: Exclusion[], message: string) {
    const prev = { overrides, exclusions };
    setExclusions(activeExclusions(next, today));
    setToast({ message, onAction: () => restoreChanges(prev) });
  }

  function toggleAllergen(a: Allergen) {
    if (allergenIds.includes(a)) {
      if (!window.confirm(`¿Quitar la alergia a ${ALLERGEN_LABELS[a].toLowerCase()}? Esos alimentos volverán a aparecer.`)) return;
      save(exclusions.filter((e) => !(e.type === 'allergen' && e.id === a)), `Alergia quitada: ${ALLERGEN_LABELS[a]}`);
    } else {
      save([...exclusions, { type: 'allergen', id: a, reason: 'alergia' }], `Alergia guardada: ${ALLERGEN_LABELS[a]}`);
    }
  }

  function removeFood(e: Exclusion) {
    const name = foodName(e.id);
    save(
      exclusions.filter((x) => !(x.type === 'food' && x.reason === e.reason && foodName(x.id) === name)),
      `${name} vuelve al plan`,
    );
  }

  function addFoods(ids: FoodId[], reason: ExclusionReason) {
    const until = reason === 'no-disponible' ? endOfWeek(today) : undefined;
    const others = exclusions.filter((x) => !(x.type === 'food' && ids.includes(x.id)));
    save(
      [...others, ...ids.map((id): Exclusion => ({ type: 'food', id, reason, ...(until ? { until } : {}) }))],
      `${foodName(ids[0])}: ${reason === 'no-disponible' ? `fuera hasta el ${shortDate(until!)}` : 'no aparecerá en el plan'}`,
    );
  }

  function setUntil(e: Exclusion, until: string) {
    if (!until) return;
    const name = foodName(e.id);
    setExclusions(exclusions.map((x) => (x.type === 'food' && x.reason === 'no-disponible' && foodName(x.id) === name ? { ...x, until } : x)));
  }

  // Un alimento con exclusión (de cualquier tipo) no se vuelve a ofrecer en los buscadores.
  const hidden = (id: FoodId) => isExcluded(id, active);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} aria-label="Volver">‹</Button>
        <h1 className="text-2xl font-bold text-stone-900">Mis exclusiones</h1>
      </header>

      <Card className="space-y-3">
        <h2 className="font-semibold text-stone-900">Alergias</h2>
        <p className="text-sm text-stone-600">No aparecen en ningún lugar: plan, opciones de cambio ni lista de compras.</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <Chip key={a} selected={allergenIds.includes(a)} onClick={() => toggleAllergen(a)}>{ALLERGEN_LABELS[a]}</Chip>
          ))}
        </div>
        {allergenIds.map((a) => (
          <p key={a} className="text-xs text-stone-500">
            <span className="font-medium text-stone-700">{ALLERGEN_LABELS[a]}:</span>{' '}
            {[...new Set(foodsWithAllergen(a).map(foodName))].join(', ')}
          </p>
        ))}
        {uniqueByName(allergyFoods).map((e) => (
          <ExclusionRow key={e.id} name={foodName(e.id)} detail="alergia a este alimento" onRemove={() => removeFood(e)} />
        ))}
        {allergyOnly.length === 0 && <p className="text-sm text-stone-500">Sin alergias registradas.</p>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-stone-900">No me gusta</h2>
        <p className="text-sm text-stone-600">Se cambian solos por la mejor opción equivalente.</p>
        {uniqueByName(dislikes).map((e) => (
          <ExclusionRow key={e.id} name={foodName(e.id)} onRemove={() => removeFood(e)} />
        ))}
        <FoodPicker hidden={hidden} onPick={(ids) => addFoods(ids, 'no-me-gusta')} />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-stone-900">No lo encuentro</h2>
        <p className="text-sm text-stone-600">Vuelve solo al plan en la fecha indicada (por defecto, el domingo).</p>
        {uniqueByName(unavailable).map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2">
            <span className="text-sm text-stone-800">{foodName(e.id)}</span>
            <div className="flex items-center gap-1">
              <label className="sr-only" htmlFor={`until-${e.id}`}>Hasta</label>
              <input
                id={`until-${e.id}`}
                type="date"
                min={today}
                className={`${inputClass} w-40 text-sm`}
                value={e.until ?? ''}
                onChange={(ev) => setUntil(e, ev.target.value)}
              />
              <Button variant="ghost" onClick={() => removeFood(e)} aria-label={`Quitar ${foodName(e.id)}`}>Quitar</Button>
            </div>
          </div>
        ))}
        <FoodPicker hidden={hidden} onPick={(ids) => addFoods(ids, 'no-disponible')} />
      </Card>

      {overrides.length > 0 && (
        <Card className="space-y-3">
          <h2 className="font-semibold text-stone-900">Cambios guardados</h2>
          {overrides.map((o, i) => (
            <ExclusionRow key={i} name={overrideText(o)} onRemove={() => {
              const prev = { overrides, exclusions };
              removeOverride(o);
              setToast({ message: 'Cambio quitado', onAction: () => restoreChanges(prev) });
            }} />
          ))}
        </Card>
      )}

      {toast && <Toast toast={toast} onDone={closeToast} />}
    </div>
  );
}

function ExclusionRow({ name, detail, onRemove }: { name: string; detail?: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-stone-800">
        {name}
        {detail && <span className="block text-xs text-stone-500">{detail}</span>}
      </span>
      <Button variant="ghost" onClick={onRemove} aria-label={`Quitar ${name}`}>Quitar</Button>
    </div>
  );
}
