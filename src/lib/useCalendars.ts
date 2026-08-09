"use client";

import { useState, useEffect, useCallback } from "react";

// Available calendar view engines. "default" = the app's original cute Time-Grid/Month views.
// Others are grafted open-source engines, reskinned to match the app aesthetic.
export type CalendarEngine = "default" | "dayflow" | "mina" | "ilamy";

export const CALENDAR_ENGINES: { id: CalendarEngine; label: string; description: string }[] = [
  { id: "default", label: "Classic", description: "The original cute day/week/month views" },
  { id: "dayflow", label: "DayFlow", description: "Clean multi-view big-calendar (day/week/month/year)" },
  { id: "mina", label: "Scheduler", description: "Minimal scheduler with quick event entry" },
  { id: "ilamy", label: "iLamy", description: "Lightweight, airy calendar grid" },
];

export interface SubCalendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  tags: string[];
  engine: CalendarEngine;
}

const STORAGE_KEY = "leadership-os-calendars";

const DEFAULT_CALENDARS: SubCalendar[] = [
  { id: "default", name: "Personal", color: "bg-blue-500", visible: true, tags: ["Personal"], engine: "default" },
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Backfill `engine` for calendars saved before the engine picker existed,
        // and migrate the removed "full-calendar" engine back to the default view.
        return parsed.map((c: any) => ({
          ...c,
          tags: c.tags || [],
          engine: !c.engine || c.engine === "full-calendar" ? "default" : c.engine,
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

  const addCalendar = useCallback((name: string, color: string, engine: CalendarEngine = "default") => {
    const current = getStoredCalendars();
    const id = `cal_${Date.now().toString(36)}`;
    const newCal: SubCalendar = { id, name, color, visible: true, tags: [], engine };
    save([...current, newCal]);
    return newCal;
  }, [save]);

  const setEngine = useCallback((id: string, engine: CalendarEngine) => {
    const current = getStoredCalendars();
    save(current.map((c) => c.id === id ? { ...c, engine } : c));
  }, [save]);

  // Which engine should render for the given selected-calendar NAME (null = "All").
  const getEngineFor = useCallback((calendarName: string | null): CalendarEngine => {
    if (!calendarName) return "default";
    const cal = getStoredCalendars().find((c) => c.name === calendarName);
    return cal?.engine || "default";
  }, []);

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

  return { calendars, addCalendar, deleteCalendar, toggleVisibility, updateCalendar, setEngine, getEngineFor, addTag, deleteTag, getCalendarColor, getTagsForCalendar, getCalendarByName, COLOR_OPTIONS };
}
