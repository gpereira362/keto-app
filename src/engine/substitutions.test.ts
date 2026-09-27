import { describe, expect, it } from 'vitest';
import golden from '../../docs/golden-sustituciones.json';
import { FOOD_LIST } from './data';
import { scaleMealItems } from './scaling';
import {
  activeExclusions, applyExclusions, endOfWeek, foodsWithAllergen, isExcluded, substitutionOptions,
} from './substitutions';
import type { Exclusion } from './types';

const none: Exclusion[] = [];
const allergy = (id: string): Exclusion[] => [{ type: 'allergen', id: id as Exclusion['id'], reason: 'alergia' }];
const g = golden as unknown as Record<string, unknown>;

describe('opciones de sustitución = docs/golden-sustituciones.json', () => {
  const cases: [string, () => unknown][] = [
    ['espárragos (1 porción) sin exclusiones', () => substitutionOptions('esparragos', 1, none).slice(0, 6)],
    ['ribeye 150 g', () => substitutionOptions('ribeye', 150, none).slice(0, 6)],
    ['salmón 150 g', () => substitutionOptions('salmon', 150, none).slice(0, 6)],
    ['3 huevos', () => substitutionOptions('huevo', 3, none).slice(0, 5)],
    ['mantequilla 1 cda', () => substitutionOptions('mantequilla', 1, none).slice(0, 5)],
    ['crema de café 2 cdas, alergia a lácteos', () => substitutionOptions('crema', 2, allergy('lacteos')).slice(0, 3)],
  ];
  for (const [name, run] of cases) {
    it(name, () => expect(run()).toEqual(g[name]));
  }

  it('DES1 con alergia al huevo', () => {
    const r = applyExclusions(scaleMealItems('DES1', 60), allergy('huevo'));
    expect([r.items, r.changes]).toEqual(g['DES1 con alergia al huevo']);
  });

  it('CEN4 sin cerdo', () => {
    const noPork: Exclusion[] = [{ type: 'allergen', id: 'cerdo', reason: 'no-me-gusta' }];
    const r = applyExclusions(scaleMealItems('CEN4', 60), noPork);
    expect([r.items, r.changes]).toEqual(g['CEN4 sin cerdo']);
  });
});

describe('reglas de sustitución', () => {
  it('completa grasa con el orden __fat_topup_order si falta más de 5 g', () => {
    const opts = substitutionOptions('ribeye', 150, none);
    const entrecot = opts.find((o) => o.food === 'entrecot')!;
    expect(entrecot.items[1]).toEqual({ food: 'mantequilla', qty: 0.5 });
    expect(entrecot.flags).toContain('grasa-añadida');
    // Con alergia a lácteos se usa la siguiente grasa (ghee también es lácteo → aceite de oliva).
    const dairyFree = substitutionOptions('ribeye', 150, allergy('lacteos')).find((o) => o.food === 'entrecot')!;
    expect(dairyFree.items[1].food).not.toBe('mantequilla');
    expect(isExcluded(dairyFree.items[1].food, allergy('lacteos'))).toBe(false);
  });

  it('las opciones que pasan el día de 20 g van al final, marcadas', () => {
    const opts = substitutionOptions('esparragos', 1, none, 18);
    const firstBad = opts.findIndex((o) => o.flags.includes('excede-carbohidratos'));
    expect(firstBad).toBeGreaterThan(-1);
    expect(opts.slice(firstBad).every((o) => o.flags.includes('excede-carbohidratos'))).toBe(true);
  });

  it('sin sustituto que quepa, avisa "elegir otra comida"', () => {
    const r = applyExclusions([{ food: 'esparragos', qty: 1 }], [{ type: 'food', id: 'esparragos', reason: 'no-me-gusta' }], 0.5);
    expect(r.changes[0].replacement).toBeNull();
    expect(r.changes[0].warning).toMatch(/elegir otra comida/);
  });

  it('la mayonesa cuenta como huevo', () => {
    expect(foodsWithAllergen('huevo')).toContain('mayo');
    expect(isExcluded('mayo', allergy('huevo'))).toBe(true);
  });

  it('"no-disponible" vence sola; por defecto el domingo', () => {
    expect(endOfWeek('2026-09-23')).toBe('2026-09-27'); // miércoles → domingo
    expect(endOfWeek('2026-09-27')).toBe('2026-09-27'); // domingo
    const ex: Exclusion[] = [{ type: 'food', id: 'esparragos', reason: 'no-disponible', until: '2026-09-27' }];
    expect(activeExclusions(ex, '2026-09-27')).toHaveLength(1);
    expect(activeExclusions(ex, '2026-09-28')).toHaveLength(0);
  });

  it('una alergia nunca aparece como opción', () => {
    for (const a of ['huevo', 'lacteos', 'pescado', 'mariscos', 'cerdo', 'mostaza', 'coco']) {
      const ex = allergy(a);
      for (const f of FOOD_LIST) {
        for (const o of substitutionOptions(f.id, 1, ex)) {
          for (const i of o.items) expect(isExcluded(i.food, ex), `${a}: ${f.id} → ${i.food}`).toBe(false);
        }
      }
    }
  });
});
