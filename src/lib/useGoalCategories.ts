"use client";

import { useCallback } from "react";
import { readSetting, useSyncedSetting, type SettingSpec } from "@/lib/synced-setting";

const DEFAULT_CATEGORIES = ["Personal"];
const STORAGE_KEY = "leadership-os-goal-categories";

// Goal categories follow the account (src/lib/synced-setting.ts).
const CATEGORIES: SettingSpec<string[]> = {
  key: STORAGE_KEY,
  fallback: DEFAULT_CATEGORIES,
  revive: (raw) => (Array.isArray(raw) && raw.length > 0 ? (raw as string[]) : null),
};

const getStored = (): string[] => readSetting(CATEGORIES);

export function useGoalCategories() {
  const { value: categories, setValue: save } = useSyncedSetting(CATEGORIES);

  const addCategory = useCallback((name: string) => {
    const current = getStored();
    if (current.some((c) => c.toLowerCase() === name.toLowerCase())) return false;
    save([...current, name]);
    return true;
  }, [save]);

  const deleteCategory = useCallback((name: string) => {
    const current = getStored();
    save(current.filter((c) => c !== name));
  }, [save]);

  return { categories, addCategory, deleteCategory };
}
