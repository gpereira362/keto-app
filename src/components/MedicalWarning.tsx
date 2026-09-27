import { MEDICAL_WARNING } from '../engine/plan';

export function MedicalWarning({ className }: { className?: string }) {
  return (
    <div role="alert" className={`rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-300 ${className ?? ''}`}>
      <p className="font-semibold">Advertencia médica</p>
      <p className="mt-1">{MEDICAL_WARNING}</p>
    </div>
  );
}
