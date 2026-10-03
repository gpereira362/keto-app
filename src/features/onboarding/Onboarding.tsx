// Onboarding en 4 pasos: cuerpo → peso ideal → alergias y lo que no come → inicio y horario.
import { useState } from 'react';
import { FoodPicker } from '../../components/FoodPicker';
import { Button, Card, Chip, Field, cx, inputClass } from '../../components/ui';
import { MedicalWarning } from '../../components/MedicalWarning';
import { idealWeight, proteinTargets, validateIdealWeight } from '../../engine/body';
import { ALLERGENS, foodsWithAllergen, isExcluded } from '../../engine/substitutions';
import type { Allergen, Exclusion, FoodId, IdealWeightSource, Profile } from '../../engine/types';
import { localDate } from '../../lib/date';
import { ALLERGEN_LABELS, foodName, kg, sameNameFoods } from '../../lib/labels';
import { useApp } from '../../store/useApp';

const METHODS: { id: Exclude<IdealWeightSource, 'manual'>; label: string; hint: string }[] = [
  { id: 'bmi22', label: 'IMC 22', hint: 'Recomendado' },
  { id: 'devine', label: 'Devine', hint: 'Fórmula clínica' },
  { id: 'robinson', label: 'Robinson', hint: 'Fórmula clínica' },
];

const STEPS = ['Tu cuerpo', 'Tu peso ideal', 'Alergias y lo que no comes', 'Inicio y horario'];

