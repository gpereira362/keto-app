import { describe, expect, it } from 'vitest';
import { formatQty, portionText, pyRound, roundToStep, scaleMealItems, scaleQty, totals } from './scaling';

describe('pyRound (igual que round() de Python)', () => {
  it('mitades al par', () => {
    expect(pyRound(0.5)).toBe(0);
    expect(pyRound(1.5)).toBe(2);
    expect(pyRound(2.5)).toBe(2);
    expect(pyRound(-2.5)).toBe(-2);
    expect(pyRound(2.6)).toBe(3);
  });
  it('con decimales', () => {
    expect(pyRound(0.25, 1)).toBe(0.2);
    expect(pyRound(0.75, 1)).toBe(0.8);
    expect(pyRound(36.44, 1)).toBe(36.4);
    expect(pyRound(1.005, 2)).toBe(1); // 1.005 en binario es 1.00499…
  });
});

describe('escalado y redondeo de porciones', () => {
  it('huevos enteros', () => {
    expect(scaleQty('huevo', 3, 1)).toBe(3);
    expect(scaleQty('huevo', 3, 75 / 60)).toBe(4); // 3.75
    expect(scaleQty('huevo', 3, 90 / 60)).toBe(4); // 4.5 → 4 (mitad al par)
    expect(scaleQty('huevo', 2, 40 / 60)).toBe(1); // 1.33
    expect(scaleQty('huevo', 1, 40 / 60)).toBe(1); // nunca menos de un paso
  });

  it('gramos de 5 en 5', () => {
    expect(scaleQty('ribeye', 150, 75 / 60)).toBe(190); // 187.5 → 190 (37.5 → 38)
    expect(scaleQty('ribeye', 150, 70 / 60)).toBe(175);
    expect(scaleQty('cheddar', 30, 45 / 60)).toBe(20); // 22.5 → 20 (4.5 → 4)
    expect(scaleQty('ribeye', 150, 72 / 60) % 5).toBe(0);
  });

  it('cucharadas de ½ en ½', () => {
    expect(scaleQty('mantequilla', 1, 1)).toBe(1);
    expect(scaleQty('mantequilla', 1, 90 / 60)).toBe(1.5);
    expect(scaleQty('mantequilla', 1, 80 / 60)).toBe(1.5); // 1.33
    expect(scaleQty('mantequilla', 1, 40 / 60)).toBe(0.5);
    expect(scaleQty('mantequilla', 1, 75 / 60)).toBe(1); // 1.25 → 2.5 medios → 2 (al par)
  });

  it('verduras, condimentos y crema del café no se escalan', () => {
    for (const f of ['esparragos', 'crema', 'chucrut', 'mostaza', 'calabacin']) {
      expect(scaleQty(f, 2, 150 / 60)).toBe(2);
    }
  });

  it('roundToStep nunca baja de un paso', () => {
    expect(roundToStep(0.1, 5)).toBe(5);
    expect(roundToStep(0.1, 0.5)).toBe(0.5);
  });

  it('los macros usan las cantidades ya redondeadas', () => {
    const items = scaleMealItems('DES1', 75); // 3 huevos → 4
    const huevo = items.find((i) => i.food === 'huevo')!;
    expect(huevo.qty).toBe(4);
    expect(totals([huevo]).protein).toBeCloseTo(4 * 6.3);
  });
});

describe('texto de la porción', () => {
  it('formatea fracciones', () => {
    expect(formatQty(3)).toBe('3');
    expect(formatQty(1.5)).toBe('1½');
    expect(formatQty(0.5)).toBe('½');
  });
  it('ejemplos del SPEC', () => {
    expect(portionText('huevo', 3)).toBe('3 huevos');
    expect(portionText('huevo', 1)).toBe('1 huevo');
    expect(portionText('ribeye', 150)).toBe('150 g de ribeye (cocido)');
    expect(portionText('mantequilla', 1.5)).toBe('1½ cdas de mantequilla');
    expect(portionText('mantequilla', 0.5)).toBe('½ cda de mantequilla');
    expect(portionText('chucrut', 1)).toBe('½ taza de chucrut');
    expect(portionText('lechuga', 2)).toBe('2 tazas de lechuga');
    expect(portionText('sardinas', 1.5)).toMatch(/^1½ latas de sardinas/);
  });
});
