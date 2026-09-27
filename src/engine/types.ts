// Tipos del dominio. Las cantidades base de Meal corresponden a 60 kg de peso ideal.

export type FoodId = string;
export type MealId = string;

export interface Food {
  id: FoodId;
  unit: string;          // "huevo", "g de ribeye (cocido)", "cda de mantequilla"
  unitPlural?: string | null;
  protein: number;       // gramos por unidad
  fat: number;
  carbs: number;         // carbohidratos TOTALES
  roundStep: number;     // 1 = enteros, 5 = de 5 en 5 g, 0.5 = medias cucharadas
  scalable: boolean;     // verduras/condimentos/crema del café = false
}

export interface MealItem { food: FoodId; qty: number }
export interface Meal { id: MealId; name: string; items: MealItem[] }

export interface Slot { label: string; time: string; meal: MealId }
export interface DayPlan { day: 'Lun'|'Mar'|'Mié'|'Jue'|'Vie'|'Sáb'|'Dom'; slots: Slot[] }

export type Phase = 'Principiante' | 'Metabolismo base' | 'Estresar el metabolismo';

export interface ProgramWeek {
  week: number;                       // 1–14
  step: string;                       // "2", "2 → 3", "6 → 7"
  title: string;
  phase: Phase;
  schedule: string;
  proteinGPerKg: { min: number; max: number };
  goal: string;
  rules: string[];
  measure: string;
  advanceWhen: string;
  days: DayPlan[];                    // siempre 7
}

export interface ContinuumStep {
  step: number;                       // 1–12
  phase: Phase;
  title: string;
  notes: string | null;
  minDuration: string | null;
}

export type IdealWeightSource = 'bmi22' | 'devine' | 'robinson' | 'manual';

export interface Profile {
  sex: 'F' | 'M';
  heightCm: number;
  currentWeightKg: number;
  idealWeightKg: number;
  idealWeightSource: IdealWeightSource;
  startDate: string;                  // ISO yyyy-mm-dd
  wakeTime: string;                   // "06:30"
  sunriseTime: string;                // "06:10"
  onBpMeds: boolean;
  onGlucoseMeds: boolean;
  units: { weight: 'kg' | 'lb'; glucose: 'mg/dL' | 'mmol/L' };
}

export interface Macros { protein: number; fat: number; carbs: number }

export interface ScaledItem { food: FoodId; qty: number; text: string; macros: Macros }
export interface ScaledMeal { id: MealId; name: string; items: ScaledItem[]; macros: Macros }
export interface ScaledSlot extends Omit<Slot, 'meal'> { meal: ScaledMeal }
export interface ScaledDay { day: DayPlan['day']; slots: ScaledSlot[]; totals: Macros }

export interface DailyLog {
  date: string;
  urineKetone?: 0 | 1 | 2 | 3 | 4;    // 0 negativo … 4 morado oscuro
  bloodGlucose?: number;              // siempre en mg/dL (se convierte al mostrar)
  bloodKetoneMmol?: number;
  weightKg?: number;
  hunger?: 1 | 2 | 3 | 4 | 5;
  missedMealByAccident?: boolean;
  mealsEaten: MealId[];
  fastStartedAt?: string;
  medicalWarningAcknowledged?: boolean;
  followedWeekRule?: boolean;         // cumplió la regla de la semana (16:8, 2 comidas…)
  carbsUnder20?: boolean;             // si falta, se asume cumplido cuando hay comidas registradas
  notes?: string;
}

export interface ProgressState {
  currentWeek: number;
  weekStartedAt: string;
  history: { week: number; startedAt: string; endedAt?: string; repeated: boolean }[];
}

export type DrBozZone = 'alta-insulina' | 'perdida-peso' | 'autofagia' | 'terapeutico';

// ---------------------------------------------------------------- sustituciones
export type Allergen = 'huevo' | 'lacteos' | 'pescado' | 'mariscos' | 'cerdo' | 'mostaza' | 'coco';
export type Aisle = 'Carnes' | 'Cerdo y embutidos' | 'Aves' | 'Pescados y mariscos' | 'Huevos y lácteos' | 'Verduras' | 'Despensa';

