// Aviso temporal con acción ("Deshacer").
import { useEffect } from 'react';

export interface ToastData { message: string; actionLabel?: string; onAction?: () => void }

export function Toast({ toast, onDone, ms = 8000 }: { toast: ToastData; onDone: () => void; ms?: number }) {
  useEffect(() => {
    const id = setTimeout(onDone, ms);
    return () => clearTimeout(id);
  }, [toast, onDone, ms]);

  return (
    <div role="status" className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
        <span>{toast.message}</span>
        {toast.onAction && (
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-xl px-3 font-semibold text-emerald-300 hover:bg-white/10"
            onClick={() => { toast.onAction!(); onDone(); }}
          >
            {toast.actionLabel ?? 'Deshacer'}
          </button>
        )}
      </div>
    </div>
  );
}
