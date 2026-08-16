// Multi-planner registry for /planner.
//
// Each planner is a folder under /public/planner/<id>/ holding its rendered
// pages (pNNN.webp) plus an optional manifest.json with tap-target hotspots
// extracted from the source PDF's link annotations (scripts/add-planner.mjs
// builds all of this from a PDF). /public/planner/index.json lists them.
//
// Navigation comes from one of two places:
//   - template: a key in src/lib/planner-templates.ts → hand-built geometry,
//     for PDFs exported without link annotations
//   - manifest links → hotspots extracted from the PDF's own hyperlinks

import type { Hotspot, Rect } from "@/lib/planner";

export interface PlannerInfo {
  id: string;
  name: string;
  description?: string;
  pages: number;
  aspect: number; // width / height
  /** Named template with code-driven navigation; absent for link-based planners. */
  template?: string;
  /** Library section heading, e.g. "365-Day Planners". */
  category?: string;
  /** Total size of the rendered pages, for the library card stats. */
  sizeMb?: number;
  /** Attribution shown on the library card (source project + licence). */
  credit?: string;
}

export const DEFAULT_CATEGORY = "Other Planners";

/** Order categories appear in the library; anything else falls to the end. */
const CATEGORY_ORDER = [
  "365-Day Planners",
  "Study Planners",
  "Minimal Planners",
  "Journals & Notebooks",
  DEFAULT_CATEGORY,
];

export interface PlannerSection {
  category: string;
  planners: PlannerInfo[];
}

/** Group the index into the library's category sections, in display order. */
export function groupByCategory(planners: PlannerInfo[]): PlannerSection[] {
  const groups = new Map<string, PlannerInfo[]>();
  for (const p of planners) {
    const key = p.category || DEFAULT_CATEGORY;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...groups.entries()]
    .map(([category, list]) => ({ category, planners: list }))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category));
}

export interface PlannerManifest extends PlannerInfo {
  /** Hotspots per page (1-based, as strings after JSON round-trip). */
  links?: Record<string, Hotspot[]>;
}

const SELECTED_KEY = "leadership-os-planner";

// ---- inferred page furniture ---------------------------------------------------
// Link-based planners have no hand-authored geometry, so the tab strips are
// inferred from the links themselves: a hyperlink pressed against an edge in a
// thin band is a printed tab. Those become "chrome" (ink-free, stylus-tappable)
// and ink is fenced to the paper just inside them.

const EDGE = 0.02; // how close to the page edge a tab sits
const BAND = 0.07; // how thin a tab strip is

export interface Furniture {
  writeArea: Rect;
  isChrome(h: Hotspot): boolean;
}

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Furniture for one page. Derived per page rather than across the whole PDF:
 * a nav row that only appears on the monthly spreads shouldn't crop the ink
 * area on every other page.
 */
export function deriveFurniture(pageLinks?: Hotspot[]): Furniture {
  const isChrome = (h: Hotspot) =>
    (h.w <= BAND && (h.x <= EDGE || h.x + h.w >= 1 - EDGE)) ||
    (h.h <= BAND && (h.y <= EDGE || h.y + h.h >= 1 - EDGE));
  if (!pageLinks?.length) return { writeArea: FULL, isChrome };

  const all = pageLinks.filter(isChrome);
  const edge = (pick: (h: Hotspot) => number, fallback: number, side: "max" | "min") => {
    const vals = all.map(pick).filter((v) => Number.isFinite(v));
    if (!vals.length) return fallback;
    return side === "max" ? Math.max(...vals) : Math.min(...vals);
  };
  const x0 = edge((h) => (h.w <= BAND && h.x <= EDGE ? h.x + h.w : NaN), 0, "max");
  const x1 = edge((h) => (h.w <= BAND && h.x + h.w >= 1 - EDGE ? h.x : NaN), 1, "min");
  const y0 = edge((h) => (h.h <= BAND && h.y <= EDGE ? h.y + h.h : NaN), 0, "max");
  const y1 = edge((h) => (h.h <= BAND && h.y + h.h >= 1 - EDGE ? h.y : NaN), 1, "min");
  // Ignore a nonsensical result rather than shrinking the page to nothing.
  if (x1 - x0 < 0.5 || y1 - y0 < 0.5) return { writeArea: FULL, isChrome };
  return { writeArea: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, isChrome };
}

export function imageSrc(planner: PlannerInfo, page: number): string {
  const pad = Math.max(3, String(planner.pages).length);
  return `/planner/${planner.id}/p${String(page).padStart(pad, "0")}.webp`;
}

export async function fetchPlannerIndex(): Promise<PlannerInfo[]> {
  const res = await fetch("/planner/index.json");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.planners) ? data.planners : [];
}

/** Per-planner manifest with link hotspots; falls back to the index entry. */
export async function fetchPlannerManifest(info: PlannerInfo): Promise<PlannerManifest> {
  try {
    const res = await fetch(`/planner/${info.id}/manifest.json`);
    if (res.ok) return { ...info, ...(await res.json()) };
  } catch {}
  return info;
}

export function getSelectedPlannerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function setSelectedPlannerId(id: string | null) {
  try {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
  } catch {}
}
