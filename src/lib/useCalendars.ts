"use client";

import { useCallback } from "react";
import { readSetting, useSyncedSetting, type SettingSpec } from "@/lib/synced-setting";

export interface CalendarTag {
  name: string;
  /** bg-* tailwind class, same palette as calendars */
  color: string;
}

export interface SubCalendar {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  tags: CalendarTag[];
}

const STORAGE_KEY = "leadership-os-calendars";

const DEFAULT_CALENDARS: SubCalendar[] = [
  { id: "default", name: "Personal", color: "bg-blue-500", visible: true, tags: [{ name: "Personal", color: "bg-blue-500" }] },
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

// Calendars follow the account, so the same ones show up on every device the
// user signs in on. Details of the local/remote contract: src/lib/synced-setting.ts.
const CALENDARS: SettingSpec<SubCalendar[]> = {
  key: STORAGE_KEY,
  fallback: DEFAULT_CALENDARS,
  revive: (raw) => {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    // Strip any legacy `engine` field from calendars saved before the app
    // standardized on the single iLamy calendar view. Tags saved before
    // they had their own colour were plain strings — give them the
    // calendar's colour.
    return raw.map(({ engine: _engine, ...c }: any) => ({
      ...c,
      tags: (c.tags || []).map((t: any) =>
        typeof t === "string" ? { name: t, color: c.color || "bg-blue-500" } : t
      ),
    }));
  },
};

const getStoredCalendars = (): SubCalendar[] => readSetting(CALENDARS);

export function useCalendars() {
  const { value: calendars, setValue: save } = useSyncedSetting(CALENDARS);

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

  const addTag = useCallback((calendarId: string, tag: string, color?: string) => {
    const current = getStoredCalendars();
    const cal = current.find((c) => c.id === calendarId);
    if (!cal) return false;
    if (cal.tags.some((t) => t.name.toLowerCase() === tag.toLowerCase())) return false;
    const newTag: CalendarTag = { name: tag, color: color || cal.color };
    save(current.map((c) => c.id === calendarId ? { ...c, tags: [...c.tags, newTag] } : c));
    return true;
  }, [save]);

  const setTagColor = useCallback((calendarId: string, tag: string, color: string) => {
    const current = getStoredCalendars();
    save(current.map((c) =>
      c.id === calendarId
        ? { ...c, tags: c.tags.map((t) => t.name === tag ? { ...t, color } : t) }
        : c
    ));
  }, [save]);

  const deleteTag = useCallback((calendarId: string, tag: string) => {
    const current = getStoredCalendars();
    save(current.map((c) => c.id === calendarId ? { ...c, tags: c.tags.filter((t) => t.name !== tag) } : c));
  }, [save]);

  // Colour for an event: its tag's colour when it has one, else its
  // sub-calendar's colour (Outlook-style categories).
  const getCalendarColor = useCallback((categoryName: string, role?: string): string => {
    // Expanded class instances carry their own color as "__class__:bg-...".
    if (categoryName?.startsWith("__class__:")) {
      return categoryName.slice("__class__:".length) || "bg-blue-500";
    }
    const current = getStoredCalendars();
    const cal = current.find((c) => c.name === categoryName);
    if (role) {
      const tag = cal?.tags.find((t) => t.name === role)
        // The tag may live on another calendar (e.g. events viewed under "All").
        ?? current.flatMap((c) => c.tags).find((t) => t.name === role);
      if (tag) return tag.color;
    }
    return cal?.color || "bg-gray-400";
  }, []);

  const getTagsForCalendar = useCallback((calendarName: string | null): CalendarTag[] => {
    const current = getStoredCalendars();
    if (!calendarName) {
      const seen = new Set<string>();
      const all: CalendarTag[] = [];
      current.forEach((c) => c.tags.forEach((t) => {
        if (!seen.has(t.name)) { seen.add(t.name); all.push(t); }
      }));
      return all;
    }
    const cal = current.find((c) => c.name === calendarName);
    return cal?.tags || [];
  }, []);

  const getCalendarByName = useCallback((name: string): SubCalendar | undefined => {
    return getStoredCalendars().find((c) => c.name === name);
  }, []);

  return { calendars, addCalendar, deleteCalendar, toggleVisibility, updateCalendar, addTag, setTagColor, deleteTag, getCalendarColor, getTagsForCalendar, getCalendarByName, COLOR_OPTIONS };
}
