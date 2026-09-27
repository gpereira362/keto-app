// Utilidades puras para las gráficas.

/** Marcas "redondas" para el eje Y (pasos de 1, 2, 2,5, 5 × 10^n) que cubren [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; ; v += step) {
    ticks.push(Number(v.toFixed(6)));
    if (v >= max - 1e-9) break;
  }
  return ticks;
}
