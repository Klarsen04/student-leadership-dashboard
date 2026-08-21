// Selecting things on a page, and the transforms you can then apply to them.
//
// Everything here works on *objects*. A selection is a set of element identities,
// and moving, resizing, rotating or recolouring rewrites those elements' own
// coordinates and properties — a moved word is still a stroke with pressure, so it
// stays crisp at any zoom and can be moved again, recoloured, or undone. Nothing is
// ever flattened into an image, and the page format doesn't change: the same
// `PageElement[]` goes back to the server.
//
// Two coordinate notes, because both bite:
//
//  - Coordinates are normalised (0..1 of the page in each axis), so the page's
//    aspect ratio squashes one axis relative to the other. Anything that has to be
//    round on screen — a rotation, the nib's width around a stroke — is corrected
//    with `aspect` (page width / height). Translation and scaling need no
//    correction, since they're per-axis anyway.
//  - Strokes have no id in the file: they're identified by object identity through
//    the WeakMap below. Ids are per-session, cost nothing in the payload, and are
//    carried across a rewrite by `carryId`, so a stroke stays selected while you
//    drag it, recolour it and send it to the back.

import { type PageElement, type Stroke, type TextBox, isText } from "./planner-ink";
import { TOOL_WIDTH } from "./planner-render";

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Point = [number, number];

/** Which corner or edge of the selection a resize is pulling. */
export type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/** The area a selection gesture swept: a dragged rectangle, or a drawn loop. */
export type Region =
  | { mode: "rect"; a: Point; b: Point }
  | { mode: "lasso"; points: Point[] };

export type SelectMode = Region["mode"];

/** What the geometry needs to know about the page being edited. */
export interface PageGeom {
  /** Page width / height, to undo the squash that normalised coordinates apply. */
  aspect: number;
  /**
   * A text box's rendered height as a fraction of page height. The DOM knows this
   * exactly (text wraps), so the viewer passes a lookup; `estimateTextHeight` is
   * the fallback for a box that hasn't been measured yet.
   */
  textHeight?: (t: TextBox) => number | undefined;
}

// ---- identity -------------------------------------------------------------------

const idFor = new WeakMap<object, string>();
let nextId = 0;

/** A stable id for an element, for as long as this tab is open. */
export function elementId(el: PageElement): string {
  if (isText(el)) return el.id;
  let id = idFor.get(el);
  if (!id) {
    id = `s${++nextId}`;
    idFor.set(el, id);
  }
  return id;
}

/** Give a rewritten element the identity of the one it replaces. */
export function carryId<T extends PageElement>(from: PageElement, to: T): T {
  if (!isText(from)) idFor.set(to, elementId(from));
  return to;
}

export const isSelected = (el: PageElement, ids: ReadonlySet<string>) => ids.has(elementId(el));

export const selectedElements = (els: PageElement[], ids: ReadonlySet<string>) =>
  els.filter((el) => isSelected(el, ids));

// ---- bounds ---------------------------------------------------------------------

/** Half the width of a stroke's nib, as a fraction of page width. */
const nib = (s: Stroke) => (s.size * (TOOL_WIDTH[s.tool] ?? 1)) / 2;

/**
 * Rough height for an unmeasured text box: how many lines its text wraps to at
 * roughly half an em per character. Only ever used for a frame that hasn't been
 * rendered yet, so being a line out costs nothing lasting.
 */
export function estimateTextHeight(t: TextBox, aspect: number): number {
  const perChar = (0.5 * t.size) / aspect; // average character, as a page-width fraction
  const cols = Math.max(1, Math.floor(t.w / perChar));
  const lines = (t.text || " ")
    .split("\n")
    .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / cols)), 0);
  return lines * t.size * 1.35;
}

