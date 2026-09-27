// Piezas de interfaz compartidas.
import { cloneElement, isValidElement, useId, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { pyRound } from '../engine/scaling';
import type { Macros } from '../engine/types';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className, flush }: { children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cx('rounded-2xl bg-white shadow-sm ring-1 ring-stone-200', !flush && 'p-4', className)}>{children}</section>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-stone-300',
  secondary: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  ghost: 'text-emerald-800 hover:bg-emerald-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};

export function Button({
  variant = 'primary', className, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

/** Botón que se marca o desmarca (alergias, sexo, métodos). */
export function Chip({ selected, onClick, children, className }: {
  selected: boolean; onClick: () => void; children: ReactNode; className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'min-h-11 rounded-full px-4 py-2 text-sm font-medium ring-1 transition',
        selected ? 'bg-emerald-700 text-white ring-emerald-700' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Etiqueta + campo. Conecta la etiqueta y la ayuda al campo (id / aria-describedby) para lectores de pantalla. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const field = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, ...(hint ? { 'aria-describedby': hintId } : {}) })
    : children;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-stone-700">{label}</label>
      <div className="mt-1">{field}</div>
      {hint && <span id={hintId} className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </div>
  );
}

export const inputClass =
  'w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30';

/** Gramos para mostrar: proteína y grasa enteras, carbohidratos con un decimal. */
export function grams(n: number, digits = 0): string {
  return `${String(pyRound(n, digits)).replace('.', ',')} g`;
}

export function MacroChips({ m, className }: { m: Macros; className?: string }) {
  return (
    <span className={cx('inline-flex gap-2 text-xs tabular-nums text-stone-500', className)}>
      <span title="Proteína">P {grams(m.protein)}</span>
      <span title="Grasa">G {grams(m.fat)}</span>
      <span title="Carbohidratos">C {grams(m.carbs, 1)}</span>
    </span>
  );
}

export function EstimatedNote() {
  return <p className="px-1 text-center text-xs text-stone-400">Valores estimados (USDA). Uso educativo.</p>;
}
