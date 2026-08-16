// The viewport: how much of the page you're looking at, and which part.
//
// Zoom is a *view* transform, never a content one. Strokes and text boxes stay in
// normalised page coordinates (0..1), so zooming in to write a small note and
// zooming back out leaves the file byte-for-byte the same, and a page written at
// 4× looks right on a phone. The viewer applies this as a CSS transform on the
// page box, which is why the pointer maths elsewhere needs no zoom term at all:
// `getBoundingClientRect()` already reports the transformed box, so a client
// point divided by that rect *is* the page coordinate.
//
// The anchor maths is short because of that choice too. With `transform-origin:
// center`, a page point `u` (0..1) sits at
//
//     screen = centre + (u - 0.5) · size · z + offset
//
// so holding `u` still while the zoom changes only needs the offset to absorb the
// difference — see `zoomAbout`.

export interface Viewport {
  /** Scale, 1 = the whole page fits the frame. */
  z: number;
  /** Pan offset in CSS pixels, applied before the scale (so: frame pixels). */
  x: number;
  y: number;
}

/** The whole page, centred: what a page opens at. */
export const FIT: Viewport = { z: 1, x: 0, y: 0 };

/** Zooming out past the fitted page would only add letterboxing. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;

/** Steps the +/− buttons walk through, so the buttons land on round numbers. */
export const ZOOM_STEPS = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6];

export interface BoxSize {
  /** The page box's *layout* size in CSS pixels — its size at zoom 1. */
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const clampZoom = (z: number) => clamp(Number.isFinite(z) ? z : 1, MIN_ZOOM, MAX_ZOOM);

/** True when the whole page is in view, which is when page-turn gestures apply. */
export const isFit = (v: Viewport) => v.z <= MIN_ZOOM + 1e-3;

/**
 * Keep the zoomed page covering the frame: pan far enough to reach any edge, and
 * no further. At zoom 1 that pins the offset to zero, so a fitted page is always
 * centred however much it was dragged about beforehand.
 */
export function clampViewport(v: Viewport, box: BoxSize): Viewport {
  const z = clampZoom(v.z);
  const mx = ((z - 1) * box.w) / 2;
  const my = ((z - 1) * box.h) / 2;
  return { z, x: clamp(v.x || 0, -mx, mx), y: clamp(v.y || 0, -my, my) };
}

/**
 * Zoom to `nextZ` while keeping the page point `at` (normalised, as `norm()`
 * returns) under the same place on screen — the pinch midpoint, or the cursor.
 */
export function zoomAbout(v: Viewport, nextZ: number, box: BoxSize, at: { x: number; y: number }): Viewport {
  const z = clampZoom(nextZ);
  return clampViewport(
    {
      z,
      x: v.x + (at.x - 0.5) * box.w * (v.z - z),
      y: v.y + (at.y - 0.5) * box.h * (v.z - z),
    },
    box,
  );
}

/** Drag the page by a screen-pixel delta. */
export const panBy = (v: Viewport, dx: number, dy: number, box: BoxSize): Viewport =>
  clampViewport({ z: v.z, x: v.x + dx, y: v.y + dy }, box);

/** The next zoom step up or down from where we are. */
export function stepZoom(z: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((s) => s > z + 1e-3) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((s) => s < z - 1e-3) ?? MIN_ZOOM;
}

/** Whether a pan actually moved — used to hand a scroll on to the page turn. */
export const moved = (a: Viewport, b: Viewport) => a.x !== b.x || a.y !== b.y;

// ---- ink canvas resolution ----------------------------------------------------
// The ink canvas is sized to the *zoomed* box, so strokes stay crisp when you
// zoom in to write small — a canvas can't be scaled up after the fact the way a
// vector background can. That has to be capped, or a 6× zoom on a retina iPad
// would ask for a canvas of several hundred megabytes.

/** Widest a canvas may get, per side. Older iPads refuse much more than this. */
const MAX_CANVAS_SIDE = 4096;
/** And in total: ~16M device pixels is 64 MB of backing store. */
const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * Device pixels per CSS pixel to render the ink at, for a box of this displayed
 * size. Starts from the display's own ratio and gives it up only as far as the
 * caps demand, so nothing changes at ordinary zoom levels.
 */
export function inkPixelRatio(displayW: number, displayH: number, dpr: number): number {
  const w = Math.max(1, displayW);
  const h = Math.max(1, displayH);
  const bySide = MAX_CANVAS_SIDE / Math.max(w, h);
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (w * h));
  return Math.max(0.5, Math.min(dpr, bySide, byArea));
}
