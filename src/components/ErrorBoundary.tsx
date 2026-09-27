// Si una pantalla falla, muestra un aviso en lugar de dejar la app en blanco. Los datos no se tocan.
import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
        <p className="font-semibold">Algo salió mal en esta pantalla.</p>
        <p className="mt-1">Tus datos están a salvo. Prueba otra pestaña o recarga la app.</p>
        <button type="button" className="mt-3 min-h-11 font-semibold underline" onClick={() => location.reload()}>
          Recargar
        </button>
      </div>
    );
  }
}
