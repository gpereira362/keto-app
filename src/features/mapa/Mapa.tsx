// Mapa: los 12 pasos del continuum y las 14 semanas. Dónde está y lo que falta.
import { Button, Card, cx } from '../../components/ui';
import { STEPS, WEEKS, programWeek } from '../../engine/data';
import { isFastingWeek } from '../../engine/plan';
import type { Phase } from '../../engine/types';
import { useApp } from '../../store/useApp';

/** "2 → 3" → [2, 3]. */
export function stepsOf(step: string): number[] {
  return (step.match(/\d+/g) ?? []).map(Number);
}

const PHASES: Phase[] = ['Principiante', 'Metabolismo base', 'Estresar el metabolismo'];

export function Mapa({ onBack, onOpenWeek }: { onBack: () => void; onOpenWeek: (week: number) => void }) {
  const progress = useApp((s) => s.progress);
  if (!progress) return null;
  const current = progress.currentWeek;
  const currentSteps = stepsOf(programWeek(current).step);
  const maxDone = Math.min(...currentSteps) - 1;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} aria-label="Volver">‹</Button>
        <h1 className="text-2xl font-bold text-stone-900">Mapa</h1>
      </header>

      <Card>
        <p className="text-sm text-stone-600">Estás en la semana <span className="font-semibold text-stone-900">{current} de 14</span>, paso <span className="font-semibold text-stone-900">{programWeek(current).step}</span> de 12.</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden>
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${((current - 1) / 14) * 100}%` }} />
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-stone-900">Los 12 pasos</h2>
        {PHASES.map((phase) => (
          <Card key={phase} flush>
            <h3 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">{phase}</h3>
            <ol className="divide-y divide-stone-100">
              {STEPS.filter((s) => s.phase === phase).map((s) => {
                const state = currentSteps.includes(s.step) ? 'actual' : s.step <= maxDone ? 'hecho' : 'pendiente';
                return (
                  <li key={s.step} className={cx('flex gap-3 px-4 py-3', state === 'actual' && 'bg-emerald-50')} aria-current={state === 'actual' ? 'step' : undefined}>
                    <span
                      className={cx(
                        'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        state === 'hecho' && 'bg-emerald-700 text-white',
                        state === 'actual' && 'bg-white text-emerald-800 ring-2 ring-emerald-700',
                        state === 'pendiente' && 'bg-stone-100 text-stone-500',
                      )}
                    >
                      {state === 'hecho' ? '✓' : s.step}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-stone-900">
                        {s.title}
                        <span className="sr-only"> ({state})</span>
                      </span>
                      {(s.notes || s.minDuration) && (
                        <span className="block text-xs text-stone-500">{[s.notes, s.minDuration].filter(Boolean).join(' · ')}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-stone-900">Las 14 semanas</h2>
        <Card flush>
          <ol className="divide-y divide-stone-100">
            {WEEKS.map((w) => {
              const state = w.week === current ? 'actual' : w.week < current ? 'hecha' : 'pendiente';
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
                        Semana {w.week} · paso {w.step}{isFastingWeek(w.week) && ' · ayuno'}{state === 'actual' && ' · estás aquí'}
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
