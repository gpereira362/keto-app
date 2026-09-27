import { describe, expect, it } from 'vitest';
import golden from '../../docs/golden-lista-compras.json';
import { WEEKS } from './data';
import { formatLine, lineParts, pluralLabel, shoppingList, shoppingListText } from './shopping';
import { isExcluded } from './substitutions';
import type { Exclusion, PlanProfile, ShoppingList } from './types';

const g = golden as unknown as Record<string, ShoppingList>;
const profile = (kg: number, exclusions: Exclusion[] = []): PlanProfile => ({ idealWeightKg: kg, exclusions });
const allergy = (id: string): Exclusion[] => [{ type: 'allergen', id: id as Exclusion['id'], reason: 'alergia' }];

describe('lista de compras = docs/golden-lista-compras.json', () => {
  it('semana 1 con 60 kg', () => {
    expect(shoppingList(1, profile(60))).toEqual(g.semana1_60kg);
  });

  it('semana 1 con 60 kg, alergia al pescado y despensa (6 huevos, 500 ml de aceite)', () => {
    const list = shoppingList(1, profile(60, allergy('pescado')), {
      pantry: [{ food: 'huevo', amount: 6 }, { food: 'aceite', amount: 500 }],
    });
    expect(list).toEqual(g.semana1_60kg_sin_pescado_con_despensa);
  });

  it('semana 10 con 75 kg', () => {
    expect(shoppingList(10, profile(75))).toEqual(g.semana10_75kg);
  });
});

describe('reglas de la lista', () => {
  it('una alergia nunca aparece en la lista', () => {
    for (const a of ['huevo', 'lacteos', 'pescado', 'cerdo', 'mariscos', 'mostaza', 'coco']) {
      const ex = allergy(a);
      for (const w of WEEKS) {
        for (const l of shoppingList(w.week, profile(70, ex)).lines) {
          expect(isExcluded(l.food, ex), `${a} semana ${w.week}: ${l.food}`).toBe(false);
        }
      }
    }
  });

  it('sale del plan ya sustituido: cambiar un ingrediente cambia la lista', () => {
    const base = shoppingList(1, profile(60));
    const changed = shoppingList(1, profile(60), {
      overrides: [{ scope: 'semana', week: 1, food: 'ribeye', replacement: [{ food: 'picana', qty: 140 }] }],
    });
    expect(base.lines.some((l) => l.food === 'ribeye')).toBe(true);
    expect(changed.lines.some((l) => l.food === 'ribeye')).toBe(false);
    expect(changed.lines.find((l) => l.food === 'picana')?.need).toBe(182); // 140 × 1.3
  });

  it('dividir en 2 compras suma lo mismo', () => {
    const one = shoppingList(1, profile(60));
    const two = shoppingList(1, profile(60), { split: true });
    expect(two.lines.every((l) => l.trip === 1 || l.trip === 2)).toBe(true);
    const sum = (fid: string) => two.lines.filter((l) => l.food === fid).reduce((s, l) => s + l.need, 0);
    for (const l of one.lines) expect(Math.abs(sum(l.food) - l.need)).toBeLessThanOrEqual(1);
  });

  it('al dividir, solo lo fresco va en la 2.ª compra; lo demás no se compra dos veces', () => {
    const one = shoppingList(1, profile(60));
    const two = shoppingList(1, profile(60), { split: true });
    const second = two.lines.filter((l) => l.trip === 2);
    expect(second.length).toBeGreaterThan(0);
    expect(second.every((l) => ['Carnes', 'Cerdo y embutidos', 'Aves', 'Pescados y mariscos'].includes(l.category))).toBe(true);
    const butter = two.lines.filter((l) => l.food === 'mantequilla');
    expect(butter).toHaveLength(1);
    expect(butter[0]).toMatchObject({ trip: 1, packs: one.lines.find((l) => l.food === 'mantequilla')!.packs });
  });

  it('tamaños de paquete locales', () => {
    const l = shoppingList(1, profile(60), { packSizes: { mantequilla: 200 } }).lines.find((x) => x.food === 'mantequilla')!;
    expect(l.packLabel).toBe('barra/paquete de 200 g');
    expect(l.packs).toBe(Math.ceil(l.need / 200 - 1e-9));
  });

  it('básicos: tiras de orina hasta la semana 9, de sangre desde la 10', () => {
    expect(shoppingList(9, profile(60)).staples).toContain('Tiras de cetonas en orina');
    expect(shoppingList(10, profile(60)).staples).toContain('Tiras de glucosa y cetonas para el medidor');
  });

  it('texto de cada renglón y para compartir', () => {
    const list = shoppingList(1, profile(60));
    const huevos = list.lines.find((l) => l.food === 'huevo')!;
    expect(formatLine(huevos)).toBe(`Huevos — ${huevos.need} → ${huevos.packs} docenas`);
    expect(formatLine(list.lines.find((l) => l.food === 'ribeye')!)).toBe(
      'Ribeye — 195 g (pedir al carnicero en cortes de ~2.5 cm)',
    );
    const text = shoppingListText(list);
    expect(text).toMatch(/^Lista de compras — semana 1/);
    expect(text).toContain('• Sal de buena calidad');
  });
});

describe('plurales de los paquetes', () => {
  it('pluraliza hasta el primer "de" o paréntesis', () => {
    expect(pluralLabel('docena', 2)).toBe('docenas');
    expect(pluralLabel('docena', 1)).toBe('docena');
    expect(pluralLabel('paquete de 500 g', 2)).toBe('paquetes de 500 g');
    expect(pluralLabel('barra/paquete de 227 g', 2)).toBe('barras/paquetes de 227 g');
    expect(pluralLabel('coliflor mediana (≈600 g)', 2)).toBe('coliflores medianas (≈600 g)');
    expect(pluralLabel('calabacín mediano (≈200 g)', 3)).toBe('calabacines medianos (≈200 g)');
    expect(pluralLabel('lata (≈100 g escurridos)', 2)).toBe('latas (≈100 g escurridos)');
    expect(pluralLabel('bolsa congelada de 300 g', 2)).toBe('bolsas congeladas de 300 g');
  });

  it('partes del renglón', () => {
    const list = shoppingList(1, profile(60));
    const esp = list.lines.find((l) => l.food === 'esparragos')!;
    expect(lineParts(esp)).toEqual({ amount: `${esp.need} g`, packs: `${esp.packs} ${esp.packs === 1 ? 'manojo' : 'manojos'} de 450 g`, note: 'se descarta la base dura' });
  });

  it('compartir puede omitir lo ya comprado', () => {
    const list = shoppingList(1, profile(60));
    const text = shoppingListText(list, (l) => l.food === 'huevo');
    expect(text).not.toContain('Huevos —');
    expect(text).toContain('Ribeye —');
  });
});
