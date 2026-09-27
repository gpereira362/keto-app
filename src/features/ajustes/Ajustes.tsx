// Ajustes: perfil, unidades, tamaños de paquete locales, respaldo JSON, borrar datos y aviso médico.
import { useRef, useState } from 'react';
import { MedicalWarning } from '../../components/MedicalWarning';
import { Button, Card, Chip, Field, inputClass } from '../../components/ui';
import { idealWeight, validateIdealWeight } from '../../engine/body';
import { FOOD_LIST } from '../../engine/data';
import type { FoodId, IdealWeightSource, Profile } from '../../engine/types';
import { longDate } from '../../lib/date';
import { fmt, parseNumber, weightFromInput, weightToDisplay } from '../../lib/units';
import { backupFileName, makeBackup, readBackup } from '../../store/backup';
import { useApp, type AppData } from '../../store/useApp';

/** Alimentos que se compran por paquete (sin los que se compran como otro). */
const PACKAGED = FOOD_LIST.filter((f) => f.purchase.pack && !f.purchase.buyAs)
  .sort((a, b) => a.purchase.shopName.localeCompare(b.purchase.shopName, 'es'));

const METHOD_LABELS: Record<IdealWeightSource, string> = {
  bmi22: 'IMC 22', devine: 'Devine', robinson: 'Robinson', manual: 'Mi valor',
};

