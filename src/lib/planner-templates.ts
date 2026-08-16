// Hand-authored navigation for planner PDFs that were exported without link
// annotations (iOS "print to PDF" strips them), plus the shared shape the
// viewer talks to.
//
// Each template supplies three things:
//   hotspots(page) — tap targets, split into "chrome" (printed tabs and
//                    buttons, never writable) and "content" (day cells on
//                    writable paper)
//   label(page)    — what the toolbar shows
//   writeArea      — the one rectangle ink is allowed inside
//
// Geometry is expressed as fractions of the page and was measured off the
// rendered pages, so it holds at any zoom or screen size.

import {
  type Hotspot,
  type Rect,
  WRITE_AREA as COLLANOTE_WRITE_AREA,
  hotspotsForPage as collanoteHotspots,
  pageLabel as collanotePageLabel,
  todayPage as collanoteTodayPage,
  monthlyPage as collanoteMonthlyPage,
  SECTION_PAGES as COLLANOTE_SECTIONS,
  PLANNER_YEAR,
} from "@/lib/planner";

export interface PlannerTemplate {
  hotspots(page: number): Hotspot[];
  label(page: number): string;
  /** Page to open by default, and the target of the "Today" button. */
  today(now: Date): number;
  writeArea: Rect;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();

/** Evenly pitched strip of tabs down the right edge (or across the top). */
function strip(
  axis: "y" | "x",
  { start, pitch, size, cross, thickness }: { start: number; pitch: number; size: number; cross: number; thickness: number },
  items: { page: number; label: string }[],
): Hotspot[] {
  return items.map((it, i) =>
    axis === "y"
      ? { x: cross, y: start + i * pitch, w: thickness, h: size, page: it.page, label: it.label, kind: "chrome" as const }
      : { x: start + i * pitch, y: cross, w: size, h: thickness, page: it.page, label: it.label, kind: "chrome" as const },
  );
}

// ---------------------------------------------------------------------------
// 2026–2027 Back To School (371 pages, portrait)
//
// p1 cover · p2 school calendar · p3 timetable
// p4–p360  ten month blocks, September 2026 → June 2027. Within a block the
//          pages run in date order: the monthly spread first, then a weekly
//          page immediately before each Monday, then one page per day. Weeks
//          are numbered 1–44 straight through the year, so a week that starts
//          in the previous month has its weekly page in that month's block.
// p361–371 exam planner, exam prep, homework, course list, course overview,
//          lecture note, mind map, reading note, then three notes pages.
// ---------------------------------------------------------------------------

const BTS_MONTHS = [
  { name: "September", year: 2026, month0: 8 },
  { name: "October", year: 2026, month0: 9 },
  { name: "November", year: 2026, month0: 10 },
  { name: "December", year: 2026, month0: 11 },
  { name: "January", year: 2027, month0: 0 },
  { name: "February", year: 2027, month0: 1 },
  { name: "March", year: 2027, month0: 2 },
  { name: "April", year: 2027, month0: 3 },
  { name: "May", year: 2027, month0: 4 },
  { name: "June", year: 2027, month0: 5 },
];

const BTS_SECTIONS = {
  calendar: 2,
  timetable: 3,
  exam: 361,
  homework: 363,
  course: 364,
  lecture: 366,
  mindMap: 367,
  reading: 368,
  notes: 369,
} as const;

interface DatedPlan {
  /** Monthly-spread page per month index. */
  monthly: number[];
  /** "<monthIndex>-<day>" → daily page. */
  daily: Map<string, number>;
  /** "<monthIndex>-<day>" → the weekly page covering that date. */
  weekly: Map<string, number>;
  /** Reverse lookups for labelling. */
  pageKind: Map<number, { type: "monthly" | "weekly" | "daily"; mi: number; day?: number; week?: number }>;
}

const btsPlan: DatedPlan = (() => {
  const monthly: number[] = [];
  const daily = new Map<string, number>();
  const weekly = new Map<string, number>();
  const pageKind = new Map<number, { type: "monthly" | "weekly" | "daily"; mi: number; day?: number; week?: number }>();
  let p = 4;
  let week = 0;
  let weekPage = 0;
  for (let mi = 0; mi < BTS_MONTHS.length; mi++) {
    const { year, month0 } = BTS_MONTHS[mi];
    monthly[mi] = p;
    pageKind.set(p, { type: "monthly", mi });
    p++;
    for (let d = 1; d <= daysInMonth(year, month0); d++) {
      // A weekly page precedes every Monday, and the planner's very first day.
      if (new Date(year, month0, d).getDay() === 1 || (mi === 0 && d === 1)) {
        week++;
        weekPage = p;
        pageKind.set(p, { type: "weekly", mi, week });
        p++;
      }
      const key = `${mi}-${d}`;
      daily.set(key, p);
      weekly.set(key, weekPage);
      pageKind.set(p, { type: "daily", mi, day: d });
      p++;
    }
  }
  return { monthly, daily, weekly, pageKind };
})();

// Top pill row, printed on every page.
const BTS_PILLS: { x0: number; x1: number; label: string; page: number }[] = [
  { x0: 0.0775, x1: 0.1714, label: "Exam", page: BTS_SECTIONS.exam },
  { x0: 0.1981, x1: 0.2920, label: "Homework", page: BTS_SECTIONS.homework },
  { x0: 0.3180, x1: 0.4126, label: "Course", page: BTS_SECTIONS.course },
  { x0: 0.4380, x1: 0.5326, label: "Lecture", page: BTS_SECTIONS.lecture },
  { x0: 0.5579, x1: 0.6525, label: "Mind Map", page: BTS_SECTIONS.mindMap },
  { x0: 0.6785, x1: 0.7724, label: "Reading", page: BTS_SECTIONS.reading },
  { x0: 0.7985, x1: 0.8931, label: "Notes", page: BTS_SECTIONS.notes },
];

// Right-edge tabs: a "back to calendar" arrow, then the ten school months.
const BTS_TAB_EDGES = [0.0180, 0.0883, 0.1797, 0.2654, 0.3522, 0.4390, 0.5253, 0.6125, 0.6993, 0.7861, 0.8724, 0.9592];

// Monthly-spread day grid (Monday start) and the SEP–JUN quick-jump row.
const BTS_GRID = { x0: 0.0809, colW: 0.11613, y0: 0.4929, rowH: 0.0752, rows: 6 };
const BTS_MONTH_ROW = { x0: 0.1680, pitch: 0.06299, w: 0.0600, y: 0.1700, h: 0.0280 };

function btsChrome(): Hotspot[] {
  const spots: Hotspot[] = BTS_PILLS.map((t) => ({
    x: t.x0, y: 0.0355, w: t.x1 - t.x0, h: 0.0360, page: t.page, label: t.label, kind: "chrome",
  }));
  const tabTargets = [
    { page: BTS_SECTIONS.calendar, label: "School calendar" },
    ...BTS_MONTHS.map((m, i) => ({ page: btsPlan.monthly[i], label: m.name })),
  ];
  tabTargets.forEach((t, i) => {
    spots.push({
      x: 0.9465, y: BTS_TAB_EDGES[i], w: 0.0535,
      h: BTS_TAB_EDGES[i + 1] - BTS_TAB_EDGES[i],
      page: t.page, label: t.label, kind: "chrome",
    });
  });
  return spots;
}

function btsMonthlyHotspots(mi: number): Hotspot[] {
  const spots: Hotspot[] = [];
  const { name, year, month0 } = BTS_MONTHS[mi];
  // Quick-jump row of month abbreviations under the title.
  BTS_MONTHS.forEach((m, i) => {
    spots.push({
      x: BTS_MONTH_ROW.x0 + i * BTS_MONTH_ROW.pitch, y: BTS_MONTH_ROW.y,
      w: BTS_MONTH_ROW.w, h: BTS_MONTH_ROW.h,
      page: btsPlan.monthly[i], label: m.name, kind: "chrome",
    });
  });
  // Day cells. The grid starts on the Monday of the week containing the 1st.
  const lead = (new Date(year, month0, 1).getDay() + 6) % 7; // Monday-based offset
  const days = daysInMonth(year, month0);
  for (let row = 0; row < BTS_GRID.rows; row++) {
    for (let col = 0; col < 7; col++) {
      const day = row * 7 + col - lead + 1;
      if (day < 1 || day > days) continue;
      spots.push({
        x: BTS_GRID.x0 + col * BTS_GRID.colW, y: BTS_GRID.y0 + row * BTS_GRID.rowH,
        w: BTS_GRID.colW, h: BTS_GRID.rowH,
        page: btsPlan.daily.get(`${mi}-${day}`)!, label: `${name} ${day}`, kind: "content",
      });
    }
  }
  return spots;
}

const BTS_TAIL_LABELS: Record<number, string> = {
  1: "Cover",
  2: "School calendar",
  3: "School timetable",
  361: "Exam planner",
  362: "Exam prep",
  363: "Homework planner",
  364: "Course list",
  365: "Course overview",
  366: "Lecture note",
  367: "Mind map",
  368: "Reading note",
  369: "Notes · lined",
  370: "Notes · grid",
  371: "Notes · graph",
};

const backToSchool: PlannerTemplate = {
  writeArea: { x: 0.030, y: 0.075, w: 0.914, h: 0.917 },
  hotspots(page) {
    const spots = btsChrome();
    const kind = btsPlan.pageKind.get(page);
    if (kind?.type === "monthly") spots.push(...btsMonthlyHotspots(kind.mi));
    return spots;
  },
  label(page) {
    const fixed = BTS_TAIL_LABELS[page];
    if (fixed) return fixed;
    const kind = btsPlan.pageKind.get(page);
    if (!kind) return `Page ${page}`;
    const m = BTS_MONTHS[kind.mi];
    if (kind.type === "monthly") return `${m.name} ${m.year}`;
    if (kind.type === "weekly") return `Week ${kind.week}`;
    return new Date(m.year, m.month0, kind.day).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  },
  today(now) {
    for (let mi = 0; mi < BTS_MONTHS.length; mi++) {
      const m = BTS_MONTHS[mi];
      if (now.getFullYear() === m.year && now.getMonth() === m.month0) {
        return btsPlan.daily.get(`${mi}-${now.getDate()}`) ?? btsPlan.monthly[mi];
      }
    }
    return BTS_SECTIONS.calendar;
  },
};

// ---------------------------------------------------------------------------
// 2026 Making The Year Mine (450 pages, portrait)
//
// p1 cover · p2 year at a glance · p3 vision board
// Then twelve fixed-shape month blocks: one monthly spread, five weekly pages,
// then one page per day. p441–450 hold the trackers and notes pages.
// ---------------------------------------------------------------------------

const MYM_WEEKLIES = 5;

/** First page of each month's block, January → December. */
const MYM_MONTH_START = (() => {
  const starts: number[] = [];
  let p = 4;
  for (let m = 0; m < 12; m++) {
    starts.push(p);
    p += 1 + MYM_WEEKLIES + daysInMonth(PLANNER_YEAR, m);
  }
  return starts;
})();

const mymMonthly = (m0: number) => MYM_MONTH_START[m0];
const mymDaily = (m0: number, day: number) => MYM_MONTH_START[m0] + 1 + MYM_WEEKLIES + day - 1;

const MYM_SECTIONS = {
  year: 2,
  vision: 3,
  project: 441,
  habit: 442,
  books: 443,
  health: 445,
  mood: 447,
} as const;

const MYM_TOP_BAR: { x0: number; x1: number; label: string; page: number }[] = [
  { x0: 0.1000, x1: 0.2255, label: "Home", page: MYM_SECTIONS.year }, // printed as a house icon
  { x0: 0.2255, x1: 0.3557, label: "Project planner", page: MYM_SECTIONS.project },
  { x0: 0.3557, x1: 0.4860, label: "Habit tracker", page: MYM_SECTIONS.habit },
  { x0: 0.4860, x1: 0.6162, label: "Reading log", page: MYM_SECTIONS.books },
  { x0: 0.6162, x1: 0.7464, label: "Body measurement", page: MYM_SECTIONS.health },
  { x0: 0.7464, x1: 0.9000, label: "Mood tracker", page: MYM_SECTIONS.mood },
];

const MYM_GRID = { x0: 0.1415, colPitch: 0.1063, colW: 0.0926, y0: 0.2785, rowPitch: 0.0794, rowH: 0.0735, rows: 6 };

const MYM_TAIL_LABELS: Record<number, string> = {
  1: "Cover",
  2: "2026 · Year at a glance",
  3: "Vision board",
  441: "Project planner",
  442: "Habit tracker",
  443: "Reading log",
  444: "Book review",
  445: "Body measurement",
  446: "Fitness goals",
  447: "Mood tracker",
  448: "Notes · lined",
  449: "Notes · grid",
  450: "Notes · dotted",
};

function mymChrome(): Hotspot[] {
  const spots: Hotspot[] = MYM_TOP_BAR.map((t) => ({
    x: t.x0, y: 0, w: t.x1 - t.x0, h: 0.047, page: t.page, label: t.label, kind: "chrome",
  }));
  spots.push(...strip("y", { start: 0.0766, pitch: 0.0722, size: 0.0722, cross: 0.9330, thickness: 0.0470 },
    MONTHS.map((name, m) => ({ page: mymMonthly(m), label: name }))));
  return spots;
}

function mymMonthlyHotspots(m0: number): Hotspot[] {
  const spots: Hotspot[] = [];
  const lead = (new Date(PLANNER_YEAR, m0, 1).getDay() + 6) % 7; // Monday-start grid
  const days = daysInMonth(PLANNER_YEAR, m0);
  for (let row = 0; row < MYM_GRID.rows; row++) {
    for (let col = 0; col < 7; col++) {
      const day = row * 7 + col - lead + 1;
      if (day < 1 || day > days) continue;
      spots.push({
        x: MYM_GRID.x0 + col * MYM_GRID.colPitch, y: MYM_GRID.y0 + row * MYM_GRID.rowPitch,
        w: MYM_GRID.colW, h: MYM_GRID.rowH,
        page: mymDaily(m0, day), label: `${MONTHS[m0]} ${day}`, kind: "content",
      });
    }
  }
  return spots;
}

/** Which month block a page falls in, and what kind of page it is. */
function mymLocate(page: number) {
  if (page < 4 || page > 440) return null;
  for (let m = 0; m < 12; m++) {
    const start = MYM_MONTH_START[m];
    const end = start + MYM_WEEKLIES + daysInMonth(PLANNER_YEAR, m);
    if (page > end) continue;
    if (page === start) return { m, type: "monthly" as const };
    if (page <= start + MYM_WEEKLIES) return { m, type: "weekly" as const, week: page - start };
    return { m, type: "daily" as const, day: page - start - MYM_WEEKLIES };
  }
  return null;
}

const makingTheYearMine: PlannerTemplate = {
  writeArea: { x: 0.052, y: 0.052, w: 0.880, h: 0.918 },
  hotspots(page) {
    const spots = mymChrome();
    const at = mymLocate(page);
    if (at?.type === "monthly") spots.push(...mymMonthlyHotspots(at.m));
    return spots;
  },
  label(page) {
    const fixed = MYM_TAIL_LABELS[page];
    if (fixed) return fixed;
    const at = mymLocate(page);
    if (!at) return `Page ${page}`;
    if (at.type === "monthly") return `${MONTHS[at.m]} ${PLANNER_YEAR}`;
    if (at.type === "weekly") return `${MONTHS[at.m]} · Week ${at.week}`;
    return new Date(PLANNER_YEAR, at.m, at.day).toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  },
  today(now) {
    if (now.getFullYear() !== PLANNER_YEAR) return MYM_SECTIONS.year;
    return mymDaily(now.getMonth(), now.getDate());
  },
};

// ---------------------------------------------------------------------------

const collanote2026: PlannerTemplate = {
  writeArea: COLLANOTE_WRITE_AREA,
  hotspots: collanoteHotspots,
  label: collanotePageLabel,
  today: (now) => {
    if (now.getFullYear() !== PLANNER_YEAR) return COLLANOTE_SECTIONS.cover;
    return collanoteTodayPage(now);
  },
};

export const PLANNER_TEMPLATES: Record<string, PlannerTemplate> = {
  "collanote-2026": collanote2026,
  "back-to-school-2026": backToSchool,
  "making-the-year-mine-2026": makingTheYearMine,
};

/** Default page when opening a template-driven planner with no ?page. */
export function templateOpeningPage(id: string, now = new Date()): number {
  const t = PLANNER_TEMPLATES[id];
  if (!t) return 1;
  if (id === "collanote-2026") {
    return now.getFullYear() === PLANNER_YEAR ? collanoteMonthlyPage(now.getMonth() + 1) : COLLANOTE_SECTIONS.cover;
  }
  return t.today(now);
}
