"use client";

import { useCallback } from "react";
import { readSetting, useSyncedSetting, type SettingSpec } from "@/lib/synced-setting";

export interface BudgetEntry {
  calendar: string;
  hoursPerWeek: number;
}

const STORAGE_KEY = "leadership-os-time-budget";

// The weekly budget follows the account (src/lib/synced-setting.ts).
const BUDGETS: SettingSpec<BudgetEntry[]> = {
  key: STORAGE_KEY,
  fallback: [],
  revive: (raw) => (Array.isArray(raw) ? (raw as BudgetEntry[]) : null),
};

const getStored = (): BudgetEntry[] => readSetting(BUDGETS);

export function useTimeBudget() {
  const { value: budgets, setValue: save } = useSyncedSetting(BUDGETS);

  const setBudget = useCallback((calendar: string, hours: number) => {
    const current = getStored();
    const existing = current.findIndex((b) => b.calendar === calendar);
    // Rebuilt rather than mutated in place: the stored array is the shared value
    // now, so editing it directly would change it behind the store's back.
    save(
      existing >= 0
        ? current.map((b, i) => (i === existing ? { ...b, hoursPerWeek: hours } : b))
        : [...current, { calendar, hoursPerWeek: hours }],
    );
  }, [save]);

  const removeBudget = useCallback((calendar: string) => {
    const current = getStored();
    save(current.filter((b) => b.calendar !== calendar));
  }, [save]);

  return { budgets, setBudget, removeBudget };
}
