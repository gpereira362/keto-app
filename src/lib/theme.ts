// Color por momento de comida: un ícono y un tono, siempre junto al nombre (nunca solo el color).
import type { MealCategory } from '../engine/plan';
import type { Aisle } from '../engine/types';

export interface MealTheme {
  icon: string;
  /** Franja de color a la izquierda de la tarjeta. */
  bar: string;
  /** Fondo del círculo del ícono. */
  badge: string;
  /** Texto del momento (Desayuno, Cena…), con contraste suficiente. */
  label: string;
}

const THEMES: Record<MealCategory, MealTheme> = {
  CAF: { icon: '☕', bar: 'border-l-amber-400', badge: 'bg-amber-100', label: 'text-amber-800' },
  DES: { icon: '🍳', bar: 'border-l-orange-400', badge: 'bg-orange-100', label: 'text-orange-800' },
  P2: { icon: '🍳', bar: 'border-l-orange-400', badge: 'bg-orange-100', label: 'text-orange-800' },
  ALM: { icon: '🥗', bar: 'border-l-emerald-500', badge: 'bg-emerald-100', label: 'text-emerald-800' },
  CEN: { icon: '🌙', bar: 'border-l-indigo-400', badge: 'bg-indigo-100', label: 'text-indigo-800' },
  OM: { icon: '🍽️', bar: 'border-l-teal-500', badge: 'bg-teal-100', label: 'text-teal-800' },
  RUP: { icon: '🥣', bar: 'border-l-rose-400', badge: 'bg-rose-100', label: 'text-rose-800' },
  AYU: { icon: '💧', bar: 'border-l-sky-400', badge: 'bg-sky-100', label: 'text-sky-800' },
  DB: { icon: '🍽️', bar: 'border-l-violet-400', badge: 'bg-violet-100', label: 'text-violet-800' },
};

export function mealTheme(category: MealCategory): MealTheme {
  return THEMES[category];
}

/** Pasillos de la lista de compras: ícono y encabezado de color. */
export const AISLE_THEME: Record<Aisle, { icon: string; head: string }> = {
  Carnes: { icon: '🥩', head: 'bg-red-50 text-red-800' },
  'Cerdo y embutidos': { icon: '🥓', head: 'bg-rose-50 text-rose-800' },
  Aves: { icon: '🍗', head: 'bg-orange-50 text-orange-800' },
  'Pescados y mariscos': { icon: '🐟', head: 'bg-sky-50 text-sky-800' },
  'Huevos y lácteos': { icon: '🥚', head: 'bg-amber-50 text-amber-800' },
  Verduras: { icon: '🥬', head: 'bg-emerald-50 text-emerald-800' },
  Despensa: { icon: '🫙', head: 'bg-violet-50 text-violet-800' },
};
