"use client";

import { useState, useEffect, useCallback } from "react";

const DEFAULT_CATEGORIES = ["Personal"];
const STORAGE_KEY = "leadership-os-goal-categories";

function getStored(): string[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_CATEGORIES;
}

export function useGoalCategories() {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    setCategories(getStored());
  }, []);

  const save = useCallback((updated: string[]) => {
    setCategories(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

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
