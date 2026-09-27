import { describe, expect, it } from 'vitest';
import { glucoseFromInput, glucoseToDisplay, parseNumber, weightFromInput, weightToDisplay } from './units';

describe('unidades', () => {
  it('peso kg ↔ lb', () => {
    expect(weightToDisplay(70, 'lb')).toBe(154.3);
    expect(weightFromInput(154.3, 'lb')).toBeCloseTo(70, 1);
    expect(weightToDisplay(70.04, 'kg')).toBe(70);
  });
  it('glucosa mg/dL ↔ mmol/L (× 18)', () => {
    expect(glucoseToDisplay(90, 'mmol/L')).toBe(5);
    expect(glucoseFromInput(5.5, 'mmol/L')).toBe(99);
    expect(glucoseToDisplay(90.4, 'mg/dL')).toBe(90);
  });
  it('lee números con coma', () => {
    expect(parseNumber('72,5')).toBe(72.5);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
  });
});
