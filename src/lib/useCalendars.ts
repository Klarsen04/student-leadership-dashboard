"use client";

import { useState, useEffect, useCallback } from "react";

export interface SubCalendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
}

const STORAGE_KEY = "leadership-os-calendars";

const DEFAULT_CALENDARS: SubCalendar[] = [
  { id: "default", name: "My Calendar", color: "bg-blue-500", visible: true },
];

const COLOR_OPTIONS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-red-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-rose-500",
  "bg-emerald-500",
];

function getStoredCalendars(): SubCalendar[] {
  if (typeof window === "undefined") return DEFAULT_CALENDARS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_CALENDARS;
}

export function useCalendars() {
  const [calendars, setCalendars] = useState<SubCalendar[]>(DEFAULT_CALENDARS);

  useEffect(() => {
    setCalendars(getStoredCalendars());
  }, []);

  const save = useCallback((updated: SubCalendar[]) => {
    setCalendars(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addCalendar = useCallback((name: string, color: string) => {
    const current = getStoredCalendars();
    const id = `cal_${Date.now().toString(36)}`;
    const newCal: SubCalendar = { id, name, color, visible: true };
    save([...current, newCal]);
    return newCal;
  }, [save]);

  const deleteCalendar = useCallback((id: string) => {
    const current = getStoredCalendars();
    save(current.filter((c) => c.id !== id));
  }, [save]);

  const toggleVisibility = useCallback((id: string) => {
    const current = getStoredCalendars();
    save(current.map((c) => c.id === id ? { ...c, visible: !c.visible } : c));
  }, [save]);

  const updateCalendar = useCallback((id: string, updates: Partial<Pick<SubCalendar, "name" | "color">>) => {
    const current = getStoredCalendars();
    save(current.map((c) => c.id === id ? { ...c, ...updates } : c));
  }, [save]);

  return { calendars, addCalendar, deleteCalendar, toggleVisibility, updateCalendar, COLOR_OPTIONS };
}