export function Ajustes({ onBack, onExclusions }: { onBack: () => void; onExclusions: () => void }) {
  const state = useApp();
  const { profile, settings } = state;
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [showPacks, setShowPacks] = useState(false);
  if (!profile) return null;
  const units = profile.units;
  const set = (patch: Partial<Profile>) => state.updateProfile(patch);

  /** Si el peso ideal sale de una fórmula, se recalcula al cambiar estatura o sexo. */
  function setBody(patch: Pick<Partial<Profile>, 'heightCm' | 'sex'>) {
    const next = { ...profile!, ...patch };
    const src = next.idealWeightSource;
    set(src === 'manual' ? patch : { ...patch, idealWeightKg: idealWeight(src, next.heightCm, next.sex) });
  }

  function setSource(source: IdealWeightSource) {
    if (source === 'manual') return set({ idealWeightSource: 'manual' });
    set({ idealWeightSource: source, idealWeightKg: idealWeight(source, profile!.heightCm, profile!.sex) });
  }

  function exportData() {
    const { profile: p, exclusions, overrides, mealSwaps, pantry, shoppingChecks, logs, progress, settings: st } = useApp.getState();
    const data: AppData = { profile: p, exclusions, overrides, mealSwaps, pantry, shoppingChecks, logs, progress, settings: st };
    const blob = new Blob([JSON.stringify(makeBackup(data), null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ tone: 'ok', text: `Respaldo descargado: ${backupFileName()}` });
  }

  async function importData(file: File) {
    const result = readBackup(await file.text());
    if ('error' in result) return setMessage({ tone: 'error', text: result.error });
    if (!window.confirm('¿Reemplazar todos tus datos por los del respaldo? No se puede deshacer.')) return;
    state.replaceAll(result.data);
    setMessage({ tone: 'ok', text: 'Datos importados.' });
  }

  function deleteAll() {
    if (!window.confirm('¿Borrar todos tus datos de este dispositivo? Descarga antes un respaldo si quieres conservarlos.')) return;
    if (!window.confirm('Última confirmación: se borrará tu perfil, registros y listas.')) return;
    state.reset();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" onClick={onBack} aria-label="Volver">‹</Button>
        <h1 className="text-2xl font-bold text-stone-900">Ajustes</h1>
      </header>

      <Card className="space-y-4">
        <h2 className="font-semibold text-stone-900">Perfil</h2>
        <div className="flex gap-2">
          <Chip selected={profile.sex === 'F'} onClick={() => setBody({ sex: 'F' })}>Mujer</Chip>
          <Chip selected={profile.sex === 'M'} onClick={() => setBody({ sex: 'M' })}>Hombre</Chip>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Estatura (cm)" value={profile.heightCm} min={120} max={220} onCommit={(n) => setBody({ heightCm: n })} />
          <NumField
            key={units.weight}
            label={`Peso inicial (${units.weight})`}
            value={weightToDisplay(profile.currentWeightKg, units.weight)}
            min={1}
            max={800}
            onCommit={(n) => set({ currentWeightKg: weightFromInput(n, units.weight) })}
          />
        </div>
        <div>
          <span className="text-sm font-medium text-stone-700">Peso ideal</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {(['bmi22', 'devine', 'robinson', 'manual'] as IdealWeightSource[]).map((s) => (
              <Chip key={s} selected={profile.idealWeightSource === s} onClick={() => setSource(s)}>
                {METHOD_LABELS[s]}{s !== 'manual' && ` · ${fmt(idealWeight(s, profile.heightCm, profile.sex))} kg`}
              </Chip>
            ))}
          </div>
          {profile.idealWeightSource === 'manual' ? (
            <div className="mt-2">
              <NumField label="Mi peso ideal (kg)" value={profile.idealWeightKg} min={35} max={150} onCommit={(n) => set({ idealWeightKg: n })} />
            </div>
          ) : (
            <p className="mt-1 text-xs text-stone-500">Plan calculado para {fmt(profile.idealWeightKg)} kg de peso ideal.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Me despierto">
            <input type="time" className={inputClass} value={profile.wakeTime} onChange={(e) => e.target.value && set({ wakeTime: e.target.value })} />
          </Field>
          <Field label="Amanece">
            <input type="time" className={inputClass} value={profile.sunriseTime} onChange={(e) => e.target.value && set({ sunriseTime: e.target.value })} />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-emerald-700" checked={profile.onBpMeds} onChange={(e) => set({ onBpMeds: e.target.checked })} />
          Tomo medicamentos para la presión
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-emerald-700" checked={profile.onGlucoseMeds} onChange={(e) => set({ onGlucoseMeds: e.target.checked })} />
          Tomo medicamentos para la glucosa o diabetes
        </label>
      </Card>

      <StartDateCard
        startDate={profile.startDate}
        onChange={(d) => { state.setStartDate(d); setMessage({ tone: 'ok', text: `Nueva fecha de inicio: ${longDate(d)}. Vuelves a la semana 1.` }); }}
      />

      <Card className="space-y-3">
        <h2 className="font-semibold text-stone-900">Unidades</h2>
        <div className="flex flex-wrap gap-2">
          <Chip selected={units.weight === 'kg'} onClick={() => set({ units: { ...units, weight: 'kg' } })}>kg</Chip>
          <Chip selected={units.weight === 'lb'} onClick={() => set({ units: { ...units, weight: 'lb' } })}>lb</Chip>
          <span className="w-2" />
          <Chip selected={units.glucose === 'mg/dL'} onClick={() => set({ units: { ...units, glucose: 'mg/dL' } })}>mg/dL</Chip>
          <Chip selected={units.glucose === 'mmol/L'} onClick={() => set({ units: { ...units, glucose: 'mmol/L' } })}>mmol/L</Chip>
        </div>
        <p className="text-xs text-stone-500">Tus registros se convierten solos; no se pierde nada al cambiar.</p>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-stone-900">Tamaños de paquete</h2>
          <Button variant="ghost" onClick={() => setShowPacks(!showPacks)} aria-expanded={showPacks}>{showPacks ? 'Ocultar' : 'Editar'}</Button>
        </div>
        <p className="text-xs text-stone-500">Ajusta los paquetes a los de tu tienda (por ejemplo, mantequilla de 200 g). La lista de compras los usa.</p>
        {showPacks && (
          <ul className="divide-y divide-stone-100">
            {PACKAGED.map((f) => (
              <PackRow
                key={f.id}
                id={f.id}
                name={f.purchase.shopName}
                unit={f.purchase.packUnit === 'unid' ? 'unid.' : f.purchase.packUnit}
                standard={f.purchase.pack!}
                value={settings.packSizes[f.id]}
                onChange={(n) => {
                  const next = { ...settings.packSizes };
                  if (n === undefined || n === f.purchase.pack) delete next[f.id];
                  else next[f.id] = n;
                  state.setSettings({ packSizes: next });
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card flush>
        <button type="button" onClick={onExclusions} className="flex min-h-14 w-full items-center justify-between px-4 py-3 text-left hover:bg-stone-50">
          <span className="font-medium text-stone-900">Mis exclusiones</span>
          <span className="text-stone-500">›</span>
        </button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-stone-900">Tus datos</h2>
        <p className="text-sm text-stone-600">Todo se guarda solo en este dispositivo. Descarga un respaldo para pasarlo a otro teléfono.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportData}>Exportar (JSON)</Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>Importar</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Archivo de respaldo"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importData(f); e.target.value = ''; }}
          />
        </div>
        {message && (
          <p role={message.tone === 'error' ? 'alert' : 'status'} className={message.tone === 'error' ? 'text-sm text-red-800' : 'text-sm text-emerald-800'}>
            {message.text}
          </p>
        )}
        <Button variant="danger" onClick={deleteAll}>Borrar todos mis datos</Button>
      </Card>

      <MedicalWarning />
      <p className="px-1 text-center text-xs text-stone-400">
        Uso educativo. Basado en el Keto Continuum de Dr. Boz (Annette Bosworth, MD). Macros aproximados (USDA).
      </p>
    </div>
  );
}

function StartDateCard({ startDate, onChange }: { startDate: string; onChange: (date: string) => void }) {
  const [date, setDate] = useState(startDate);
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold text-stone-900">Fecha de inicio</h2>
      <p className="text-sm text-stone-600">El día 1 del programa es <span className="font-medium">{longDate(startDate)}</span>.</p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label="Nueva fecha de inicio">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Button
          variant="secondary"
          disabled={!date || date === startDate}
          onClick={() => {
            if (window.confirm(`¿Empezar el programa el ${longDate(date)}? Vuelves a la semana 1 desde esa fecha. Tus registros se conservan.`)) onChange(date);
          }}
        >
          Cambiar
        </Button>
      </div>
    </Card>
  );
}

function NumField({ label, value, min, max, onCommit }: {
  label: string; value: number; min: number; max: number; onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(fmt(value));
  const n = parseNumber(text);
  const invalid = n === undefined || n < min || n > max;
  const idealError = label.startsWith('Mi peso ideal') && n !== undefined ? validateIdealWeight(n) : null;
  return (
    <Field label={label} hint={invalid ? `Entre ${min} y ${max}.` : (idealError ?? undefined)}>
      <input
        className={inputClass}
        inputMode="decimal"
        value={text}
        aria-invalid={invalid}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => (invalid ? setText(fmt(value)) : n !== value && onCommit(n!))}
      />
    </Field>
  );
}

function PackRow({ id, name, unit, standard, value, onChange }: {
  id: FoodId; name: string; unit: string; standard: number; value?: number; onChange: (n: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : fmt(value));
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <label htmlFor={`pack-${id}`} className="min-w-0 text-sm text-stone-800">
        {name} <span className="block text-xs text-stone-500">normal: {fmt(standard)} {unit}</span>
      </label>
      <div className="flex items-center gap-1">
        <input
          id={`pack-${id}`}
          className={`${inputClass} w-24 text-right`}
          inputMode="decimal"
          placeholder={fmt(standard)}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const n = parseNumber(text);
            if (n !== undefined && n > 0) onChange(n);
            else { setText(''); onChange(undefined); }
          }}
        />
        <span className="w-10 text-xs text-stone-500">{unit}</span>
      </div>
    </li>
  );
}