export interface Purchase {
  perUnit: number;        // cantidad en packUnit que representa 1 unidad del plan
  rawFactor: number;      // cocido/comestible → peso de compra
  pack?: number;          // tamaño del paquete en packUnit
  packUnit: 'g' | 'ml' | 'unid';
  packLabel?: string;     // "docena", "frasco de 400 g"
  buyAs?: FoodId;         // se compra como otro alimento (yema → huevo)
  shopName: string;       // nombre en la lista
  note?: string;
}
// foods.json incluye además: allergens: Allergen[]; category: Aisle; purchase: Purchase
export interface FoodFull extends Food { allergens: Allergen[]; category: Aisle; purchase: Purchase }

export interface SubstitutionGroup {
  id: string;
  label: string;
  matchBy: 'protein' | 'fat' | 'carbs';
  fatTopUp?: boolean;
  fallback?: boolean;             // solo si no queda ningún candidato en los grupos propios
  members: FoodId[];              // en orden de preferencia
  extraCandidates?: FoodId[];     // pueden reemplazar a los miembros, pero no al revés
}

export type ExclusionReason = 'alergia' | 'no-me-gusta' | 'no-disponible';
export interface Exclusion { type: 'food' | 'allergen'; id: FoodId | Allergen; reason: ExclusionReason; until?: string }

export type SubFlag = 'magro' | 'grasa-añadida' | 'excede-carbohidratos';
export interface SubstitutionOption {
  food: FoodId;
  items: MealItem[];              // sustituto + grasa añadida si aplica
  group: string;
  macros: Macros;
  delta: Macros;                  // sustituto − original
  flags: SubFlag[];
  score: number;
}

export type OverrideScope = 'comida' | 'semana';
export interface Override {
  scope: OverrideScope;
  week: number;
  day?: DayPlan['day'];           // obligatorio si scope = 'comida'
  slotIndex?: number;
  food: FoodId;                   // ingrediente original
  originalQty?: number;           // cantidad original; con scope 'semana' el reemplazo se ajusta en proporción
  replacement: MealItem[];
}

// ---------------------------------------------------------------- lista de compras
export interface PantryItem { week?: number; food: FoodId; amount: number }   // en packUnit; week = semana de la lista
export interface ShoppingLine {
  food: FoodId; category: Aisle; name: string;
  need: number; unit: 'g' | 'ml' | 'unid';
  packs: number | null; packLabel: string | null; note: string | null;
  trip?: 1 | 2;                   // si se divide en 2 compras
}
export interface ShoppingList { week: number; idealWeightKg: number; lines: ShoppingLine[]; staples: string[] }
/** Casilla marcada. `food` es el alimento de compra o el texto de un básico. */
export interface ShoppingCheck { week: number; food: FoodId; trip?: 1 | 2; checked: boolean }

// ---------------------------------------------------------------- plan
/** Lo que el motor necesita del perfil para escalar y sustituir. */
export interface PlanProfile { idealWeightKg: number; exclusions: Exclusion[] }

/** Cambio de una comida completa por otra de la misma categoría. */
export interface MealSwap { week: number; day: DayPlan['day']; slotIndex: number; meal: MealId }

export interface SubstitutionChange {
  original: MealItem;
  replacement: MealItem[] | null;     // null = no hubo sustituto que cupiera en 20 g
  warning?: string;
}

export interface PlannedItem extends ScaledItem {
  replaces?: FoodId;                  // ingrediente original si fue cambiado
  changeReason?: 'manual' | 'exclusion';
}
export interface PlannedSlot extends Omit<Slot, 'meal'> {
  slotIndex: number;
  mealId: MealId;
  mealName: string;
  items: PlannedItem[];
  macros: Macros;
}
export interface PlannedDay {
  week: number;
  dayIndex: number;                   // 0–6
  day: DayPlan['day'];
  slots: PlannedSlot[];
  totals: Macros;
  changes: (SubstitutionChange & { slotIndex: number; reason: 'manual' | 'exclusion' })[];
}
