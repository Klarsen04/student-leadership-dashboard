// Reusable elements: a bit of a page saved to be stamped down again elsewhere.
//
// A saved element stays **vector** — the strokes and text boxes it was made from, not a
// picture of them. That's what lets a stamped copy be moved, resized, recoloured and
// erased like anything else on the page, and stay crisp at any zoom.
//
// It's stored in its own space rather than the page's: x runs 0..aspect across it, y runs
// 0..1 down it, and every width is relative to its own height. Page coordinates are
// normalised per page (and pages come in different shapes and sizes), so a sticker held
// in them would stretch the moment it was stamped onto a page of a different aspect.
// Holding it in its own square space and scaling by a target height keeps it undistorted
// wherever it lands.

import { ELEMENT_STORE, idbAll, idbDelete, idbGet, idbPut } from "@/lib/planner-library";
import { isText, type PageElement, type Stroke, type TextBox } from "@/lib/planner-ink";
import { elementBounds, unionBounds, type Bounds, type PageGeom } from "@/lib/planner-select";

/** A sticker with more pieces than this came from a whole page, not a doodle. */
const MAX_PIECES = 400;

/** Default stamped height, as a fraction of page height. */
export const STAMP_HEIGHT = 0.14;

/** The smallest and largest a stamp may be asked to land at. */
export const MIN_STAMP = 0.02;
export const MAX_STAMP = 1;

export interface SavedElement {
  id: string;
  name: string;
  createdAt: number;
  /** Width / height as drawn on screen, so a stamp keeps its shape. */
  aspect: number;
  /** Content in the sticker's own space: x across 0..aspect, y down 0..1. */
  elements: PageElement[];
}

// ---- capturing --------------------------------------------------------------------

/**
 * Lift a selection into a sticker, without touching the page it came from.
 *
 * Sizes are rewritten relative to the sticker's height: a stroke's `size` is a fraction
 * of *page width* on a page, which means nothing once the sticker leaves that page, so
 * it's converted here and converted back when stamped.
 */
export function captureElements(
  picked: PageElement[],
  geom: PageGeom,
  name: string,
): Omit<SavedElement, "id" | "createdAt"> {
  if (!picked.length) throw new Error("Nothing selected to save.");
  if (picked.length > MAX_PIECES) {
    throw new Error(`That's ${picked.length} pieces — a saved element can hold ${MAX_PIECES}.`);
  }
  const box = unionBounds(picked.map((el) => elementBounds(el, geom)));
  if (!box || box.w <= 0 || box.h <= 0) throw new Error("That selection has no size to save.");
  const A = geom.aspect;
  // In square space, so the sticker's aspect is what the eye saw.
  const w = box.w * A;
  const h = box.h;
  const aspect = w / h;
  /** Page point → sticker space. */
  const at = (x: number, y: number): [number, number] => [(x * A - box.x * A) / h, (y - box.y) / h];
  const elements = picked.map((el) => toSticker(el, at, A, h));
  return { name: cleanName(name), aspect, elements };
}

function toSticker(
  el: PageElement,
  at: (x: number, y: number) => [number, number],
  A: number,
  h: number,
): PageElement {
  if (isText(el)) {
    const [x, y] = at(el.x, el.y);
    return { ...el, x, y, w: (el.w * A) / h, size: el.size / h };
  }
  const s = el as Stroke;
  return {
    ...s,
    size: (s.size * A) / h,
    points: s.points.map(([x, y, p]) => {
      const [u, v] = at(x, y);
      return [u, v, p] as [number, number, number];
    }),
  };
}

// ---- stamping ---------------------------------------------------------------------

export interface StampAt {
  /** Where the sticker's centre lands, in page coordinates. */
  x: number;
  y: number;
  /** How tall it lands, as a fraction of page height. */
  height?: number;
  /** The page's width / height. */
  aspect: number;
  /** Fresh ids for stamped text boxes — a page can't hold two boxes with one id. */
  newId?: () => string;
}

/**
 * A stamped copy of a sticker, in the page's own coordinates. Nothing is mutated and
 * nothing is merged: the result is ordinary page elements, appended like any other edit.
 */
