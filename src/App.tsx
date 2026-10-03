import { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { cx } from './components/ui';
import { Ajustes } from './features/ajustes/Ajustes';
import { Alimentos } from './features/alimentos/Alimentos';
import { Mapa } from './features/mapa/Mapa';
import { Exclusiones } from './features/exclusiones/Exclusiones';
import { Hoy } from './features/hoy/Hoy';
import { ListaCompras } from './features/lista-compras/ListaCompras';
import { Progreso } from './features/progreso/Progreso';
import { Registro } from './features/registro/Registro';
import { Mas } from './features/mas/Mas';
import { Onboarding } from './features/onboarding/Onboarding';
import { Semana } from './features/semana/Semana';
import { useApp } from './store/useApp';

const TABS = [
  { id: 'hoy', label: 'Hoy', icon: '☀' },
  { id: 'semana', label: 'Semana', icon: '▦' },
  { id: 'compras', label: 'Compras', icon: '🛒' },
  { id: 'registro', label: 'Registro', icon: '✎' },
  { id: 'mas', label: 'Más', icon: '☰' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** Pantallas secundarias y la pestaña a la que pertenecen. */
const SUBROUTES = {
  exclusiones: 'mas', mapa: 'mas', alimentos: 'mas', ajustes: 'mas', progreso: 'registro',
} as const satisfies Record<string, Tab>;
type Route = Tab | keyof typeof SUBROUTES;

/** "#/compras/3" → { route: 'compras', param: '3' }. */
function readHash(): { route: Route; param?: string } {
  const [h, param] = window.location.hash.replace(/^#\/?/, '').split('/');
  const route = TABS.some((t) => t.id === h) || h in SUBROUTES ? (h as Route) : 'hoy';
  return { route, param };
}

function tabOf(r: Route): Tab {
  return r in SUBROUTES ? SUBROUTES[r as keyof typeof SUBROUTES] : (r as Tab);
}

/** Navegación mínima por hash (#/hoy, #/semana, #/compras/3, #/exclusiones): sin dependencias. */
function useRoute(): [{ route: Route; param?: string }, (r: Route, param?: string | number) => void] {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const on = () => {
      setRoute(readHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [route, (r, param) => { window.location.hash = param === undefined ? `/${r}` : `/${r}/${param}`; }];
}

/** Espera a que IndexedDB cargue el estado guardado. */
function useHydrated(): boolean {
  const [done, setDone] = useState(useApp.persist.hasHydrated());
  useEffect(() => useApp.persist.onFinishHydration(() => setDone(true)), []);
  return done;
}

export default function App() {
  const hydrated = useHydrated();
  const onboarded = useApp((s) => !!s.profile && !!s.progress);
  const [{ route, param }, go] = useRoute();

  if (!hydrated) return <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-stone-50 to-amber-50/40" aria-busy="true" />;
  if (!onboarded) return <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-stone-50 to-amber-50/40"><Onboarding /></div>;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-stone-50 to-amber-50/40">
      <main className="mx-auto max-w-md px-4 pb-28 pt-6">
        {route === 'hoy' && <Hoy onChangeStartDate={() => go('ajustes', 'fecha')} />}
        <ErrorBoundary key={route}>
        {route === 'semana' && (
          <Semana key={param ?? 'actual'} initialWeek={param ? Number(param) : undefined} onShoppingList={(week) => go('compras', week)} />
        )}
        {route === 'compras' && <ListaCompras key={param ?? 'actual'} initialWeek={param ? Number(param) : undefined} />}
        {route === 'mas' && <Mas go={go} />}
        {route === 'exclusiones' && <Exclusiones onBack={() => go('mas')} />}
        {route === 'mapa' && <Mapa onBack={() => go('mas')} onOpenWeek={(w) => go('semana', w)} />}
        {route === 'alimentos' && <Alimentos onBack={() => go('mas')} />}
        {route === 'ajustes' && <Ajustes focus={param} onBack={() => go('mas')} onExclusions={() => go('exclusiones')} />}
        {(route === 'registro' || route === 'progreso') && (
          <div className="space-y-4">
            <div role="tablist" aria-label="Registro" className="grid grid-cols-2 rounded-xl bg-emerald-100 p-1">
              {(['registro', 'progreso'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={route === r}
                  onClick={() => go(r)}
                  className={cx(
                    'min-h-10 rounded-lg text-sm font-semibold',
                    route === r ? 'bg-emerald-700 text-white shadow-sm' : 'text-emerald-900',
                  )}
                >
                  {r === 'registro' ? 'Día' : 'Progreso'}
                </button>
              ))}
            </div>
            {route === 'registro' ? <Registro /> : <Progreso />}
          </div>
        )}
        </ErrorBoundary>
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => go(t.id)}
                aria-current={tabOf(route) === t.id ? 'page' : undefined}
                className={cx(
                  'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium',
                  tabOf(route) === t.id ? 'font-semibold text-emerald-800' : 'text-stone-500',
                )}
              >
                <span
                  aria-hidden
                  className={cx('rounded-full px-3 py-0.5 text-lg leading-none', tabOf(route) === t.id && 'bg-emerald-100')}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
