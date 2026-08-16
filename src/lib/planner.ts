// Page map + tap-target geometry for the 2026 notebook planner (/planner).
//
// The planner is a 513-page CollaNote-style PDF rendered to /public/planner/
// p001.webp … p513.webp. The export carries no PDF link annotations, so the
// GoodNotes-style navigation (month tabs, side tabs, tappable day cells) is
// reconstructed here as normalised hotspot rectangles (fractions of the page,
// x/y/w/h in 0..1) derived from the template's fixed layout.
//
// Page structure (1-based):
//   1        cover
//   2        year calendar + vision board
//   3–14     monthly spreads (Jan–Dec)
//   15–26    month "at a glance"
//   27–38    month goals
//   39–50    month budget
//   51–62    month in review
//   63–115   weekly planner (Jan 1–3 partial week, then Sunday-start weeks)
//   116–480  daily planner (day-of-year 1–365)
//   481      reading list   482 book review
//   483      habit tracker  484 project tracker
//   485–496  body measurement (per month)
//   497–508  workout challenge (per month)
//   509      mood tracker   510–512 notes   513 stickers
export const PLANNER_YEAR = 2026;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ---- page lookups -----------------------------------------------------------

export const monthlyPage = (month: number) => 2 + month; // month 1–12
export const atGlancePage = (month: number) => 14 + month;
export const goalsPage = (month: number) => 26 + month;
export const budgetPage = (month: number) => 38 + month;
export const reviewPage = (month: number) => 50 + month;
export const healthPage = (month: number) => 484 + month;
export const workoutPage = (month: number) => 496 + month;

export const SECTION_PAGES = {
  cover: 1,
  year: 2,
  book: 481,
  habit: 483,
  project: 484,
  mood: 509,
  notes: 510,
  more: 513,
} as const;

function dayOfYear(d: Date): number {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86400000) + 1;
}

/** Daily-planner page for a 2026 date. */
export function dailyPage(d: Date): number {
  return 116 + dayOfYear(d) - 1;
}

/** Weekly-planner page for a 2026 date (p63 = Jan 1–3, then Sunday weeks). */
export function weeklyPage(d: Date): number {
  const jan4 = Date.UTC(PLANNER_YEAR, 0, 4); // first Sunday of 2026
  const t = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  if (t < jan4) return 63;
  return Math.min(115, 64 + Math.floor((t - jan4) / (7 * 86400000)));
}

/** Best "today" page: the daily page during 2026, else the cover. */
export function todayPage(now = new Date()): number {
  if (now.getFullYear() !== PLANNER_YEAR) return SECTION_PAGES.cover;
  return dailyPage(now);
}

// ---- hotspots ----------------------------------------------------------------

export interface Hotspot {
  x: number; y: number; w: number; h: number; // fractions of the page
  page: number; // target page
  label: string;
  /**
   * "chrome" marks a tab or navigation button printed in the page furniture:
   * it never accepts ink and a stylus tap on it navigates instead of drawing.
   * "content" targets (day cells) sit on writable paper, so they only navigate
   * from a finger tap or the hand tool. Defaults to "content".
   */
  kind?: "chrome" | "content";
}

/** Rectangle in page fractions. */
export interface Rect { x: number; y: number; w: number; h: number }

/**
 * The only area of this template that accepts ink: everything inside the page
 * excluding the top month-tab bar and the left-edge section tabs.
 */
export const WRITE_AREA: Rect = { x: 0.035, y: 0.052, w: 0.962, h: 0.945 };

// Top month tab bar: JAN–JUNE across the left half, JULY–DEC across the right.
const TAB_TOP = { y: 0, h: 0.048 };
const LEFT_TABS = { x0: 0.033, x1: 0.494 };
const RIGHT_TABS = { x0: 0.516, x1: 0.997 };

// Left-edge section tabs (fractions measured from the template).
const SIDE_TABS: { y0: number; y1: number; label: string; page: number }[] = [
  { y0: 0.040, y1: 0.180, label: "2026", page: SECTION_PAGES.year },
  { y0: 0.185, y1: 0.320, label: "Book", page: SECTION_PAGES.book },
  { y0: 0.325, y1: 0.455, label: "Habit", page: SECTION_PAGES.habit },
  { y0: 0.460, y1: 0.625, label: "Project", page: SECTION_PAGES.project },
  { y0: 0.630, y1: 0.725, label: "Mood", page: SECTION_PAGES.mood },
  { y0: 0.730, y1: 0.870, label: "Notes", page: SECTION_PAGES.notes },
  { y0: 0.875, y1: 0.975, label: "More", page: SECTION_PAGES.more },
];

/** Tabs shown on every page of the template. */
export function chromeHotspots(): Hotspot[] {
  const spots: Hotspot[] = [];
  for (let i = 0; i < 6; i++) {
    const lw = (LEFT_TABS.x1 - LEFT_TABS.x0) / 6;
    spots.push({ x: LEFT_TABS.x0 + i * lw, y: TAB_TOP.y, w: lw, h: TAB_TOP.h, page: monthlyPage(i + 1), label: MONTH_NAMES[i], kind: "chrome" });
    const rw = (RIGHT_TABS.x1 - RIGHT_TABS.x0) / 6;
    spots.push({ x: RIGHT_TABS.x0 + i * rw, y: TAB_TOP.y, w: rw, h: TAB_TOP.h, page: monthlyPage(i + 7), label: MONTH_NAMES[i + 6], kind: "chrome" });
  }
  for (const t of SIDE_TABS) {
    spots.push({ x: 0, y: t.y0, w: 0.033, h: t.y1 - t.y0, page: t.page, label: t.label, kind: "chrome" });
  }
  return spots;
}