export function stampElements(saved: SavedElement, at: StampAt): PageElement[] {
  const A = at.aspect;
  const H = Math.min(MAX_STAMP, Math.max(MIN_STAMP, at.height ?? STAMP_HEIGHT));
  // The sticker's centre sits at (aspect/2, 1/2) in its own space; put that at (x, y).
  const cu = at.x * A - (saved.aspect / 2) * H;
  const cv = at.y - H / 2;
  /** Sticker space → page coordinates. */
  const to = (u: number, v: number): [number, number] => [(cu + u * H) / A, cv + v * H];
  return saved.elements.map((el) => {
    if (isText(el)) {
      const t = el as TextBox;
      const [x, y] = to(t.x, t.y);
      return { ...t, id: at.newId?.() ?? freshTextId(), x, y, w: (t.w * H) / A, size: t.size * H };
    }
    const s = el as Stroke;
    return {
      ...s,
      size: (s.size * H) / A,
      points: s.points.map(([u, v, p]) => {
        const [x, y] = to(u, v);
        return [x, y, p] as [number, number, number];
      }),
    };
  });
}

/** Where a stamp would land, for a drop preview. */
export function stampBounds(saved: SavedElement, at: StampAt): Bounds {
  const H = Math.min(MAX_STAMP, Math.max(MIN_STAMP, at.height ?? STAMP_HEIGHT));
  const w = (saved.aspect * H) / at.aspect;
  return { x: at.x - w / 2, y: at.y - H / 2, w, h: H };
}

const WHOLE_PAGE: Bounds = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Nudge the landing point so the whole stamp fits on the writable paper — ink outside
 * that area is clipped, and a sticker half of which never appears reads as a bug. A stamp
 * too big for the area is centred in it rather than jammed into a corner.
 */
export function clampStamp(saved: SavedElement, at: StampAt, area: Bounds = WHOLE_PAGE): { x: number; y: number } {
  const b = stampBounds(saved, at);
  const fit = (lo: number, span: number, size: number, want: number) =>
    size >= span ? lo + span / 2 : Math.min(lo + span - size / 2, Math.max(lo + size / 2, want));
  return {
    x: fit(area.x, area.w, b.w, at.x),
    y: fit(area.y, area.h, b.h, at.y),
  };
}

const freshTextId = () => `t${Math.random().toString(36).slice(2, 9)}`;

// ---- the library ------------------------------------------------------------------

export async function listSavedElements(): Promise<SavedElement[]> {
  const all = await idbAll<SavedElement>(ELEMENT_STORE);
  return all
    .filter((e) => e?.id && Array.isArray(e.elements) && e.elements.length && e.aspect > 0)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveElement(draft: Omit<SavedElement, "id" | "createdAt">): Promise<SavedElement> {
  const taken = new Set((await listSavedElements()).map((e) => e.id));
  let id = `e-${Math.random().toString(36).slice(2, 10)}`;
  for (let i = 0; taken.has(id) && i < 50; i++) id = `e-${Math.random().toString(36).slice(2, 10)}`;
  const saved: SavedElement = { ...draft, name: cleanName(draft.name), id, createdAt: Date.now() };
  await idbPut(ELEMENT_STORE, saved);
  return saved;
}

export async function renameSavedElement(id: string, name: string): Promise<void> {
  const cur = await idbGet<SavedElement>(ELEMENT_STORE, id);
  if (cur) await idbPut(ELEMENT_STORE, { ...cur, name: cleanName(name) || cur.name });
}

export async function deleteSavedElement(id: string): Promise<void> {
  await idbDelete(ELEMENT_STORE, id);
}

const cleanName = (name: string) => name.trim().slice(0, 40) || "Saved element";

// ---- previews ---------------------------------------------------------------------

export interface StickerPreview {
  /** viewBox for an SVG drawn in the sticker's own space. */
  viewBox: string;
  strokes: { d: string; color: string; width: number; opacity: number }[];
  texts: { x: number; y: number; size: number; color: string; text: string; font: string }[];
}

/**
 * The sticker as SVG, for a thumbnail. Drawn from the same vector data as the page —
 * there's no stored image to go stale, and a preview costs no extra bytes in the
 * library.
 */
export function stickerPreview(saved: SavedElement): StickerPreview {
  const strokes: StickerPreview["strokes"] = [];
  const texts: StickerPreview["texts"] = [];
  for (const el of saved.elements) {
    if (isText(el)) {
      const t = el as TextBox;
      texts.push({ x: t.x, y: t.y + t.size, size: t.size, color: t.color, text: t.text, font: t.font });
      continue;
    }
    const s = el as Stroke;
    if (s.points.length < 1) continue;
    const d = s.points
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(4)} ${y.toFixed(4)}`)
      .join(" ");
    strokes.push({
      d: s.points.length === 1 ? `${d} L${s.points[0][0].toFixed(4)} ${s.points[0][1].toFixed(4)}` : d,
      color: s.color,
      width: s.size * (s.tool === "highlighter" ? 6 : 1),
      opacity: s.tool === "highlighter" ? 0.35 : 1,
    });
  }
  return { viewBox: `0 0 ${saved.aspect.toFixed(4)} 1`, strokes, texts };
}
