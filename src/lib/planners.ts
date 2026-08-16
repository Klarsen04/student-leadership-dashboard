// Multi-planner registry for /planner.
//
// Each planner is a folder under /public/planner/<id>/ holding its rendered
// pages (pNNN.webp) plus an optional manifest.json with tap-target hotspots
// extracted from the source PDF's link annotations (scripts/add-planner.mjs
// builds all of this from a PDF). /public/planner/index.json lists them.
//
// Navigation comes from one of two places:
//   - template: "collanote-2026" → hand-built geometry in src/lib/planner.ts
//   - manifest links             → hotspots extracted from the PDF's own
//                                  hyperlinks (planners exported WITH links)

import type { Hotspot } from "@/lib/planner";

export interface PlannerInfo {
  id: string;
  name: string;
  description?: string;
  pages: number;
  aspect: number; // width / height
  /** Named template with code-driven navigation; absent for link-based planners. */
  template?: string;
}

export interface PlannerManifest extends PlannerInfo {
  /** Hotspots per page (1-based, as strings after JSON round-trip). */
  links?: Record<string, Hotspot[]>;
}

const SELECTED_KEY = "leadership-os-planner";

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
