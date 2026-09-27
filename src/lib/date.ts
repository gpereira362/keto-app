// Fechas locales del dispositivo (la persona vive en su zona horaria, no en UTC).

const pad = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd en hora local. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** HH:MM en hora local. */
export function localTime(d = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "lunes 5 de octubre". */
export function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "dom 27 sep". */
export function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '');
}
