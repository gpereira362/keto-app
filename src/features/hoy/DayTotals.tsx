import { Card, cx, grams } from '../../components/ui';
import { fatCaloriePct, proteinTargets } from '../../engine/body';
import { CARB_LIMIT } from '../../engine/scaling';
import type { Macros } from '../../engine/types';

function Bar({ value, max, tone, track }: { value: number; max: number; tone: string; track: string }) {
  return (
    <div className={cx('mt-1 h-2.5 overflow-hidden rounded-full', track)}>
      <div className={cx('h-full rounded-full', tone)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

/** Totales del día contra las metas. Mismos colores que las etiquetas P/G/C. */
export function DayTotals({ totals, idealWeightKg, week }: { totals: Macros; idealWeightKg: number; week: number }) {
  const p = proteinTargets(idealWeightKg, week);
  const pct = Math.round(fatCaloriePct(totals) * 100);
  const nearLimit = totals.carbs > CARB_LIMIT * 0.85;
  return (
    <Card>
      <h2 className="font-semibold text-stone-900">Totales del día</h2>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <div className="flex justify-between">
            <dt className="font-medium text-sky-800">Proteína</dt>
            <dd className="tabular-nums text-stone-900">
              {grams(totals.protein)} <span className="text-stone-500">· meta {Math.round(p.weekMin)}–{Math.round(p.weekMax)} g</span>
            </dd>
          </div>
          <Bar value={totals.protein} max={p.weekMax} tone="bg-sky-500" track="bg-sky-100" />
        </div>
        <div>
          <div className="flex justify-between">
            <dt className="font-medium text-amber-800">Grasa</dt>
            <dd className="tabular-nums text-stone-900">
              {grams(totals.fat)} <span className="text-stone-500">· hasta saciedad ({pct} % kcal)</span>
            </dd>
          </div>
          <Bar value={pct} max={100} tone="bg-amber-400" track="bg-amber-100" />
        </div>
        <div>
          <div className="flex justify-between">
            <dt className="font-medium text-rose-800">Carbohidratos totales</dt>
            <dd className="tabular-nums text-stone-900">
              {grams(totals.carbs, 1)} <span className="text-stone-500">/ máx. {CARB_LIMIT} g</span>
            </dd>
          </div>
          <Bar value={totals.carbs} max={CARB_LIMIT} tone={nearLimit ? 'bg-red-600' : 'bg-rose-400'} track="bg-rose-100" />
          {nearLimit && <p className="mt-1 text-xs text-red-800">Cerca del límite de 20 g.</p>}
        </div>
      </dl>
    </Card>
  );
}
