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

/** Group reflections by calendar month (newest first). */
export function groupReflectionsByMonth(reflections: Reflection[]) {
  const map: Record<string, Reflection[]> = {};
  for (const ref of reflections) {
    const key = ref.date.slice(0, 7); // YYYY-MM
    (map[key] ||= []).push(ref);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const [year, month] = key.split("-");
      return { key, month: `${MONTH_NAMES[parseInt(month) - 1]} ${year}`, items };
    });
}
