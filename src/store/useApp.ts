// Estado de la app (Zustand), persistido en IndexedDB.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { applyChange, type ChangeChoice, type ChangeState } from '../engine/changes';
import { swapMeal } from '../engine/plan';
import { advanceWeek, repeatWeek, startProgress } from '../engine/progress';
import { activeExclusions } from '../engine/substitutions';
import type {
  DailyLog, Exclusion, FoodId, MealId, MealSwap, Override, PantryItem, PlanProfile, Profile, ProgressState, ShoppingCheck,
} from '../engine/types';
import { dexieStorage } from './db';

export interface AppData {
  profile: Profile | null;
  exclusions: Exclusion[];
  overrides: Override[];
  mealSwaps: MealSwap[];
  pantry: PantryItem[];
  shoppingChecks: ShoppingCheck[];
  logs: DailyLog[];
  progress: ProgressState | null;
  settings: Settings;
}

export interface Settings {
  /** Lista de compras dividida en 2 (días 1–3 y 4–7). */
  shoppingSplit: boolean;
  /** Tamaños de paquete locales: alimento de compra → tamaño en su unidad. */
  packSizes: Record<FoodId, number>;
}

export interface AppActions {
  completeOnboarding(profile: Profile, exclusions: Exclusion[]): void;
  toggleMealEaten(date: string, mealId: MealId): void;
  updateLog(date: string, patch: Partial<DailyLog>): void;
  /** Regla 6: el ayuno solo se marca iniciado si la advertencia médica fue confirmada. */
  startFast(date: string, nowIso: string, warningAcknowledged: boolean): void;
  /** Aplica un cambio de ingrediente. Devuelve el estado anterior para "Deshacer". */
  applyChange(choice: ChangeChoice): ChangeState;
  restoreChanges(prev: ChangeState): void;
  setExclusions(exclusions: Exclusion[]): void;
  removeOverride(o: Override): void;
  toggleShoppingCheck(week: number, food: FoodId, trip?: 1 | 2): void;
  /** Lo que ya hay en casa para la lista de esa semana. 0 lo quita. */
  setPantry(week: number, food: FoodId, amount: number): void;
  setSettings(patch: Partial<Settings>): void;
  updateProfile(patch: Partial<Profile>): void;
  /** Cambia una comida completa (misma categoría). Devuelve los cambios anteriores para "Deshacer". */
  swapMeal(swap: MealSwap): MealSwap[];
  restoreMealSwaps(prev: MealSwap[]): void;
  /** Importar un respaldo: reemplaza todos los datos. */
  replaceAll(data: AppData): void;
  advance(today: string): void;
  repeat(today: string): void;
  reset(): void;
}

export const EMPTY: AppData = {
  profile: null,
  exclusions: [],
  overrides: [],
  mealSwaps: [],
  pantry: [],
  shoppingChecks: [],
  logs: [],
  progress: null,
  settings: { shoppingSplit: false, packSizes: {} },
};

function upsertLog(logs: DailyLog[], date: string, patch: (l: DailyLog) => DailyLog): DailyLog[] {
  const existing = logs.find((l) => l.date === date) ?? { date, mealsEaten: [] };
  const next = patch(existing);
  return [...logs.filter((l) => l.date !== date), next].sort((a, b) => a.date.localeCompare(b.date));
}

export const useApp = create<AppData & AppActions>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      completeOnboarding: (profile, exclusions) =>
        set({ profile, exclusions, progress: startProgress(profile.startDate) }),

      toggleMealEaten: (date, mealId) =>
        set((s) => ({
          logs: upsertLog(s.logs, date, (l) => ({
            ...l,
            mealsEaten: l.mealsEaten.includes(mealId) ? l.mealsEaten.filter((m) => m !== mealId) : [...l.mealsEaten, mealId],
          })),
        })),

      updateLog: (date, patch) => set((s) => ({ logs: upsertLog(s.logs, date, (l) => ({ ...l, ...patch })) })),

      startFast: (date, nowIso, warningAcknowledged) => {
        if (!warningAcknowledged) throw new Error('Confirma la advertencia médica antes de iniciar el ayuno.');
        set((s) => ({
          logs: upsertLog(s.logs, date, (l) => ({ ...l, medicalWarningAcknowledged: true, fastStartedAt: nowIso })),
        }));
      },

      applyChange: (choice) => {
        const { overrides, exclusions } = get();
        set(applyChange({ overrides, exclusions }, choice));
        return { overrides, exclusions };
      },
      restoreChanges: (prev) => set(prev),
      setExclusions: (exclusions) => set({ exclusions }),
      removeOverride: (o) => set((s) => ({ overrides: s.overrides.filter((x) => x !== o) })),

      toggleShoppingCheck: (week, food, trip) =>
        set((s) => {
          const same = (c: ShoppingCheck) => c.week === week && c.food === food && c.trip === trip;
          const current = s.shoppingChecks.find(same);
          return current
            ? { shoppingChecks: s.shoppingChecks.filter((c) => !same(c)) }
            : { shoppingChecks: [...s.shoppingChecks, { week, food, checked: true, ...(trip ? { trip } : {}) }] };
        }),

      setPantry: (week, food, amount) =>
        set((s) => ({
          pantry: [
            ...s.pantry.filter((p) => !(p.week === week && p.food === food)),
            ...(amount > 0 ? [{ week, food, amount }] : []),
          ],
        })),

      updateProfile: (patch) => set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : {})),
      swapMeal: (swap) => {
        const prev = get().mealSwaps;
        set({ mealSwaps: swapMeal(prev, swap) });
        return prev;
      },
      restoreMealSwaps: (prev) => set({ mealSwaps: prev }),
      replaceAll: (data) => set(data),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      advance: (today) => set((s) => (s.progress ? { progress: advanceWeek(s.progress, today) } : {})),
      repeat: (today) => set((s) => (s.progress ? { progress: repeatWeek(s.progress, today) } : {})),
      reset: () => set(EMPTY),
    }),
    {
      name: 'keto-continuum',
      version: 1,
      storage: createJSONStorage(() => dexieStorage),
      partialize: (s): AppData => ({
        profile: s.profile,
        exclusions: s.exclusions,
        overrides: s.overrides,
        mealSwaps: s.mealSwaps,
        pantry: s.pantry,
        shoppingChecks: s.shoppingChecks,
        logs: s.logs,
        progress: s.progress,
        settings: s.settings,
      }),
    },
  ),
);

/** Perfil que usa el motor, con las exclusiones vigentes hoy. */
export function planProfile(s: Pick<AppData, 'profile' | 'exclusions'>, today: string): PlanProfile & { sunriseTime?: string } {
  return {
    idealWeightKg: s.profile?.idealWeightKg ?? 60,
    exclusions: activeExclusions(s.exclusions, today),
    sunriseTime: s.profile?.sunriseTime,
  };
}
