// Shared reflection types + display helpers, used by the reflections page and
// the dedicated history page.
import { format, startOfWeek, endOfWeek } from "date-fns";

export interface QA {
  question: string;
  answer: string;
}

export interface Reflection {
  id: string;
  type: string;
  date: string;
  content: string;
  mood: number | null;
  energy: number | null;
  gratitude: string | null;
  podId: string | null;
  questions: string | null;
}

/** Human label for a reflection's date, respecting its period type. */
export function formatReflectionDate(type: string, dateStr: string): string {
  const date = new Date(dateStr);
  if (type === "daily") return format(date, "EEEE, MMM d");
  if (type === "weekly") {
    const ws = startOfWeek(date, { weekStartsOn: 0 });
    const we = endOfWeek(date, { weekStartsOn: 0 });
    return `Week of ${format(ws, "MMM d")} – ${format(we, "MMM d")}`;
  }
  return format(date, "MMMM yyyy");
}

/** Parse the stored JSON question/answer pairs, tolerating bad data. */
export function parseQA(raw: string | null): QA[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type GroupMode = "day" | "week" | "month";

/**
 * Group reflections by day, week, or month (newest group first). Returns a
 * `month` label field regardless of mode so the history UI renders any grouping
 * the same way.
 */
export function groupReflections(reflections: Reflection[], mode: GroupMode) {
  const map: Record<string, { label: string; items: Reflection[] }> = {};
  for (const ref of reflections) {
    const d = new Date(ref.date);
    let key: string;
    let label: string;
    if (mode === "day") {
      key = ref.date.slice(0, 10); // YYYY-MM-DD
      label = format(d, "EEEE, MMMM d, yyyy");
    } else if (mode === "week") {
      const ws = startOfWeek(d, { weekStartsOn: 0 });
      const we = endOfWeek(d, { weekStartsOn: 0 });
      key = format(ws, "yyyy-MM-dd");
      label = `Week of ${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    } else {
      key = ref.date.slice(0, 7); // YYYY-MM
      const [year, month] = key.split("-");
      label = `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
    }
    (map[key] ||= { label, items: [] }).items.push(ref);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, { label, items }]) => ({ key, month: label, items }));
}

/** Group reflections by calendar month (newest first). */
export function groupReflectionsByMonth(reflections: Reflection[]) {
  return groupReflections(reflections, "month");
}
