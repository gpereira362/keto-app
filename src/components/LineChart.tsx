// Gráfica de una serie en el tiempo (SVG, sin dependencias).
// Línea de 2 px, marcadores con anillo del color de la superficie, cuadrícula tenue,
// cruz + tooltip al pasar el dedo o el mouse, flechas del teclado y vista de tabla.
import { useEffect, useRef, useState } from 'react';
import { daysBetween } from '../engine/plan';
import type { Point } from '../engine/progress';
import { niceTicks } from '../lib/chart';
import { shortDate } from '../lib/date';

const INK = '#047857';        // emerald-700: la única serie
const GRID = '#e7e5e4';       // stone-200
const AXIS_TEXT = '#78716c';  // stone-500
const REF = '#a8a29e';        // stone-400
const SURFACE = '#ffffff';

export interface RefLine { value: number; label: string }

function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    // contentRect no incluye el padding: es el ancho útil de la gráfica.
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function LineChart({ title, points, format, unit, refLines = [], describe }: {
  title: string;
  points: Point[];
  format: (v: number) => string;
  unit: string;
  refLines?: RefLine[];
  /** Texto corto para lectores de pantalla ("Bajó de 72 a 69 kg"). */
  describe?: string;
}) {
  const [box, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const height = 180;
  const pad = { top: 12, right: 44, bottom: 24, left: 36 };

  if (points.length < 2) {
    return (
      <div ref={box} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <h3 className="font-semibold text-stone-900">{title}</h3>
        <p className="mt-2 text-sm text-stone-500">
          {points.length === 1 ? `Un registro: ${format(points[0].value)} ${unit}. ` : ''}Registra al menos 2 días para ver la gráfica.
        </p>
      </div>
    );
  }

  const first = points[0].date;
  const span = Math.max(1, daysBetween(first, points.at(-1)!.date));
  const values = [...points.map((p) => p.value), ...refLines.map((r) => r.value)];
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const y0 = ticks[0];
  const y1 = ticks.at(-1)!;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (date: string) => pad.left + (daysBetween(first, date) / span) * plotW;
  const y = (v: number) => pad.top + (1 - (v - y0) / (y1 - y0)) * plotH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points.at(-1)!;
  const showAllMarkers = points.length <= 14;
  // Si una etiqueta de referencia choca con la anterior (a menos de 14 px), va al otro lado.
  const refSides: { r: RefLine; right: boolean }[] = [];
  refLines.forEach((r, i) => {
    const prev = refSides[i - 1];
    const close = !!prev && Math.abs(y(prev.r.value) - y(r.value)) < 14;
    refSides.push({ r, right: close && !prev.right });
  });

  function nearest(clientX: number, rect: DOMRect): number {
    const px = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i; });
    return best;
  }

  const a = active === null ? null : points[active];
  const tipLeft = a ? Math.min(Math.max(x(a.date), 60), width - 60) : 0;

  return (
    <div ref={box} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-stone-900">{title}</h3>
        <button type="button" className="min-h-11 text-xs font-semibold text-emerald-800 hover:underline" onClick={() => setShowTable(!showTable)}>
          {showTable ? 'Ver gráfica' : 'Ver tabla'}
        </button>
      </div>

      {showTable ? (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-500"><th className="py-1 font-medium">Fecha</th><th className="py-1 text-right font-medium">{unit}</th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {[...points].reverse().map((p) => (
              <tr key={p.date}><td className="py-1.5 text-stone-700">{shortDate(p.date)}</td><td className="py-1.5 text-right tabular-nums text-stone-900">{format(p.value)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-2">
          <svg
            width="100%"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${title}. ${describe ?? ''} Usa las flechas para recorrer los valores.`}
            tabIndex={0}
            className="touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerDown={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setActive(Math.max(0, (active ?? points.length) - 1));
              if (e.key === 'ArrowRight') setActive(Math.min(points.length - 1, (active ?? -1) + 1));
              if (e.key === 'Escape') setActive(null);
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={pad.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>{format(t)}</text>
              </g>
            ))}
            {refSides.map(({ r, right }) => {
              // La etiqueta va debajo de su línea (nombra la zona de abajo).
              return (
                <g key={r.label}>
                  <line x1={pad.left} x2={width - pad.right} y1={y(r.value)} y2={y(r.value)} stroke={REF} strokeWidth={1} />
                  <text
                    x={right ? width - pad.right - 4 : pad.left + 4}
                    y={y(r.value) + 11}
                    textAnchor={right ? 'end' : 'start'}
                    fontSize={10}
                    fill={AXIS_TEXT}
                  >
                    {r.label}
                  </text>
                </g>
              );
            })}
            <text x={pad.left} y={height - 6} fontSize={11} fill={AXIS_TEXT}>{shortDate(first)}</text>
            <text x={width - pad.right} y={height - 6} fontSize={11} fill={AXIS_TEXT} textAnchor="end">{shortDate(last.date)}</text>

            <path d={path} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) =>
              showAllMarkers || i === points.length - 1 ? (
                <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={4} fill={INK} stroke={SURFACE} strokeWidth={2} />
              ) : null,
            )}
            {/* Valor al final de la línea (etiqueta directa selectiva) */}
            <text x={x(last.date) + 8} y={y(last.value)} dy="0.32em" fontSize={12} fontWeight={600} fill="#1c1917">{format(last.value)}</text>

            {a && (
              <g pointerEvents="none">
                <line x1={x(a.date)} x2={x(a.date)} y1={pad.top} y2={pad.top + plotH} stroke={AXIS_TEXT} strokeWidth={1} />
                <circle cx={x(a.date)} cy={y(a.value)} r={5} fill={INK} stroke={SURFACE} strokeWidth={2} />
              </g>
            )}
          </svg>
          {a && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-stone-900 px-2 py-1 text-xs text-white shadow"
              style={{ left: `${(tipLeft / width) * 100}%` }}
            >
              <span className="block text-stone-300">{shortDate(a.date)}</span>
              <span className="font-semibold tabular-nums">{format(a.value)} {unit}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
