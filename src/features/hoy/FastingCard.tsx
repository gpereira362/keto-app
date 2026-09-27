import { useState } from 'react';
import { Button, Card } from '../../components/ui';
import { MedicalWarning } from '../../components/MedicalWarning';
import { fastingHours } from '../../engine/plan';
import type { DailyLog } from '../../engine/types';

/**
 * Semanas 12–14: la advertencia médica se muestra siempre, y hay que confirmarla
 * antes de marcar el ayuno como iniciado (regla 6).
 */
export function FastingCard({ log, activeFastStart, nowIso, onStart }: {
  log?: DailyLog;
  activeFastStart?: string;
  nowIso: string;
  onStart: (acknowledged: boolean) => void;
}) {
  const [ack, setAck] = useState(!!log?.medicalWarningAcknowledged);
  return (
    <div className="space-y-3">
      <MedicalWarning />
      <Card>
        {activeFastStart ? (
          <>
            <p className="text-sm text-stone-600">Ayuno iniciado</p>
            <p className="text-2xl font-bold tabular-nums text-stone-900">{fastingHours(activeFastStart, nowIso)} h</p>
            <p className="text-xs text-stone-500">
              desde {new Date(activeFastStart).toLocaleString('es', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-sm text-stone-800">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-emerald-700" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              Leí la advertencia médica y, si tomo medicamentos, lo hablé con mi médico.
            </label>
            <Button className="w-full" disabled={!ack} onClick={() => onStart(ack)}>Marcar inicio del ayuno</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
