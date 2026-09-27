import { describe, expect, it } from 'vitest';
import { niceTicks } from './chart';

describe('marcas del eje Y', () => {
  it('cubren el rango con pasos redondos', () => {
    expect(niceTicks(68.2, 72.4)).toEqual([68, 70, 72, 74]);
    expect(niceTicks(15, 120)).toEqual([0, 50, 100, 150]);
    expect(niceTicks(85, 95)).toEqual([85, 87.5, 90, 92.5, 95]);
  });
  it('con un solo valor abre un rango', () => {
    const t = niceTicks(70, 70);
    expect(t[0]).toBeLessThan(70);
    expect(t.at(-1)).toBeGreaterThan(70);
  });
});
