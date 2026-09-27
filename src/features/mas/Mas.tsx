// Menú "Más": accesos a las pantallas secundarias.
import { Card } from '../../components/ui';
import { activeExclusions } from '../../engine/substitutions';
import { localDate } from '../../lib/date';
import { useApp } from '../../store/useApp';

export type MasRoute = 'mapa' | 'alimentos' | 'exclusiones' | 'ajustes';

export function Mas({ go }: { go: (route: MasRoute) => void }) {
  const count = useApp((s) => activeExclusions(s.exclusions, localDate()).length + s.overrides.length);
  const items: { route: MasRoute; title: string; detail: string; badge?: string }[] = [
    { route: 'mapa', title: 'Mapa', detail: 'Los 12 pasos y las 14 semanas: dónde estás' },
    { route: 'alimentos', title: 'Alimentos', detail: 'Catálogo con macros, alérgenos y comidas' },
    { route: 'exclusiones', title: 'Mis exclusiones', detail: 'Alergias, lo que no te gusta y lo que no encuentras', badge: count ? String(count) : undefined },
    { route: 'ajustes', title: 'Ajustes', detail: 'Perfil, unidades, paquetes, respaldo y aviso médico' },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-stone-900">Más</h1>
      <Card flush>
        <ul className="divide-y divide-stone-100">
          {items.map((i) => (
            <li key={i.route}>
              <button
                type="button"
                onClick={() => go(i.route)}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50"
              >
                <span>
                  <span className="block font-medium text-stone-900">{i.title}</span>
                  <span className="block text-sm text-stone-500">{i.detail}</span>
                </span>
                <span className="shrink-0 text-sm text-stone-500">{i.badge} ›</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
