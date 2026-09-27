import { useState } from 'react';
import { Button } from '../../components/ui';
import { suggestAdvance } from '../../engine/progress';
import type { DailyLog, Profile, ProgressState } from '../../engine/types';

/** Regla 7: la app sugiere avanzar; la persona decide. Si no se cumple tras 7 días, ofrece repetir. */
export function AdvanceBanner({ progress, logs, today, profile, daysInWeek, onAdvance, onRepeat, onAcknowledge }: {
  progress: ProgressState;
  logs: DailyLog[];
  today: string;
  profile: Profile;
  daysInWeek: number;
  onAdvance: () => void;
  onRepeat: () => void;
  onAcknowledge: () => void;
}) {
  const [comfortable, setComfortable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const s = suggestAdvance({ progress, logs, today, profile, comfortableIn18_6: comfortable });
  const week = progress.currentWeek;
  if (week >= 14 || dismissed) return null;
  if (!s.ready && daysInWeek < 7 && week !== 9) return null;

  return (
    <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950 ring-1 ring-emerald-200">
      <p className="font-semibold">{s.ready ? `Puedes pasar a la semana ${week + 1}` : `Semana ${week}: aún no`}</p>
      <p className="mt-1">{s.reason}</p>
      {week === 9 && !s.ready && (
        <label className="mt-2 flex items-center gap-3">
          <input type="checkbox" className="size-5 accent-emerald-700" checked={comfortable} onChange={(e) => setComfortable(e.target.checked)} />
          18:6 me resulta cómodo
        </label>
      )}
      {s.needsMedicalAck && !s.ready && (
        <Button variant="secondary" className="mt-3" onClick={onAcknowledge}>Ya lo hablé con mi médico</Button>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {s.ready ? (
          <>
            <Button onClick={onAdvance}>Avanzar a la semana {week + 1}</Button>
            <Button variant="ghost" onClick={() => setDismissed(true)}>Todavía no</Button>
          </>
        ) : (
          daysInWeek >= 7 && <Button variant="secondary" onClick={onRepeat}>Repetir semana</Button>
        )}
      </div>
    </div>
  );
}