// Monthly-spread day grid: Sun–Wed on the left page, Thu–Sat on the right,
// a W-number strip on the far left of each row, and quick-link buttons on the
// right margin.
const GRID = {
  top: 0.172,
  bottom: 0.945,
  rows: 6,
  wStrip: { x: 0.049, w: 0.023 },
  leftCols: { x0: 0.072, x1: 0.468 }, // Sun Mon Tue Wed
  rightCols: { x0: 0.549, x1: 0.863 }, // Thu Fri Sat
};

const MONTH_BUTTONS: { y0: number; y1: number; label: string; page: (m: number) => number }[] = [
  { y0: 0.170, y1: 0.205, label: "At a glance", page: atGlancePage },
  { y0: 0.233, y1: 0.268, label: "Goals", page: goalsPage },
  { y0: 0.297, y1: 0.332, label: "Budget", page: budgetPage },
  { y0: 0.360, y1: 0.396, label: "Review", page: reviewPage },
  { y0: 0.424, y1: 0.460, label: "Health", page: healthPage },
  { y0: 0.488, y1: 0.523, label: "Workout", page: workoutPage },
];

/** Extra hotspots for a monthly spread: day cells, week strips, side buttons. */
export function monthHotspots(month: number): Hotspot[] {
  const spots: Hotspot[] = [];
  // Local-calendar dates throughout: dailyPage/weeklyPage read local date parts.
  const first = new Date(PLANNER_YEAR, month - 1, 1);
  const daysInMonth = new Date(PLANNER_YEAR, month, 0).getDate();
  // The grid's first row is the week containing the 1st (Sunday start).
  const firstSundayOffset = first.getDay(); // how many cells before the 1st
  const rowH = (GRID.bottom - GRID.top) / GRID.rows;
  const lw = (GRID.leftCols.x1 - GRID.leftCols.x0) / 4;
  const rw = (GRID.rightCols.x1 - GRID.rightCols.x0) / 3;

  const weekRows = Math.ceil((firstSundayOffset + daysInMonth) / 7);
  for (let row = 0; row < weekRows; row++) {
    const y = GRID.top + row * rowH;
    // W-strip → weekly page for that row's Sunday (or Jan 1 for the partial week).
    const rowStartDay = row * 7 - firstSundayOffset + 1;
    const wDate = new Date(PLANNER_YEAR, month - 1, Math.max(1, rowStartDay));
    spots.push({ x: GRID.wStrip.x, y, w: GRID.wStrip.w, h: rowH, page: weeklyPage(wDate), label: `Week of ${MONTH_NAMES[month - 1]} ${Math.max(1, rowStartDay)}`, kind: "chrome" });

    for (let col = 0; col < 7; col++) {
      const dayNum = row * 7 + col - firstSundayOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) continue;
      const date = new Date(PLANNER_YEAR, month - 1, dayNum);
      const rect = col < 4
        ? { x: GRID.leftCols.x0 + col * lw, w: lw }
        : { x: GRID.rightCols.x0 + (col - 4) * rw, w: rw };
      spots.push({ ...rect, y, h: rowH, page: dailyPage(date), label: `${MONTH_NAMES[month - 1]} ${dayNum}` });
    }
  }

  for (const b of MONTH_BUTTONS) {
    spots.push({ x: 0.886, y: b.y0, w: 0.075, h: b.y1 - b.y0, page: b.page(month), label: b.label, kind: "chrome" });
  }
  return spots;
}

/** All hotspots for a given planner page. */
export function hotspotsForPage(page: number): Hotspot[] {
  const spots = chromeHotspots();
  if (page >= 3 && page <= 14) spots.push(...monthHotspots(page - 2));
  return spots;
}

/** Human label for the current page (for the toolbar). */
export function pageLabel(page: number): string {
  if (page === 1) return "Cover";
  if (page === 2) return "2026 · Vision board";
  if (page >= 3 && page <= 14) return MONTH_NAMES[page - 3];
  if (page >= 15 && page <= 26) return `${MONTH_NAMES[page - 15]} · At a glance`;
  if (page >= 27 && page <= 38) return `${MONTH_NAMES[page - 27]} · Goals`;
  if (page >= 39 && page <= 50) return `${MONTH_NAMES[page - 39]} · Budget`;
  if (page >= 51 && page <= 62) return `${MONTH_NAMES[page - 51]} · Review`;
  if (page >= 63 && page <= 115) return `Weekly planner`;
  if (page >= 116 && page <= 480) {
    const d = new Date(Date.UTC(PLANNER_YEAR, 0, 1) + (page - 116) * 86400000);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  }
  if (page === 481 || page === 482) return "Reading";
  if (page === 483) return "Habit tracker";
  if (page === 484) return "Project tracker";
  if (page >= 485 && page <= 496) return `${MONTH_NAMES[page - 485]} · Health`;
  if (page >= 497 && page <= 508) return `${MONTH_NAMES[page - 497]} · Workout`;
  if (page === 509) return "Mood tracker";
  if (page >= 510 && page <= 512) return "Notes";
  return "Stickers";
}
