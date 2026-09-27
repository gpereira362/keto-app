// Textos para mostrar en la interfaz.
import { FOOD_LIST, food } from '../engine/data';
import type { Allergen, FoodId } from '../engine/types';

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  huevo: 'Huevo', lacteos: 'Lácteos', pescado: 'Pescado', mariscos: 'Mariscos', cerdo: 'Cerdo', mostaza: 'Mostaza', coco: 'Coco',
};

/** Nombre corto del alimento ("Ribeye", "Espárragos"). */
export function foodName(id: FoodId): string {
  return food(id).purchase.shopName;
}

/** Minúsculas y sin tildes, para buscar: "Hígado" → "higado". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Kilos con coma decimal: 57.5 → "57,5 kg". */
export function kg(n: number): string {
  return `${String(n).replace('.', ',')} kg`;
}

/** Alimentos que se muestran con el mismo nombre ("Espárragos" en porción y en gramos). */
export function sameNameFoods(id: FoodId): FoodId[] {
  const name = foodName(id);
  return FOOD_LIST.filter((f) => f.purchase.shopName === name).map((f) => f.id);
}
