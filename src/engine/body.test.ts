import { describe, expect, it } from 'vitest';
import {
  idealWeight, idealWeightBmi22, idealWeightDevine, idealWeightRobinson, proteinTargets, validateIdealWeight,
} from './body';

describe('peso ideal', () => {
  it('IMC 22: 165 cm → 60 kg', () => {
    expect(idealWeightBmi22(165)).toBe(60);
    expect(idealWeight('bmi22', 165, 'F')).toBe(60);
  });

  it('IMC 22 en otras estaturas', () => {
    expect(idealWeightBmi22(150)).toBe(49.5); // 49.5
    expect(idealWeightBmi22(180)).toBe(71.5); // 71.28
  });

  it('Devine: 45.5 / 50 + 0.91 × (cm − 152.4)', () => {
    expect(idealWeightDevine(165, 'F')).toBe(57); // 56.97
    expect(idealWeightDevine(165, 'M')).toBe(61.5); // 61.47
    expect(idealWeightDevine(152.4, 'F')).toBe(45.5);
  });

  it('Robinson: 49 / 52 + 1.7 / 1.9 kg por pulgada sobre 5 pies', () => {
    expect(idealWeightRobinson(165, 'F')).toBe(57.5); // 57.43
    expect(idealWeightRobinson(165, 'M')).toBe(61.5); // 61.43
    expect(idealWeightRobinson(152.4, 'M')).toBe(52);
  });

  it('valida entre 35 y 150 kg', () => {
    expect(validateIdealWeight(60)).toBeNull();
    expect(validateIdealWeight(35)).toBeNull();
    expect(validateIdealWeight(150)).toBeNull();
    expect(validateIdealWeight(34.5)).toMatch(/entre 35 y 150/);
    expect(validateIdealWeight(151)).toMatch(/entre 35 y 150/);
    expect(validateIdealWeight(NaN)).not.toBeNull();
  });
});

describe('metas de proteína (sobre el peso ideal)', () => {
  it('semanas 1–9: 1.0 a 1.3 g/kg; base 1.0 y máxima 1.6', () => {
    expect(proteinTargets(60, 1)).toEqual({ base: 60, max: 96, weekMin: 60, weekMax: 78 });
  });
  it('semanas 10–14: 1.0 a 1.6 g/kg', () => {
    const t = proteinTargets(75, 12);
    expect(t.weekMin).toBe(75);
    expect(t.weekMax).toBeCloseTo(120);
  });
});
