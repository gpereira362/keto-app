// Mapa: las 5 fases del Método Renacer y las 14 semanas. Dónde está y lo que falta.
import { Button, Card, cx } from '../../components/ui';
import { PHASES, WEEKS } from '../../engine/data';
import { isFastingWeek } from '../../engine/plan';
import type { PhaseId } from '../../engine/types';
import { useApp } from '../../store/useApp';

const PHASE_COLOR: Record<PhaseId, string> = {
  1: 'bg-orange-100 text-orange-800',
  2: 'bg-amber-100 text-amber-800',
  3: 'bg-teal-100 text-teal-800',
  4: 'bg-sky-100 text-sky-800',
  5: 'bg-emerald-100 text-emerald-800',
};

export function Mapa({ onBack, onOpenWeek }: { onBack: () => void; onOpenWeek: (week: number) => void }) {
  const progress = useApp((s) => s.progress);
  if (!progress) return null;
  const inVivir = !!progress.vivir;
  const current = progress.currentWeek;
  const currentPhase: PhaseId = inVivir ? 5 : WEEKS.find((w) => w.week === current)!.phase;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} aria-label="Volver">‹</Button>
        <h1 className="text-2xl font-bold text-stone-900">Mapa del Método Renacer</h1>
      </header>

      <Card>
        <p className="text-sm text-stone-600">
          {inVivir ? (
            <>Terminaste las 14 semanas. Estás en la <span className="font-semibold text-stone-900">fase 5: Vivir</span>.</>
          ) : (
            <>Estás en la semana <span className="font-semibold text-stone-900">{current} de 14</span>, fase <span className="font-semibold text-stone-900">{currentPhase} de 5</span>.</>
          )}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100" aria-hidden>
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${inVivir ? 100 : ((current - 1) / 14) * 100}%` }} />
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-stone-900">Las 5 fases</h2>
        <Card flush>
          <ol className="divide-y divide-stone-100">
            {PHASES.map((p) => {
              const state = p.phase === currentPhase ? 'actual' : p.phase < currentPhase ? 'hecha' : 'pendiente';
              return (
                <li key={p.phase} className={cx('flex gap-3 px-4 py-3', state === 'actual' && 'bg-emerald-50')} aria-current={state === 'actual' ? 'step' : undefined}>
                  <span className={cx('flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold', state === 'hecha' ? 'bg-emerald-700 text-white' : PHASE_COLOR[p.phase])}>
                    {state === 'hecha' ? '✓' : p.phase}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-stone-900">
                      {p.name}
                      <span className="ml-2 text-xs font-normal text-stone-500">
                        {p.weeks ? `semanas ${p.weeks[0]}–${p.weeks[1]}` : 'para siempre'}
                      </span>
                      <span className="sr-only"> ({state})</span>
                    </span>
                    <span className="block text-xs text-stone-600">{p.summary}</span>
                    <span className="mt-0.5 block text-xs text-emerald-800">Señal: {p.signal}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-stone-900">Las 14 semanas</h2>
        <Card flush>
          <ol className="divide-y divide-stone-100">
            {WEEKS.map((w) => {
              const state = !inVivir && w.week === current ? 'actual' : inVivir || w.week < current ? 'hecha' : 'pendiente';
              return (
                <li key={w.week}>
                  <button
                    type="button"
                    onClick={() => onOpenWeek(w.week)}
                    className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-stone-50', state === 'actual' && 'bg-emerald-50')}
                    aria-current={state === 'actual' ? 'step' : undefined}
                  >
                    <span className={cx('w-8 shrink-0 text-sm font-bold tabular-nums', state === 'pendiente' ? 'text-stone-400' : 'text-emerald-800')}>
                      {state === 'hecha' ? '✓' : w.week}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-stone-900">{w.title}</span>
                      <span className="block text-xs text-stone-500">
                        Semana {w.week} · fase {w.phase}{isFastingWeek(w.week) && ' · ayuno'}{state === 'actual' && ' · estás aquí'}
                      </span>
                    </span>
                    <span className="text-stone-400" aria-hidden>›</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      </section>
    </div>
  );
}
