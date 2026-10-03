// Progreso: peso, glucosa en ayunas y índice glucosa-cetonas en el tiempo; racha de días que cumplen la regla.
import { LineChart } from '../../components/LineChart';
import { Card } from '../../components/ui';
import { programWeek } from '../../engine/data';
import {
  ZONE_LABELS, indexZone, glucoseSeries, ratioSeries, ruleStreak, waistSeries, weightSeries,
} from '../../engine/progress';
import { localDate, shortDate } from '../../lib/date';
import { fmt, glucoseToDisplay, weightToDisplay } from '../../lib/units';
import { useApp } from '../../store/useApp';

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
      {detail && <p className="text-xs text-stone-600">{detail}</p>}
    </div>
  );
}

export function Progreso() {
  const { profile, progress, logs } = useApp();
  if (!profile || !progress) return null;
  const { units } = profile;

  const weight = weightSeries(logs).map((p) => ({ ...p, value: weightToDisplay(p.value, units.weight) }));
  const waist = waistSeries(logs);
  const glucose = glucoseSeries(logs).map((p) => ({ ...p, value: glucoseToDisplay(p.value, units.glucose) }));
  const ratio = ratioSeries(logs).map((p) => ({ ...p, value: Math.round(p.value) }));
  const streak = ruleStreak(logs, localDate());

  const lastW = weight.at(-1);
  const startW = weightToDisplay(profile.currentWeightKg, units.weight);
  const deltaW = lastW ? Math.round((lastW.value - startW) * 10) / 10 : null;
  const lastR = ratio.at(-1);

  const change = (a: number, b: number, u: string) =>
    a === b ? `Sin cambio: ${fmt(a)} ${u}` : `De ${fmt(a)} a ${fmt(b)} ${u}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Peso"
          value={lastW ? `${fmt(lastW.value)} ${units.weight}` : '—'}
          detail={deltaW === null ? `Inicio: ${fmt(startW)} ${units.weight}` : `${deltaW > 0 ? '+' : deltaW < 0 ? '−' : ''}${fmt(Math.abs(deltaW))} ${units.weight} desde el inicio`}
        />
        <Tile label="Racha" value={`${streak} ${streak === 1 ? 'día' : 'días'}`} detail="cumpliendo la regla de la semana" />
        {progress.vivir
          ? <Tile label="Fase" value="5 · Vivir" detail={`${progress.vivir.level} g de carbohidratos al día`} />
          : <Tile label="Semana" value={`${progress.currentWeek} de 14`} detail={programWeek(progress.currentWeek).title} />}
        <Tile
          label="Último índice glucosa-cetonas"
          value={lastR ? String(lastR.value) : '—'}
          detail={lastR ? `${ZONE_LABELS[indexZone(lastR.value)]} · ${shortDate(lastR.date)}` : 'Glucosa ÷ cetonas'}
        />
      </div>

      <LineChart
        title={`Peso (${units.weight})`}
        points={weight}
        unit={units.weight}
        format={fmt}
        describe={weight.length > 1 ? change(weight[0].value, weight.at(-1)!.value, units.weight) + '.' : undefined}
      />
      <LineChart
        title="Cintura (cm)"
        points={waist}
        unit="cm"
        format={fmt}
        describe={waist.length > 1 ? change(waist[0].value, waist.at(-1)!.value, 'cm') + '.' : undefined}
      />
      <LineChart
        title={`Glucosa en ayunas (${units.glucose})`}
        points={glucose}
        unit={units.glucose}
        format={fmt}
        describe={glucose.length > 1 ? change(glucose[0].value, glucose.at(-1)!.value, units.glucose) + '.' : undefined}
      />
      <LineChart
        title="Índice glucosa-cetonas"
        points={ratio}
        unit=""
        format={(v) => String(Math.round(v))}
        refLines={[
          { value: 80, label: '< 80 pérdida de peso' },
          { value: 40, label: '< 40 autofagia' },
          { value: 20, label: '< 20 terapéutico' },
        ]}
        describe={lastR ? `Último valor ${lastR.value}, zona ${ZONE_LABELS[indexZone(lastR.value)].toLowerCase()}.` : undefined}
      />

      <Card>
        <h3 className="font-semibold text-stone-900">Tus semanas</h3>
        <ol className="mt-2 space-y-1 text-sm">
          {[...progress.history].reverse().map((h, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="text-stone-800">Semana {h.week}{h.repeated && ' (repetida)'}</span>
              <span className="tabular-nums text-stone-500">
                {shortDate(h.startedAt)}{h.endedAt ? ` – ${shortDate(h.endedAt)}` : ' – hoy'}
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
