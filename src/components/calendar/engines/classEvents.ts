// Shared helper: expand recurring weekly classes into concrete EngineEvents so
// every engine can render classes the same way it renders events. Engines only
// natively understand dated events; a class ("Mon/Wed 10:00–10:50") is expanded
// into one event per matching weekday across the visible range.

import type { EngineClass, EngineEvent, EngineView } from "./types";

const DAY_TO_INDEX: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function dayIndex(day: string): number | null {
  const key = day.trim().toLowerCase();
  return key in DAY_TO_INDEX ? DAY_TO_INDEX[key] : null;
}

// How many days around `currentDate` an engine view needs classes expanded for.
// Generous window (covers month view + week navigation) — cheap since classes
// are few. Anchored to the start of the week containing currentDate.
function rangeDays(view: EngineView): number {
  switch (view) {
    case "day":
    case "3day":
    case "5day":
    case "week":
      return 14; // current + neighbouring week
    case "month":
    default:
      return 45; // whole month plus spill
  }
}

/** Expand classes into dated events across the visible range for `view`. */
export function classesToEvents(
  classes: EngineClass[],
  currentDate: Date,
  view: EngineView
): EngineEvent[] {
  if (!classes || classes.length === 0) return [];

  const span = rangeDays(view);
  // Start a week before currentDate so back-navigation still shows classes.
  const start = new Date(currentDate);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  const out: EngineEvent[] = [];

  for (let offset = 0; offset <= span; offset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    const wd = day.getDay();

    for (const cls of classes) {
      const matches = cls.days.some((d) => dayIndex(d) === wd);
      if (!matches) continue;

      const [sh, sm] = cls.startTime.split(":").map(Number);
      const [eh, em] = cls.endTime.split(":").map(Number);
      if (Number.isNaN(sh) || Number.isNaN(eh)) continue;

      const startTime = new Date(day);
      startTime.setHours(sh, sm || 0, 0, 0);
      const endTime = new Date(day);
      endTime.setHours(eh, em || 0, 0, 0);

      out.push({
        // stable per-day id so drag/click handlers can ignore class instances
        id: `class:${cls.id}:${day.toISOString().slice(0, 10)}`,
        title: cls.title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        category: `__class__:${cls.color}`, // marker so getColor can pick the class color
        role: "Class",
        location: cls.location || null,
        isLed: false,
        description: cls.professor ? `${cls.professor}` : undefined,
      });
    }
  }

  return out;
}

/** True if an EngineEvent id refers to an expanded class instance. */
export function isClassEvent(id: string): boolean {
  return id.startsWith("class:");
}

/** Extract the original class id from an expanded instance id ("class:<id>:<date>"). */
export function classIdFromEventId(id: string): string | null {
  if (!isClassEvent(id)) return null;
  // ids look like "class:<classId>:<YYYY-MM-DD>"; classId is the middle segment
  const rest = id.slice("class:".length);
  const lastColon = rest.lastIndexOf(":");
  return lastColon === -1 ? rest : rest.slice(0, lastColon);
}

/**
 * Resolve a clicked engine-event id back to its source EngineClass, if it is an
 * expanded class instance. Engines call this in their click handler so tapping a
 * class opens the class editor (like the classic view).
 */
export function findClassForEventId(
  id: string,
  classes: EngineClass[]
): EngineClass | null {
  const classId = classIdFromEventId(id);
  if (!classId) return null;
  return classes.find((c) => c.id === classId) ?? null;
}
