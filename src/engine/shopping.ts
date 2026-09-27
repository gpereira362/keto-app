// Lista de supermercado semanal. Siempre sale del plan ya sustituido (planDay): una sola fuente de verdad.
import { food, programWeek } from './data';
import { pyRound } from './scaling';
import { dayItems, planDay, type PlanContext } from './plan';
import type { Aisle, FoodId, PantryItem, PlanProfile, ShoppingLine, ShoppingList } from './types';

export const AISLE_ORDER: Aisle[] = [
  'Carnes', 'Cerdo y embutidos', 'Aves', 'Pescados y mariscos', 'Huevos y lácteos', 'Verduras', 'Despensa',
];

/** Pasillos que se dividen en 2 compras para que no se echen a perder. */
export const FRESH_AISLES: Aisle[] = ['Carnes', 'Cerdo y embutidos', 'Aves', 'Pescados y mariscos'];

export interface ShoppingOptions extends Omit<PlanContext, 'week'> {
  pantry?: PantryItem[];
  /** Tamaños de paquete locales (Ajustes): alimento de compra → tamaño en packUnit. */
  packSizes?: Record<FoodId, number>;
  /** Dividir en 2 compras: días 1–3 y días 4–7. */
  split?: boolean;
}

export function staples(week: number): string[] {
  return [
    'Sal de buena calidad',
    'Café o té',
    'Agua con gas (opcional)',
    'Magnesio 300–400 mg',
    week <= 9 ? 'Tiras de cetonas en orina' : 'Tiras de glucosa y cetonas para el medidor',
  ];
}

/** Cantidad a comprar por alimento de compra (con `buyAs` y `rawFactor`), para los días indicados. */
function needByFood(week: number, profile: PlanProfile, opts: ShoppingOptions, dayIndexes: number[]): Map<FoodId, number> {
  const w = programWeek(week);
  const need = new Map<FoodId, number>();
  for (const di of dayIndexes) {
    const planned = planDay(w.days[di], profile, { ...opts, week });
    for (const i of dayItems(planned)) {
      const p = food(i.food).purchase;
      const target = p.buyAs ?? i.food;
      need.set(target, (need.get(target) ?? 0) + i.qty * p.perUnit * p.rawFactor);
    }
  }
  return need;
}

function toLines(need: Map<FoodId, number>, pantry: Map<FoodId, number>, packSizes: Record<FoodId, number>, trip?: 1 | 2) {
  const lines: ShoppingLine[] = [];
  for (const [fid, total] of need) {
    const f = food(fid);
    const p = f.purchase;
    const have = pantry.get(fid) ?? 0;
    const amount = total - have;
    pantry.set(fid, Math.max(0, have - total)); // lo que sobra de la despensa pasa a la 2.ª compra
    if (amount <= 0) continue;
    const pack = packSizes[fid] ?? p.pack;
    lines.push({
      food: fid,
      category: f.category,
      name: p.shopName,
      need: p.packUnit !== 'unid' ? pyRound(amount) : pyRound(amount, 1),
      unit: p.packUnit,
      packs: pack ? Math.ceil(amount / pack - 1e-9) : null,
      packLabel: packSizes[fid] ? relabelPack(p.packLabel ?? null, p.pack, packSizes[fid]) : (p.packLabel ?? null),
      note: p.note ?? null,
      ...(trip ? { trip } : {}),
    });
  }
  return lines;
}

/** "barra de 227 g" con tamaño local 200 → "barra de 200 g". */
function relabelPack(label: string | null, original: number | undefined, local: number): string | null {
  if (!label || !original) return label;
  return label.includes(String(original)) ? label.replace(String(original), String(local)) : label;
}

function byAisle(a: ShoppingLine, b: ShoppingLine): number {
  const d = AISLE_ORDER.indexOf(a.category) - AISLE_ORDER.indexOf(b.category);
  if (d !== 0) return d;
  if (a.name === b.name) return 0;
  return a.name < b.name ? -1 : 1; // orden por código, igual que Python
}

