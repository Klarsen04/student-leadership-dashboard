// Page-rail thumbnails: a page's handwriting, painted small.
//
// The rail already shows each page's real paper, so a thumbnail only has to add what
// was written on it — one transparent PNG laid over the paper. That keeps this cheap
// and, more importantly, keeps it honest: the miniature is composited from the same
// vectors as the page and the export (`paintElements`), never a screenshot of the
// canvas, so it can't drift from what the page actually holds.
//
// Everything is keyed by `plannerId:slot:version`, where the version is bumped by the
// viewer when *that page's* content changes. A key that's already been painted is
// returned from memory, so writing on page 4 doesn't repaint pages 1-3 — and undo,
// which bumps the version back, gets its own key rather than a stale bitmap.

import type { PageElement } from "./planner-ink";
import { paintElements } from "./planner-render";

/** Enough for a long rail plus a few versions of the page being written on. */
const MAX_CACHED = 240;
/** Drawn at 2× so the strokes don't go to mush on a retina screen. */
const SCALE = 2;

const cache = new Map<string, string>();

export const thumbKey = (plannerId: string, slot: number, version: number) =>
  `${plannerId}:${slot}:${version}`;

/** A thumbnail already in hand, if there is one. `""` means "that page is blank". */
export const cachedThumb = (key: string): string | undefined => cache.get(key);

/**
 * Paint `elements` at `height` px (times `SCALE`) and remember it under `key`.
 * Returns `""` for a page with nothing on it — there's no point in a transparent PNG,
 * and the caller can skip the `<img>` entirely.
 */
export function paintThumb(key: string, elements: PageElement[], aspect: number, height: number): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let src = "";
  if (elements.length) {
    const H = Math.max(1, Math.round(height * SCALE));
    const W = Math.max(1, Math.round(height * (aspect || 0.7) * SCALE));
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      paintElements(ctx, elements, W, H);
      src = canvas.toDataURL("image/png");
    }
  }

  cache.set(key, src);
  // Oldest first, which is close enough to least-recently-needed for a rail that's
  // scrolled in one direction at a time.
  while (cache.size > MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return src;
}

/** Forget a notebook's thumbnails — for when it's deleted. */
export function forgetThumbs(plannerId: string) {
  for (const key of [...cache.keys()]) if (key.startsWith(`${plannerId}:`)) cache.delete(key);
}