/** The axis-aligned box a rotated rectangle covers. */
export function rotatedBounds(b: Bounds, angle: number, aspect: number): Bounds {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [px, py] of [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x + b.w, b.y + b.h],
    [b.x, b.y + b.h],
  ] as Point[]) {
    // Into square (screen-shaped) space, rotate, and back.
    const u = (px - cx) * aspect;
    const v = py - cy;
    const x = cx + (u * cos - v * sin) / aspect;
    const y = cy + (u * sin + v * cos);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function elementBounds(el: PageElement, geom: PageGeom): Bounds {
  if (isText(el)) {
    const h = geom.textHeight?.(el) ?? estimateTextHeight(el, geom.aspect);
    const box = { x: el.x, y: el.y, w: el.w, h };
    return el.rot ? rotatedBounds(box, el.rot, geom.aspect) : box;
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of el.points) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  const p = nib(el);
  return { x: x0 - p, y: y0 - p * geom.aspect, w: x1 - x0 + p * 2, h: y1 - y0 + p * 2 * geom.aspect };
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (list.length === 0) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of list) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function selectionBounds(
  els: PageElement[],
  ids: ReadonlySet<string>,
  geom: PageGeom,
): Bounds | null {
  return unionBounds(selectedElements(els, ids).map((el) => elementBounds(el, geom)));
}

export const boundsContain = (b: Bounds, x: number, y: number, pad = 0) =>
  x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;

// ---- picking --------------------------------------------------------------------

/** Ray casting: is this point inside the loop? */
export function pointInPolygon(poly: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function regionBounds(r: Region): Bounds {
  const pts = r.mode === "rect" ? [r.a, r.b] : r.points;
  return unionBounds(pts.map(([x, y]) => ({ x, y, w: 0, h: 0 }))) ?? { x: 0, y: 0, w: 0, h: 0 };
}

const regionContains = (r: Region, x: number, y: number) =>
  r.mode === "rect" ? boundsContain(regionBounds(r), x, y) : pointInPolygon(r.points, x, y);

/**
 * How much of a stroke has to fall inside the region for it to come along. Strokes
 * are never cut in half — half a letter isn't a thing you'd want to drag — so a
 * loop drawn round most of a word takes the whole word.
 */
const STROKE_SHARE = 0.5;

export function pick(els: PageElement[], r: Region, geom: PageGeom): Set<string> {
  const ids = new Set<string>();
  if (r.mode === "lasso" && r.points.length < 3) return ids;
  for (const el of els) {
    if (isText(el)) {
      // A text box comes along when its middle is inside: it's one object, and
      // asking someone to loop a whole paragraph would be worse.
      const b = elementBounds(el, geom);
      if (regionContains(r, b.x + b.w / 2, b.y + b.h / 2)) ids.add(elementId(el));
      continue;
    }
    if (el.points.length === 0) continue;
    let hits = 0;
    for (const [x, y] of el.points) if (regionContains(r, x, y)) hits++;
    if (hits / el.points.length >= STROKE_SHARE) ids.add(elementId(el));
  }
  return ids;
}

/** The topmost element under a point — what a tap selects. */
export function pickAt(els: PageElement[], x: number, y: number, geom: PageGeom): string | null {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    const b = elementBounds(el, geom);
    if (!boundsContain(b, x, y, 0.004)) continue;
    if (isText(el)) return elementId(el);
    // Strokes are thin: being in the bounding box isn't being on the ink.
    const reach = Math.max(0.008, nib(el) * 2);
    for (const [px, py] of el.points) {
      const dx = px - x;
      const dy = (py - y) / geom.aspect;
      if (dx * dx + dy * dy <= reach * reach) return elementId(el);
    }
  }
  return null;
}

// ---- transforms -----------------------------------------------------------------

const mapSelected = (
  els: PageElement[],
  ids: ReadonlySet<string>,
  fn: (el: PageElement) => PageElement,
) => els.map((el) => (isSelected(el, ids) ? carryId(el, fn(el)) : el));

export function translate(els: PageElement[], ids: ReadonlySet<string>, dx: number, dy: number) {
  if (!dx && !dy) return els;
  return mapSelected(els, ids, (el) =>
    isText(el)
      ? { ...el, x: el.x + dx, y: el.y + dy }
      : { ...el, points: el.points.map(([x, y, p]) => [x + dx, y + dy, p] as [number, number, number]) },
  );
}

export interface ScaleSpec {
  /** The anchor that stays put — the corner opposite the handle being pulled. */
  ax: number;
  ay: number;
  sx: number;
  sy: number;
}

export function scale(els: PageElement[], ids: ReadonlySet<string>, s: ScaleSpec) {
  const { ax, ay, sx, sy } = s;
  // A stroke's width is a fraction of page width, so a squash in one axis only
  // thickens the nib by its share: the geometric mean is what looks right.
  const nibScale = Math.sqrt(Math.abs(sx * sy)) || 1;
  return mapSelected(els, ids, (el) =>
    isText(el)
      ? {
          ...el,
          x: ax + (el.x - ax) * sx,
          y: ay + (el.y - ay) * sy,
          w: Math.max(0.02, el.w * sx),
          size: Math.max(0.004, el.size * sy),
        }
      : {
          ...el,
          size: el.size * nibScale,
          points: el.points.map(
            ([x, y, p]) => [ax + (x - ax) * sx, ay + (y - ay) * sy, p] as [number, number, number],
          ),
        },
  );
}

export function rotate(
  els: PageElement[],
  ids: ReadonlySet<string>,
  centre: { x: number; y: number },
  angle: number,
  geom: PageGeom,
) {
  if (!angle) return els;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { aspect } = geom;
  const spin = (x: number, y: number): [number, number] => {
    const u = (x - centre.x) * aspect;
    const v = y - centre.y;
    return [centre.x + (u * cos - v * sin) / aspect, centre.y + (u * sin + v * cos)];
  };
  return mapSelected(els, ids, (el) => {
    if (isText(el)) {
      // Typed text stays typed: the box turns with a rotation of its own rather
      // than becoming a picture of itself.
      const h = geom.textHeight?.(el) ?? estimateTextHeight(el, aspect);
      const [cx, cy] = spin(el.x + el.w / 2, el.y + h / 2);
      return { ...el, x: cx - el.w / 2, y: cy - h / 2, rot: (el.rot ?? 0) + angle };
    }
    return {
      ...el,
      points: el.points.map(([x, y, p]) => {
        const [nx, ny] = spin(x, y);
        return [nx, ny, p] as [number, number, number];
      }),
    };
  });
}

export function recolor(els: PageElement[], ids: ReadonlySet<string>, color: string) {
  return mapSelected(els, ids, (el) => ({ ...el, color }));
}

/** Move the selection to the top or the bottom of the page's stack. */
export function reorder(els: PageElement[], ids: ReadonlySet<string>, to: "front" | "back") {
  const picked = els.filter((el) => isSelected(el, ids));
  const rest = els.filter((el) => !isSelected(el, ids));
  return to === "front" ? [...rest, ...picked] : [...picked, ...rest];
}

export function remove(els: PageElement[], ids: ReadonlySet<string>) {
  return els.filter((el) => !isSelected(el, ids));
}

// ---- copies and the clipboard ---------------------------------------------------

let textSeq = 0;

/** A deep copy with a fresh identity, so the original and the copy move apart. */
export function cloneElement(el: PageElement): PageElement {
  if (isText(el)) return { ...el, id: `t-${Date.now().toString(36)}-${++textSeq}` };
  return { ...el, points: el.points.map((p) => [...p] as [number, number, number]) };
}

/**
 * Add copies of `source` to the page, offset a little so they're visibly on top of
 * whatever they came from, and hand back the ids to select.
 */
export function addCopies(
  els: PageElement[],
  source: PageElement[],
  offset: { dx: number; dy: number },
): { elements: PageElement[]; ids: Set<string> } {
  const ids = new Set<string>();
  const copies = source.map((el) => {
    const copy = cloneElement(el);
    const moved = isText(copy)
      ? { ...copy, x: copy.x + offset.dx, y: copy.y + offset.dy }
      : {
          ...copy,
          points: (copy as Stroke).points.map(
            ([x, y, p]) => [x + offset.dx, y + offset.dy, p] as [number, number, number],
          ),
        };
    ids.add(elementId(moved));
    return moved;
  });
  return { elements: [...els, ...copies], ids };
}

/**
 * The offset that puts `source`'s middle under `(x, y)`, pulled back so it stays on the
 * writable paper.
 *
 * Paste uses this to land where you point rather than where the copy came from: pasting
 * onto another page used to drop the content at its old coordinates, which on a page you'd
 * scrolled away from meant "somewhere off the top". The ghost that follows the pointer is
 * drawn from the same offset, so what you see under the pointer is exactly where it lands.
 */
export function placementOffset(
  source: PageElement[],
  x: number,
  y: number,
  geom: PageGeom,
  area: Bounds,
): { dx: number; dy: number } {
  const b = unionBounds(source.map((el) => elementBounds(el, geom)));
  if (!b) return { dx: 0, dy: 0 };
  return clampMove(b, x - (b.x + b.w / 2), y - (b.y + b.h / 2), area);
}

// One clipboard for the session, so a lasso on one page pastes onto another — or
// into another notebook. Deliberately not the system clipboard: these are objects
// with pressure, not an image, and nothing else would know what to do with them.
let clipboard: PageElement[] = [];

export const setClipboard = (els: PageElement[]) => {
  clipboard = els.map(cloneElement);
};
export const getClipboard = () => clipboard;
export const clipboardSize = () => clipboard.length;

// ---- resizing ------------------------------------------------------------------

/** The smallest a selection may be pulled down to, as a fraction of the page. */
const MIN_SIZE = 0.01;

/**
 * An axis with less extent than this is treated as having none: a single ruled line
 * of writing, or an underline, is only as tall as its nib. Dividing the pointer's
 * travel by a hairline gives a scale factor in the hundreds, so such an axis gets no
 * say in how far a corner drag scales.
 */
const FLAT = 0.02;

/** A selection can't be grown past the page it's on. */
const MAX_EXTENT = 1;

const growthCap = (extent: number) => (extent > 1e-6 ? MAX_EXTENT / extent : Infinity);

const ANCHORS: Record<Handle, { x: number; y: number }> = {
  nw: { x: 1, y: 1 }, n: { x: 0.5, y: 1 }, ne: { x: 0, y: 1 },
  e: { x: 0, y: 0.5 }, se: { x: 0, y: 0 }, s: { x: 0.5, y: 0 },
  sw: { x: 1, y: 0 }, w: { x: 1, y: 0.5 },
};

const CORNERS: Handle[] = ["nw", "ne", "se", "sw"];

/**
 * The scale a resize gesture asks for: the dragged edge follows the pointer while
 * the opposite one stays put. Corners keep the selection's proportions — pulling a
 * paragraph of handwriting diagonally shouldn't stretch it — so the axis you moved
 * furthest sets both factors; edges scale their own axis alone. A flat selection
 * only votes with the axis it actually has.
 */
export function resizeScale(b: Bounds, handle: Handle, px: number, py: number): ScaleSpec {
  const a = ANCHORS[handle];
  const ax = b.x + b.w * a.x;
  const ay = b.y + b.h * a.y;
  const holdsX = handle === "n" || handle === "s";
  const holdsY = handle === "e" || handle === "w";
  // Width and height the pointer implies, measured from the anchor.
  const w = holdsX ? b.w : Math.max(MIN_SIZE, Math.abs(px - ax));
  const h = holdsY ? b.h : Math.max(MIN_SIZE, Math.abs(py - ay));
  // A flat axis is measured against FLAT rather than its real extent, so pulling the
  // edge handle of an underline can still stretch it — by a sane factor, not by the
  // ratio of a finger's travel to a hairline.
  const spanX = Math.max(b.w, FLAT);
  const spanY = Math.max(b.h, FLAT);
  let sx = holdsX ? 1 : w / spanX;
  let sy = holdsY ? 1 : h / spanY;
  let capX = growthCap(spanX);
  let capY = growthCap(spanY);
  if (CORNERS.includes(handle)) {
    // Proportions are kept, so the axis with real extent decides — and one cap has
    // to serve both, or the selection would distort as it hit the page edge.
    const live = (span: number) => span > FLAT;
    sx = sy = !live(b.w)
      ? sy
      : !live(b.h)
        ? sx
        : Math.abs(sx - 1) > Math.abs(sy - 1)
          ? sx
          : sy;
    capX = capY = Math.min(capX, capY);
  }
  return {
    ax,
    ay,
    sx: Math.min(Math.max(0.02, sx), capX),
    sy: Math.min(Math.max(0.02, sy), capY),
  };
}

/** Where a handle sits, as a fraction of the selection's box. */
export const handleAt = (handle: Handle): { x: number; y: number } => ({
  x: 1 - ANCHORS[handle].x,
  y: 1 - ANCHORS[handle].y,
});

export const HANDLE_CURSOR: Record<Handle, string> = {
  nw: "nwse-resize", se: "nwse-resize",
  ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize",
  e: "ew-resize", w: "ew-resize",
};

// ---- keeping things on the paper -------------------------------------------------

/**
 * Trim a drag so the selection can't be pushed off the writable paper, where ink is
 * clipped and would look deleted. Only ever pulls the movement back, never pushes.
 */
export function clampMove(
  b: Bounds,
  dx: number,
  dy: number,
  area: Bounds,
): { dx: number; dy: number } {
  const fitsX = b.w <= area.w;
  const fitsY = b.h <= area.h;
  let ndx = dx;
  let ndy = dy;
  if (fitsX) ndx = Math.min(Math.max(dx, area.x - b.x), area.x + area.w - (b.x + b.w));
  if (fitsY) ndy = Math.min(Math.max(dy, area.y - b.y), area.y + area.h - (b.y + b.h));
  return { dx: ndx, dy: ndy };
}

/** The angle a rotation gesture is at, in radians, measured in screen-round space. */
export function angleTo(centre: { x: number; y: number }, x: number, y: number, aspect: number) {
  return Math.atan2(y - centre.y, (x - centre.x) * aspect);
}

/** Snap to 15° while shift is held, the way every drawing tool does it. */
export const snapAngle = (a: number) => Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
