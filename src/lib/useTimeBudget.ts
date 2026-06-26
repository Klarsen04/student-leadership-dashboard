"use client";

import { useState, useEffect, useCallback } from "react";

export interface BudgetEntry {
  calendar: string;
  hoursPerWeek: number;
}

const STORAGE_KEY = "leadership-os-time-budget";

function getStored(): BudgetEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function useTimeBudget() {
  const [budgets, setBudgets] = useState<BudgetEntry[]>([]);

  useEffect(() => {
    setBudgets(getStored());
  }, []);

  const save = useCallback((updated: BudgetEntry[]) => {
    setBudgets(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const setBudget = useCallback((calendar: string, hours: number) => {
    const current = getStored();
    const existing = current.findIndex((b) => b.calendar === calendar);
    if (existing >= 0) {
      current[existing].hoursPerWeek = hours;
    } else {
      current.push({ calendar, hoursPerWeek: hours });
    }
    save(current);
  }, [save]);

  const removeBudget = useCallback((calendar: string) => {
    const current = getStored();
    save(current.filter((b) => b.calendar !== calendar));
  }, [save]);

  return { budgets, setBudget, removeBudget };
}
