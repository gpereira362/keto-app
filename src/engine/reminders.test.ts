import { describe, expect, it } from 'vitest';
import { addDays, getWeekPlan } from './plan';
import { DEFAULT_REMINDERS, toICS, weekReminders } from './reminders';

const profile = { idealWeightKg: 60, exclusions: [] };
const start = '2026-10-05';
const datesOf = (n = 7) => Array.from({ length: n }, (_, i) => addDays(start, i));

describe('recordatorios de la semana', () => {
  it('semana 1: medir, 3 comidas, cierre de ventana y 2 de agua por día', () => {
    const ev = weekReminders(getWeekPlan(profile, 1), datesOf(), '06:30', DEFAULT_REMINDERS, start);
    const lunes = ev.filter((e) => e.date === start);
    expect(lunes.map((e) => `${e.time} ${e.title}`)).toEqual([
      '06:30 Mide: tira de cetonas en orina',
      '07:30 Desayuno: Huevos revueltos con queso',
      '09:30 Agua con sal',
      '12:30 Almuerzo: Bratwurst con chucrut',
      '14:30 Agua con sal',
      '18:30 Cena: Alitas con salsa de queso azul',
      '19:30 Se cierra tu ventana de comida',
    ]);
    expect(ev).toHaveLength(7 * 7);
    expect(lunes[1].description).toContain('• 3 huevos');
  });

  it('se pueden apagar por tipo', () => {
    const ev = weekReminders(getWeekPlan(profile, 1), datesOf(), '06:30',
      { meals: false, windowClose: false, water: true, measure: false }, start);
    expect(ev.every((e) => e.title === 'Agua con sal')).toBe(true);
  });

  it('omite los días que ya pasaron', () => {
    const ev = weekReminders(getWeekPlan(profile, 1), datesOf(), '06:30', DEFAULT_REMINDERS, addDays(start, 5));
    expect(new Set(ev.map((e) => e.date))).toEqual(new Set([addDays(start, 5), addDays(start, 6)]));
  });

  it('día de ayuno: sin comidas ni cierre de ventana, con aviso de ayuno; desde la semana 10 se mide en sangre', () => {
    const ev = weekReminders(getWeekPlan(profile, 12), datesOf(), '06:30', DEFAULT_REMINDERS, start);
    const martes = ev.filter((e) => e.date === addDays(start, 1)).map((e) => e.title);
    expect(martes).toContain('Día de ayuno: agua, sal, café negro o té');
    expect(martes).toContain('Mide: glucosa y cetonas en sangre');
    expect(martes.some((t) => t.startsWith('Se cierra'))).toBe(false);
  });
});

describe('archivo .ics', () => {
  it('formato válido con alarma, hora local y textos escapados', () => {
    const ics = toICS(
      [{ uid: 'a@keto-app', date: '2026-10-05', time: '07:30', minutes: 30, title: 'Desayuno: huevos, tocino', description: '• 3 huevos\n• 1 cda' }],
      new Date('2026-10-01T12:00:00Z'),
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261005T073000\r\n');
    expect(ics).toContain('DURATION:PT30M');
    expect(ics).toContain('SUMMARY:Desayuno: huevos\\, tocino');
    expect(ics).toContain('DESCRIPTION:• 3 huevos\\n• 1 cda');
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:PT0M');
    expect(ics).toContain('DTSTAMP:20261001T120000Z');
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    // Ninguna línea pasa de 75 bytes.
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