export function shoppingList(week: number, profile: PlanProfile, opts: ShoppingOptions = {}): ShoppingList {
  const pantry = new Map((opts.pantry ?? []).map((p) => [p.food, p.amount]));
  const packSizes = opts.packSizes ?? {};
  let lines: ShoppingLine[];
  if (opts.split) {
    // Solo se divide lo fresco (carnes y pescado); lo demás se compra completo en la 1.ª compra.
    const early = needByFood(week, profile, opts, [0, 1, 2]);
    const late = needByFood(week, profile, opts, [3, 4, 5, 6]);
    for (const [fid, amount] of [...late]) {
      if (FRESH_AISLES.includes(food(fid).category)) continue;
      early.set(fid, (early.get(fid) ?? 0) + amount);
      late.delete(fid);
    }
    const first = toLines(early, pantry, packSizes, 1).sort(byAisle);
    const second = toLines(late, pantry, packSizes, 2).sort(byAisle);
    lines = [...first, ...second];
  } else {
    lines = toLines(needByFood(week, profile, opts, [0, 1, 2, 3, 4, 5, 6]), pantry, packSizes).sort(byAisle);
  }
  return { week, idealWeightKg: profile.idealWeightKg, lines, staples: staples(week) };
}

// ---------------------------------------------------------------- texto

/** Plural de una palabra en español: lata → latas, calabacín → calabacines, bolsa/paquete → bolsas/paquetes. */
export function pluralWord(w: string): string {
  if (w.includes('/')) return w.split('/').map(pluralWord).join('/');
  if (/ín$/.test(w)) return w.slice(0, -2) + 'ines';
  if (/ón$/.test(w)) return w.slice(0, -2) + 'ones';
  if (/[aeiouáéó]$/i.test(w)) return w + 's';
  if (/[a-zñ]$/i.test(w)) return w + 'es';
  return w;
}

/** "docena" × 2 → "docenas"; "coliflor mediana (≈600 g)" × 2 → "coliflores medianas (≈600 g)". Se pluraliza hasta el primer "de" o paréntesis. */
export function pluralLabel(label: string, n: number): string {
  if (n === 1) return label;
  const words = label.split(' ');
  const stop = words.findIndex((w) => w === 'de' || w.startsWith('('));
  const head = stop === -1 ? words : words.slice(0, stop);
  const tail = stop === -1 ? [] : words.slice(stop);
  return [...head.map(pluralWord), ...tail].join(' ');
}

function formatAmount(n: number, unit: ShoppingLine['unit']): string {
  const s = String(n).replace('.', ',');
  return unit === 'unid' ? s : `${s} ${unit}`;
}

export interface LineParts { amount: string; packs: string | null; note: string | null }

/** Partes de un renglón para mostrar: "22", "2 docenas", nota. */
export function lineParts(l: ShoppingLine): LineParts {
  return {
    amount: formatAmount(l.need, l.unit),
    packs: l.packs !== null && l.packLabel ? `${l.packs} ${pluralLabel(l.packLabel, l.packs)}` : null,
    note: l.note,
  };
}

/** "Huevos — 22 → 2 docenas", "Ribeye — 195 g (pedir al carnicero…)", "Espárragos — 126 g → 1 manojo de 450 g". */
export function formatLine(l: ShoppingLine): string {
  const p = lineParts(l);
  let s = `${l.name} — ${p.amount}`;
  if (p.packs) s += ` → ${p.packs}`;
  if (p.note) s += ` (${p.note})`;
  return s;
}

/** Texto con viñetas para compartir o copiar. `skip` quita renglones (p. ej. los ya comprados). */
export function shoppingListText(list: ShoppingList, skip: (l: ShoppingLine) => boolean = () => false): string {
  const out = [`Lista de compras — semana ${list.week}`];
  const trips = list.lines.some((l) => l.trip) ? [1, 2] : [undefined];
  for (const trip of trips) {
    const lines = list.lines.filter((l) => l.trip === trip && !skip(l));
    if (trip) out.push('', trip === 1 ? 'Compra 1 (días 1–3)' : 'Compra 2 (días 4–7)');
    for (const aisle of AISLE_ORDER) {
      const inAisle = lines.filter((l) => l.category === aisle);
      if (!inAisle.length) continue;
      out.push('', aisle, ...inAisle.map((l) => `• ${formatLine(l)}`));
    }
  }
  out.push('', 'Básicos', ...list.staples.map((s) => `• ${s}`));
  return out.join('\n');
}
