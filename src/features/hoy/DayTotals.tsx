import { Card, cx, grams } from '../../components/ui';
import { fatCaloriePct, proteinTargets } from '../../engine/body';
import { CARB_LIMIT } from '../../engine/scaling';
import type { Macros } from '../../engine/types';

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  return (
    <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
      <div className={cx('h-full rounded-full', tone)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

/** Totales del día contra las metas. */
export function DayTotals({ totals, idealWeightKg, week }: { totals: Macros; idealWeightKg: number; week: number }) {
  const p = proteinTargets(idealWeightKg, week);
  const pct = Math.round(fatCaloriePct(totals) * 100);
  return (
    <Card>
      <h2 className="font-semibold text-stone-900">Totales del día</h2>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <div className="flex justify-between">
            <dt className="text-stone-600">Proteína</dt>
            <dd className="tabular-nums text-stone-900">
              {grams(totals.protein)} <span className="text-stone-500">· meta {Math.round(p.weekMin)}–{Math.round(p.weekMax)} g</span>
            </dd>
          </div>
          <Bar value={totals.protein} max={p.weekMax} tone="bg-sky-600" />
        </div>
        <div>
          <div className="flex justify-between">
            <dt className="text-stone-600">Grasa</dt>
            <dd className="tabular-nums text-stone-900">
              {grams(totals.fat)} <span className="text-stone-500">· hasta saciedad ({pct} % kcal)</span>
            </dd>
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <dt className="text-stone-600">Carbohidratos totales</dt>
            <dd className="tabular-nums text-stone-900">
              {grams(totals.carbs, 1)} <span className="text-stone-500">/ máx. {CARB_LIMIT} g</span>
            </dd>
          </div>
          <Bar value={totals.carbs} max={CARB_LIMIT} tone={totals.carbs > CARB_LIMIT * 0.85 ? 'bg-amber-500' : 'bg-emerald-600'} />
        </div>
      </dl>
    </Card>
  );
}
