// Erasing, in the two forms a handwriting app needs.
//
//  - "stroke"  — the tip touches a stroke and the whole stroke goes. Fast and forgiving
//                for taking back something you've just written.
//  - "precise" — only the part under the tip goes, and what's left of the stroke stays
//                exactly as it was drawn. That's the one you want for rubbing out a
//                letter in the middle of a word.
//
// Precise erasing *splits* a stroke: the surviving runs of samples become strokes of
// their own, with their own pressures and colour, so they stay real vector ink — nothing
// is rasterised and nothing is redrawn from scratch. Strokes the tip never touched are
// returned by identity (the very same object), which is what keeps element ids, the
// selection and the render cache from being invalidated by an erase that missed.
//
// All distances are in *width units*: x as it comes, y corrected by the page's aspect
// ratio, so a round tip stays round on a page that isn't square.

import { isStroke, type PageElement, type Stroke } from "@/lib/planner-ink";

export type EraserMode = "precise" | "stroke";

export interface EraserTip {
  x: number;
  y: number;
  /** Tip radius as a fraction of page width. */
  r: number;
  /** Page width ÷ height, so vertical distances can be put in width units. */
  aspect: number;
}

/** Eraser tip radii as a fraction of page width — small / medium / large. */
export const ERASER_SIZES = [0.006, 0.014, 0.03];

type Point = [number, number, number];

/** Squared distance from the tip to the segment a→b, in width units. */
function distToSeg(a: Point, b: Point, tip: EraserTip): number {
  const ax = a[0], ay = a[1] / tip.aspect;
  const bx = b[0], by = b[1] / tip.aspect;
  const px = tip.x, py = tip.y / tip.aspect;
  const vx = bx - ax, vy = by - ay;
  const len = vx * vx + vy * vy;
  // A degenerate segment (two identical samples) is just a point.
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return dx * dx + dy * dy;
}

const hitsPoint = (p: Point, tip: EraserTip) => distToSeg(p, p, tip) < tip.r * tip.r;
const hitsSeg = (a: Point, b: Point, tip: EraserTip) => distToSeg(a, b, tip) < tip.r * tip.r;

/**
 * Does the tip touch this stroke at all? Measured against the *segments*, not just the
 * samples: a fast pen leaves long gaps between samples, and a tip passing between two of
 * them still has to erase.
 */
export function touches(s: Stroke, tip: EraserTip): boolean {
  const pts = s.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return hitsPoint(pts[0], tip);
  for (let i = 1; i < pts.length; i++) if (hitsSeg(pts[i - 1], pts[i], tip)) return true;
  return false;
}

/**
 * The stroke with the part under the tip taken out, as one stroke per surviving run.
 * Returns `null` when the tip missed, so the caller can keep the original object.
 *
 * Fragments of a single sample are dropped: a lone point left behind by an erase is a
 * crumb of ink you didn't ask for, and it can't be aimed at to remove.
 */
export function splitStroke(s: Stroke, tip: EraserTip): Stroke[] | null {
  const pts = s.points;
  if (!touches(s, tip)) return null;
  const out: Stroke[] = [];
  let run: Point[] = [];
  const flush = () => {
    if (run.length > 1) out.push({ ...s, points: run });
    run = [];
  };
  for (let i = 0; i < pts.length; i++) {
    if (hitsPoint(pts[i], tip)) { flush(); continue; }
    // The segment that got here was rubbed through, so this sample starts a new run.
    if (run.length && hitsSeg(pts[i - 1], pts[i], tip)) flush();
    run.push(pts[i]);
  }
  flush();
  return out;
}

/**
 * Rub out at one position. Returns the new element list, or `null` if nothing was
 * touched — an eraser is dragged across a page and most of the positions it visits
 * change nothing, so the caller should skip the state update entirely.
 *
 * Text boxes are never erased: they're edited and deleted with the text tool, and having
 * a stray eraser stroke silently swallow a paragraph is far worse than having to reach
 * for the right tool.
 */
export function eraseAt(elements: PageElement[], tip: EraserTip, mode: EraserMode): PageElement[] | null {
  const out: PageElement[] = [];
  let changed = false;
  for (const el of elements) {
    if (!isStroke(el)) { out.push(el); continue; }
    if (mode === "stroke") {
      if (touches(el, tip)) changed = true;
      else out.push(el);
      continue;
    }
    const pieces = splitStroke(el, tip);
    if (!pieces) { out.push(el); continue; }
    changed = true;
    out.push(...pieces);
  }
  return changed ? out : null;
}
