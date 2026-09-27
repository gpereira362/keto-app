// Conversión de unidades para mostrar e ingresar. Se guarda siempre en kg y mg/dL.
import { MGDL_PER_MMOL } from '../engine/progress';
import type { Profile } from '../engine/types';

type Units = Profile['units'];
export const KG_PER_LB = 0.45359237;

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

export function weightToDisplay(kg: number, unit: Units['weight']): number {
  return unit === 'lb' ? round(kg / KG_PER_LB, 1) : round(kg, 1);
}
export function weightFromInput(value: number, unit: Units['weight']): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}
export function glucoseToDisplay(mgdl: number, unit: Units['glucose']): number {
  return unit === 'mmol/L' ? round(mgdl / MGDL_PER_MMOL, 1) : Math.round(mgdl);
}
export function glucoseFromInput(value: number, unit: Units['glucose']): number {
  return unit === 'mmol/L' ? value * MGDL_PER_MMOL : value;
}

/** "72,5" → 72.5; vacío o inválido → undefined. */
export function parseNumber(s: string): number | undefined {
  const n = Number(s.trim().replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : undefined;
}

/** 72.5 → "72,5". */
export function fmt(n: number): string {
  return String(n).replace('.', ',');
}
