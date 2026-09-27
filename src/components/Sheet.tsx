// Hoja inferior modal (celular).
import { useEffect, useRef, type ReactNode } from 'react';

export function Sheet({ title, onClose, children, footer }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-stone-900/40" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-stone-50 shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-full text-xl text-stone-500 hover:bg-stone-200" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-stone-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
