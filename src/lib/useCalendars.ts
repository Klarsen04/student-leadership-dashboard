"use client";

import { useState, useEffect, useCallback } from "react";

export interface SubCalendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  tags: string[];
}

const STORAGE_KEY = "leadership-os-calendars";

const DEFAULT_CALENDARS: SubCalendar[] = [
  { id: "default", name: "Personal", color: "bg-blue-500", visible: true, tags: ["Personal"] },
];

// Hex for each sub-calendar tailwind colour class, so filter chips and the
// calendar engine can paint events with their calendar's colour. Class colours
// are stored as hex already and pass through unchanged.
export const CAL_HEX: Record<string, string> = {
  "bg-blue-500": "#3b82f6", "bg-green-500": "#22c55e", "bg-purple-500": "#a855f7",
  "bg-orange-500": "#f97316", "bg-pink-500": "#ec4899", "bg-cyan-500": "#06b6d4",
  "bg-red-500": "#ef4444", "bg-amber-500": "#f59e0b", "bg-indigo-500": "#6366f1",
  "bg-teal-500": "#14b8a6", "bg-rose-500": "#f43f5e", "bg-emerald-500": "#10b981",
  "bg-gray-400": "#9ca3af",
};

export function calHex(color: string): string {
  if (color?.startsWith("#")) return color;
  return CAL_HEX[color] || "#6b7280";
}

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
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Strip any legacy `engine` field from calendars saved before the app
        // standardized on the single iLamy calendar view.
        return parsed.map(({ engine: _engine, ...c }: any) => ({
          ...c,
          tags: c.tags || [],
        }));
      }
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
    const newCal: SubCalendar = { id, name, color, visible: true, tags: [] };
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

  const addTag = useCallback((calendarId: string, tag: string) => {
    const current = getStoredCalendars();
    const cal = current.find((c) => c.id === calendarId);
    if (!cal) return false;
    if (cal.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    save(current.map((c) => c.id === calendarId ? { ...c, tags: [...c.tags, tag] } : c));
    return true;
  }, [save]);

  const deleteTag = useCallback((calendarId: string, tag: string) => {
    const current = getStoredCalendars();
    save(current.map((c) => c.id === calendarId ? { ...c, tags: c.tags.filter((t) => t !== tag) } : c));
  }, [save]);

  const getCalendarColor = useCallback((categoryName: string): string => {
    // Expanded class instances carry their own color as "__class__:bg-...".
    if (categoryName?.startsWith("__class__:")) {
      return categoryName.slice("__class__:".length) || "bg-blue-500";
    }
    const current = getStoredCalendars();
    const cal = current.find((c) => c.name === categoryName);
    return cal?.color || "bg-gray-400";
  }, []);

  const getTagsForCalendar = useCallback((calendarName: string | null): string[] => {
    const current = getStoredCalendars();
    if (!calendarName) {
      const allTags = new Set<string>();
      current.forEach((c) => c.tags.forEach((t) => allTags.add(t)));
      return Array.from(allTags);
    }
    const cal = current.find((c) => c.name === calendarName);
    return cal?.tags || [];
  }, []);

  const getCalendarByName = useCallback((name: string): SubCalendar | undefined => {
    return getStoredCalendars().find((c) => c.name === name);
  }, []);

  return { calendars, addCalendar, deleteCalendar, toggleVisibility, updateCalendar, addTag, deleteTag, getCalendarColor, getTagsForCalendar, getCalendarByName, COLOR_OPTIONS };
}