export function Onboarding() {
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);

  const [sex, setSex] = useState<Profile['sex']>('F');
  const [heightCm, setHeightCm] = useState('165');
  const [currentKg, setCurrentKg] = useState('');
  const [source, setSource] = useState<IdealWeightSource>('bmi22');
  const [manualKg, setManualKg] = useState('');
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [dislikes, setDislikes] = useState<FoodId[]>([]);
  const [startDate, setStartDate] = useState(localDate());
  const [wakeTime, setWakeTime] = useState('06:30');
  const [sunriseTime, setSunriseTime] = useState('06:30');
  const [onBpMeds, setOnBpMeds] = useState(false);
  const [onGlucoseMeds, setOnGlucoseMeds] = useState(false);

  const height = Number(heightCm);
  const heightOk = height >= 120 && height <= 220;
  const currentOk = Number(currentKg) >= 30 && Number(currentKg) <= 350;
  const computed = heightOk ? idealWeight(source === 'manual' ? 'bmi22' : source, height, sex) : NaN;
  const idealKg = source === 'manual' ? Number(manualKg.replace(',', '.')) : computed;
  const idealError = validateIdealWeight(idealKg);

  const allergyExclusions: Exclusion[] = allergens.map((a) => ({ type: 'allergen', id: a, reason: 'alergia' }));
  const exclusions: Exclusion[] = [
    ...allergyExclusions,
    ...dislikes.map((id): Exclusion => ({ type: 'food', id, reason: 'no-me-gusta' })),
  ];


  const canNext = [heightOk && currentOk, !idealError, true, !!startDate && !!wakeTime && !!sunriseTime][step];

  function finish() {
    completeOnboarding(
      {
        sex, heightCm: height, currentWeightKg: Number(currentKg), idealWeightKg: idealKg, idealWeightSource: source,
        startDate, wakeTime, sunriseTime, onBpMeds, onGlucoseMeds, units: { weight: 'kg', glucose: 'mg/dL' },
      },
      exclusions,
    );
  }

  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-6 pt-8">
      <header>
        <p className="text-sm font-medium text-emerald-800">Método Renacer · paso {step + 1} de 4</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">{STEPS[step]}</h1>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= step ? 'bg-emerald-700' : 'bg-stone-200')} />
          ))}
        </div>
      </header>

      <main className="mt-6 flex-1 space-y-4">
        {step === 0 && (
          <Card className="space-y-4">
            <div>
              <span className="text-sm font-medium text-stone-700">Sexo</span>
              <div className="mt-1 flex gap-2">
                <Chip selected={sex === 'F'} onClick={() => setSex('F')}>Mujer</Chip>
                <Chip selected={sex === 'M'} onClick={() => setSex('M')}>Hombre</Chip>
              </div>
            </div>
            <Field label="Estatura (cm)" hint={heightCm && !heightOk ? 'Entre 120 y 220 cm.' : undefined}>
              <input className={inputClass} inputMode="decimal" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
            </Field>
            <Field label="Peso actual (kg)" hint="Solo para seguir tu progreso. El plan usa tu peso ideal.">
              <input className={inputClass} inputMode="decimal" value={currentKg} onChange={(e) => setCurrentKg(e.target.value)} autoFocus />
            </Field>
          </Card>
        )}

        {step === 1 && (
          <>
            <Card className="space-y-3">
              <p className="text-sm text-stone-600">Las porciones y la proteína se calculan sobre tu peso ideal, no sobre tu peso actual.</p>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={source === m.id}
                    onClick={() => setSource(m.id)}
                    className={cx(
                      'rounded-xl p-3 text-left ring-1 transition',
                      source === m.id ? 'bg-emerald-50 ring-2 ring-emerald-700' : 'bg-white ring-stone-300',
                    )}
                  >
                    <span className="block text-xs text-stone-500">{m.label}</span>
                    <span className="block text-xl font-bold tabular-nums text-stone-900">{kg(idealWeight(m.id, height, sex))}</span>
                    <span className="block text-[11px] text-stone-500">{m.hint}</span>
                  </button>
                ))}
              </div>
              <Chip selected={source === 'manual'} onClick={() => setSource('manual')}>Ya sé mi peso ideal</Chip>
              {source === 'manual' && (
                <Field label="Mi peso ideal (kg)" hint={manualKg ? (idealError ?? undefined) : 'Entre 35 y 150 kg.'}>
                  <input className={inputClass} inputMode="decimal" value={manualKg} onChange={(e) => setManualKg(e.target.value)} autoFocus />
                </Field>
              )}
            </Card>
            {!idealError && (
              <Card>
                <p className="text-sm text-stone-600">Tu proteína diaria</p>
                <p className="text-lg font-semibold text-stone-900">
                  {Math.round(proteinTargets(idealKg, 1).weekMin)}–{Math.round(proteinTargets(idealKg, 1).weekMax)} g
                </p>
                <p className="text-xs text-stone-500">1,0–1,3 g por kg de peso ideal en las semanas 1–9. Carbohidratos: máximo 20 g al día.</p>
              </Card>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Card className="space-y-3">
              <h2 className="font-semibold text-stone-900">Alergias</h2>
              <p className="text-sm text-stone-600">Estos alimentos no aparecerán en ningún lugar: plan, cambios ni lista de compras.</p>
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map((a) => (
                  <Chip key={a} selected={allergens.includes(a)} onClick={() => setAllergens(toggle(allergens, a))}>
                    {ALLERGEN_LABELS[a]}
                  </Chip>
                ))}
              </div>
              {allergens.map((a) => (
                <p key={a} className="text-xs text-stone-500">
                  <span className="font-medium text-stone-700">{ALLERGEN_LABELS[a]}:</span>{' '}
                  {[...new Set(foodsWithAllergen(a).map(foodName))].join(', ')}
                </p>
              ))}
            </Card>
            <Card className="space-y-3">
              <h2 className="font-semibold text-stone-900">No me gusta</h2>
              <p className="text-sm text-stone-600">Se cambian solos por una opción equivalente.</p>
              <FoodPicker
                hidden={(id) => dislikes.includes(id) || isExcluded(id, allergyExclusions)}
                onPick={(ids) => setDislikes([...dislikes, ...ids])}
              />
              {dislikes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dislikes.filter((id, i) => dislikes.findIndex((d) => foodName(d) === foodName(id)) === i).map((id) => (
                    <Chip key={id} selected onClick={() => setDislikes(dislikes.filter((d) => !sameNameFoods(id).includes(d)))}>
                      {foodName(id)} ✕
                    </Chip>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {step === 3 && (
          <>
            <Card className="space-y-4">
              <Field label="Fecha de inicio">
                <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Me despierto">
                  <input type="time" className={inputClass} value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} />
                </Field>
                <Field label="Amanece">
                  <input type="time" className={inputClass} value={sunriseTime} onChange={(e) => setSunriseTime(e.target.value)} />
                </Field>
              </div>
              <p className="text-xs text-stone-500">Desde la semana 11 la comida termina dentro de las 11 horas después del amanecer.</p>
            </Card>
            <Card className="space-y-3">
              <h2 className="font-semibold text-stone-900">Medicamentos</h2>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-emerald-700" checked={onBpMeds} onChange={(e) => setOnBpMeds(e.target.checked)} />
                Tomo medicamentos para la presión
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-emerald-700" checked={onGlucoseMeds} onChange={(e) => setOnGlucoseMeds(e.target.checked)} />
                Tomo medicamentos para la glucosa o diabetes
              </label>
            </Card>
            {(onBpMeds || onGlucoseMeds) && <MedicalWarning />}
          </>
        )}
      </main>

      <footer className="mt-6 flex gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>Atrás</Button>
        )}
        {step < 3 ? (
          <Button className="flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>Siguiente</Button>
        ) : (
          <Button className="flex-1" disabled={!canNext} onClick={finish}>Empezar</Button>
        )}
      </footer>
    </div>
  );
}
