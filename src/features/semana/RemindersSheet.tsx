// Descarga los recordatorios de la semana para la agenda del teléfono (archivo .ics).
import { useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/ui';
import { programDayDate } from '../../engine/plan';
import { DEFAULT_REMINDERS, toICS, weekReminders, type ReminderOptions } from '../../engine/reminders';
import type { PlannedDay, ProgressState } from '../../engine/types';

const OPTIONS: { key: keyof ReminderOptions; label: string; hint: string }[] = [
  { key: 'meals', label: 'Cada comida', hint: 'A la hora de cada comida, con lo que vas a comer' },
  { key: 'windowClose', label: 'Cierre de la ventana de comida', hint: 'Cuando ya no se come más ese día' },
  { key: 'water', label: 'Agua con sal', hint: '2 veces al día' },
  { key: 'measure', label: 'Medir al despertar', hint: 'Tira de orina o glucosa y cetonas' },
];

export function RemindersSheet({ week, days, progress, wakeTime, today, onClose }: {
  week: number;
  days: PlannedDay[];
  progress: ProgressState;
  wakeTime: string;
  today: string;
  onClose: () => void;
}) {
  const [opts, setOpts] = useState<ReminderOptions>(DEFAULT_REMINDERS);
  const [done, setDone] = useState(false);
  const dates = days.map((d) => programDayDate(progress, { week, dayIndex: d.dayIndex }).date);
  const events = weekReminders(days, dates, wakeTime, opts, today);

  function download() {
    const blob = new Blob([toICS(events)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recordatorios-semana-${week}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDone(true);
  }

  return (
    <Sheet
      title={`Recordatorios · semana ${week}`}
      onClose={onClose}
      footer={
        <Button className="w-full" disabled={events.length === 0} onClick={download}>
          {events.length ? `Agregar ${events.length} recordatorios a mi agenda` : 'No hay días por delante en esta semana'}
        </Button>
      }
    >
      <p className="text-sm text-stone-600">Se agregan a la agenda de tu teléfono con alarma, desde hoy hasta el final de esta semana.</p>
      <div className="mt-3 space-y-1">
        {OPTIONS.map((o) => (
          <label key={o.key} className="flex min-h-12 items-start gap-3 py-1 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-emerald-700"
              checked={opts[o.key]}
              onChange={(e) => setOpts({ ...opts, [o.key]: e.target.checked })}
            />
            <span>
              <span className="block font-medium text-stone-900">{o.label}</span>
              <span className="block text-xs text-stone-500">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {done && (
        <div role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 ring-1 ring-emerald-200">
          <p className="font-semibold">Archivo descargado. Ahora ábrelo:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li><span className="font-medium">iPhone:</span> toca el archivo y elige “Agregar todo”.</li>
            <li><span className="font-medium">Android:</span> ábrelo con Google Calendar y toca “Importar”.</li>
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-stone-500">Cada semana trae horarios distintos: vuelve aquí al empezar cada semana.</p>
    </Sheet>
  );
}
