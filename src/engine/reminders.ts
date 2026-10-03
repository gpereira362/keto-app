// Recordatorios para la agenda del teléfono (archivo .ics): funcionan en iPhone y Android sin servidor.
import { eatingWindow, mealCategory } from './plan';
import type { PlannedDay } from './types';

export interface ReminderOptions {
  meals: boolean;        // cada comida del plan
  windowClose: boolean;  // cierre de la ventana de comida
  water: boolean;        // agua con sal, 2 veces al día
  measure: boolean;      // medir al despertar
}

export const DEFAULT_REMINDERS: ReminderOptions = { meals: true, windowClose: true, water: true, measure: true };

export interface CalendarEvent {
  uid: string;
  date: string;      // yyyy-mm-dd
  time: string;      // HH:MM, hora local del teléfono
  minutes: number;   // duración
  title: string;
  description?: string;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const isTime = (t: string) => /^\d{2}:\d{2}$/.test(t);

/**
 * Recordatorios de los días indicados. `dates[i]` es la fecha del día `days[i]`;
 * los días anteriores a `fromDate` se omiten.
 */
export function weekReminders(
  days: PlannedDay[],
  dates: string[],
  wakeTime: string,
  opts: ReminderOptions,
  fromDate: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const wake = isTime(wakeTime) ? toMin(wakeTime) : 7 * 60;
  days.forEach((day, i) => {
    const date = dates[i];
    if (!date || date < fromDate) return;
    const win = eatingWindow(day);
    const id = (s: string) => `${date}-s${day.week}d${day.dayIndex + 1}-${s}@keto-app`;

    if (opts.measure) {
      events.push({
        uid: id('medir'), date, time: toTime(wake), minutes: 10,
        title: day.week <= 9 ? 'Mide: tira de cetonas en orina' : 'Mide: glucosa y cetonas en sangre',
        description: 'Anótalo en la app, en Registro.',
      });
    }
    if (!win) {
      events.push({
        uid: id('ayuno'), date, time: toTime(wake + 5), minutes: 15,
        title: 'Día de ayuno: agua, sal, café negro o té',
        description: 'Si te sientes mal o tienes mareo, rompe el ayuno y consulta a tu médico.',
      });
    }
    if (opts.meals) {
      for (const s of day.slots) {
        const cat = mealCategory(s.mealId);
        if (cat === 'CAF' || cat === 'AYU' || !isTime(s.time)) continue;
        events.push({
          uid: id(`comida${s.slotIndex}`), date, time: s.time, minutes: 30,
          title: `${s.label}: ${s.mealName}`,
          description: s.items.map((it) => `• ${it.text}`).join('\n'),
        });
      }
    }
    if (opts.windowClose && win) {
      events.push({ uid: id('cierre'), date, time: win.closes, minutes: 5, title: 'Se cierra tu ventana de comida' });
    }
    if (opts.water) {
      events.push({ uid: id('agua1'), date, time: toTime(wake + 180), minutes: 5, title: 'Agua con sal' });
      events.push({ uid: id('agua2'), date, time: toTime(wake + 480), minutes: 5, title: 'Agua con sal' });
    }
  });
  return events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// ---------------------------------------------------------------- formato iCalendar (RFC 5545)

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Corta las líneas largas (el estándar pide máximo 75 bytes; con tildes, 60 caracteres es seguro). */
function fold(line: string): string {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 60) parts.push((i ? ' ' : '') + line.slice(i, i + 60));
  return parts.join('\r\n');
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const local = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

/** Archivo .ics con alarma en cada evento. La hora es la local del teléfono. */
export function toICS(events: CalendarEvent[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Keto App//Recordatorios//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${local(e.date, e.time)}`,
      `DURATION:PT${e.minutes}M`,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0M',
      `DESCRIPTION:${escapeText(e.title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
