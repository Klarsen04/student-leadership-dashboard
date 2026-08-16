// Turning a roughly drawn path into the shape it was meant to be.
//
// A recognised shape is still a stroke: the same points-and-pressure object the pen
// produces, just with ideal coordinates. That keeps everything downstream working
// unchanged — it can be selected, moved, resized, rotated, recoloured, erased,
// undone, saved and exported exactly like handwriting, and it stays vector-crisp at
// any zoom. Nothing is rasterised and no new element type is needed.
//
// The approach is propose-and-score rather than a decision tree: the drawn path is
// reduced to corners, a few candidate ideal shapes are proposed in order of how much
// nicer they are than what was drawn, and the first one that actually fits the path
// wins. If none fits, recognition declines and the drawing is kept as-is — refusing
// is always better than turning someone's careful sketch into the wrong triangle.
//
// All the geometry runs in "square" space (x multiplied by the page's aspect ratio),
// because normalised page coordinates squash one axis: a circle drawn round on screen
// is an ellipse in 0..1 coordinates, and every tolerance here is a distance that has
// to mean the same thing in both directions.

import type { Stroke } from "./planner-ink";

type Pt = [number, number];

export type ShapeKind =
  | "line"
  | "arrow"
  | "circle"
  | "ellipse"
  | "rectangle"
  | "square"
  | "triangle"
  | "polygon"
  | "polyline";

export interface Recognised {
  kind: ShapeKind;
  points: [number, number, number][];
}

// ---- tolerances -----------------------------------------------------------------

/** Below this diagonal a mark is a dot, a tick or a full stop: never a shape. */
const MIN_DIAGONAL = 0.04;

/**
 * How far a corner has to turn to count as one. A rectangle turns 90° at each corner
 * and a triangle 60–120°, so this can be strict — and has to be: a gentle bend read as
 * a corner turns a flat oval into a triangle.
 */
const MIN_TURN = 0.9; // ~52°

/** Douglas–Peucker tolerance, as a share of the drawing's diagonal. */
const CORNER_EPS = 0.035;

/** Corners closer together than this share of the diagonal are the same corner. */
const MERGE_EPS = 0.12;

/** The window either side of a point that the turn is measured over. */
const CORNER_WINDOW = 0.06;

/** ...and the fewest samples it will measure through, however short that window is. */
const MIN_WINDOW_SAMPLES = 4;

/**
 * How far either side of a vertex to hunt for the sharpest turn, as a share of the
 * window. Simplification puts its vertex near a corner rather than exactly on it, and a
 * window straddling a corner from one sample away reads about half the real turn.
 */
const PEAK_REACH = 0.5;

/**
 * How far the drawn path may sit from a candidate before the candidate is rejected,
 * as a share of the diagonal. Generous enough for a hurried circle, tight enough that
 * a deliberate squiggle is left alone.
 */
const FIT_GATE = 0.09;

/**
 * The gate for a curve proposed over a path that *did* show corners. An ellipse
 * inscribed in a rectangle sits only about 0.045 of the diagonal from it — inside the
 * ordinary tolerance — and quietly turning a jagged box into an oval is worse than
 * leaving it as drawn, so that claim has to fit tightly.
 */
const CURVE_GATE = 0.035;

/** A shape whose axes are this close to equal is meant to be round / square. */
const EVEN_ENOUGH = 0.16;

/**
 * Straightening is only ever an improvement if the path was nearly straight already.
 * A polyline through detected corners fits its own path by construction, so the fit
 * alone can't reject one — but a wiggle, a scribble or handwriting is *much* longer
 * than the shape it would be flattened to, and that ratio can.
 */
const MAX_SLACK = 1.25;

/** More corners than this is a scribble, not a polygon someone meant to draw. */
const MAX_CORNERS = 8;

/** A polygon's or polyline's shortest side, as a share of the diagonal. */
const MIN_SIDE = 0.12;

/** Within this of an axis, a rectangle was meant to be straight on the page. */
const AXIS_SNAP = 0.22; // ~12.5°

// ---- small geometry --------------------------------------------------------------

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function bboxOf(pts: Pt[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function pathLength(pts: Pt[]) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]);
  return d;
}

function dedupe(pts: Pt[], eps: number): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) if (!out.length || dist(out[out.length - 1], p) > eps) out.push(p);
  return out;
}

/**
 * One pass of a three-tap average, to take the tremor out before measuring anything.
 * A corner survives it — the turn window is wider than three samples — but the
 * sample-to-sample noise that would otherwise read as a corner does not. It also keeps
 * a shaky bounding box from inheriting a single spike.
 */
function smooth(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    out.push([
      (pts[i - 1][0] + 2 * pts[i][0] + pts[i + 1][0]) / 4,
      (pts[i - 1][1] + 2 * pts[i][1] + pts[i + 1][1]) / 4,
    ]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Distance from p to the infinite line through a and b. */
function lineDistance(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  if (l < 1e-9) return dist(p, a);
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / l;
}

/** Distance from p to the segment ab — the line version overstates it past the ends. */
function segDistance(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-12) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function polyDistance(p: Pt, poly: Pt[]) {
  let d = Infinity;
  for (let i = 1; i < poly.length; i++) d = Math.min(d, segDistance(p, poly[i - 1], poly[i]));
  return d;
}

/** How far the drawn path sits from a candidate shape, on average. */
function fitError(pts: Pt[], poly: Pt[]) {
  if (poly.length < 2) return Infinity;
  let sum = 0;
  for (const p of pts) {
    const d = polyDistance(p, poly);
    sum += d * d;
  }
  return Math.sqrt(sum / pts.length);
}

/** The interior angle at b, in radians. */
function interiorAngle(a: Pt, b: Pt, c: Pt) {
  const ux = a[0] - b[0], uy = a[1] - b[1];
  const vx = c[0] - b[0], vy = c[1] - b[1];
  const lu = Math.hypot(ux, uy);
  const lv = Math.hypot(vx, vy);
  if (lu < 1e-9 || lv < 1e-9) return Math.PI;
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (lu * lv)));
  return Math.acos(cos);
}

/** Douglas–Peucker, as indices: the fewest points that still describe the path. */
function simplifyIdx(pts: Pt[], eps: number): number[] {
  if (pts.length < 3) return pts.map((_, i) => i);
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1;
    let fd = 0;
    for (let i = a + 1; i < b; i++) {
      const d = lineDistance(pts[i], pts[a], pts[b]);
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0 && fd > eps) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < pts.length; i++) if (keep[i] === 1) out.push(i);
  return out;
}

/**
 * The samples within `window` of i, walking one way, nearest first — at least
 * `minSamples` of them, however short the window is. Both measures matter: on a densely
 * sampled path the distance is what counts, but two or three samples is too few to fit a
 * direction through.
 */
function windowOf(
  pts: Pt[],
  i: number,
  dir: -1 | 1,
  window: number,
  closed: boolean,
  minSamples = MIN_WINDOW_SAMPLES,
): number[] {
  const n = closed ? pts.length - 1 : pts.length; // a ring's last point repeats its first
  const out: number[] = [];
  let at = i;
  let travelled = 0;
  while (travelled < window || out.length < minSamples) {
    const next = closed ? (at + dir + n) % n : at + dir;
    if (next < 0 || next >= n || next === i) break;
    travelled += dist(pts[at], pts[next]);
    at = next;
    out.push(at);
  }
  return out;
}

/**
 * Which way the path leaves i, as the principal axis of a window of samples, signed to
 * point away from i.
 *
 * Fitting the whole window rather than chording to its last sample is what makes this
 * survive a jittery hand: as a chord, one stray sample is the entire measurement, but as
 * one of five points fitted it barely tilts the line.
 */
function fitDirection(pts: Pt[], i: number, win: number[]): Pt | null {
  if (!win.length) return null;
  const all = [i, ...win];
  let mx = 0;
  let my = 0;
  for (const k of all) {
    mx += pts[k][0];
    my += pts[k][1];
  }
  mx /= all.length;
  my /= all.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const k of all) {
    const dx = pts[k][0] - mx;
    const dy = pts[k][1] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dir: Pt = [Math.cos(angle), Math.sin(angle)];
  const far = pts[win[win.length - 1]];
  const away = (far[0] - pts[i][0]) * dir[0] + (far[1] - pts[i][1]) * dir[1];
  return away < 0 ? [-dir[0], -dir[1]] : dir;
}

/** How far the path's direction swings across i, over a short window either side. */
function turnAt(pts: Pt[], i: number, window: number, closed: boolean) {
  const back = fitDirection(pts, i, windowOf(pts, i, -1, window, closed));
  const fwd = fitDirection(pts, i, windowOf(pts, i, 1, window, closed));
  if (!back || !fwd) return 0;
  const cos = Math.min(1, Math.max(-1, back[0] * fwd[0] + back[1] * fwd[1]));
  return Math.PI - Math.acos(cos);
}

/**
 * The sharpest turn the *drawn* path makes near one of its own points.
 *
 * This is the test that tells a tick from a bend. A corner concentrates its whole turn
 * into a couple of points, so a short window sees all of it; an arc spreads the same
 * turn over its full length, so a short window sees almost none. Measuring the turn on
 * the simplified polyline instead can't tell them apart — there, a sweeping arc and a
 * sharp elbow are both "one vertex that turns 90°".
 *
 * It's a peak over a short reach rather than a reading at one point because that's what
 * the question really is: simplification points at roughly where the path bends, and
 * this asks whether anything near there bends sharply.
 */
function localTurn(pts: Pt[], i: number, window: number, closed: boolean) {
  let peak = turnAt(pts, i, window, closed);
  for (const dir of [-1, 1] as const) {
    for (const k of windowOf(pts, i, dir, window * PEAK_REACH, closed, 1)) {
      peak = Math.max(peak, turnAt(pts, k, window, closed));
    }
  }
  return peak;
}

/** Collapse corners that are really one corner the pen rounded off. */
function mergeClose(verts: Pt[], eps: number, closed: boolean): Pt[] {
  if (verts.length < 2) return verts;
  const out: Pt[] = [verts[0]];
  for (let i = 1; i < verts.length; i++) {
    if (dist(out[out.length - 1], verts[i]) > eps) out.push(verts[i]);
  }
  if (closed && out.length > 2 && dist(out[0], out[out.length - 1]) <= eps) out.pop();
  return out;
}

// ---- corners ---------------------------------------------------------------------

/**
 * The corners of a path: the simplification's vertices, minus the ones that don't
 * actually turn.
 *
 * The filter earns its keep twice over. Douglas–Peucker anchors the path's two ends,
 * which for a ring is wherever the pen happened to start — often the middle of an edge
 * — so without it a rectangle started mid-side comes back as a pentagon. And it's what
 * stops a curve being read as a set of elbows.
 */
function cornersOf(path: Pt[], eps: number, window: number, closed: boolean): Pt[] {
  const idx = simplifyIdx(path, eps);
  const ring = closed ? idx.slice(0, -1) : idx; // the ring's last index repeats its first
  const kept = ring.filter((i, n) => {
    // An open path always keeps its two ends: they're where it starts and stops, not
    // corners it has to justify.
    if (!closed && (n === 0 || n === ring.length - 1)) return true;
    return localTurn(path, i, window, closed) >= MIN_TURN;
  });
  return mergeClose(kept.map((i) => path[i]), eps * (MERGE_EPS / CORNER_EPS), closed);
}

// ---- ideal shapes ----------------------------------------------------------------

/**
 * Samples for a curve: enough that it reads as smooth, no more than that. A small
 * circle doesn't need 96 points, and the payload is per-point.
 */
const samplesFor = (perimeter: number) =>
  Math.max(24, Math.min(96, Math.ceil(perimeter / 0.02)));

function ellipsePath(box: Box, radii?: { rx: number; ry: number }): Pt[] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rx = radii ? radii.rx : box.w / 2;
  const ry = radii ? radii.ry : box.h / 2;
  const n = samplesFor(Math.PI * (rx + ry));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return out;
}

const closePath = (verts: Pt[]): Pt[] => [...verts, verts[0]];

const rectPath = (box: Box): Pt[] =>
  closePath([
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x + box.w, box.y + box.h],
    [box.x, box.y + box.h],
  ]);

/**
 * A rectangle from a four-cornered ring that isn't straight on the page: the four
 * edges vote on one angle (through their fourth harmonic, so directions 90° apart
 * agree), and the corners are rebuilt square on those axes.
 */
function rotatedRectPath(verts: Pt[]): Pt[] | null {
  if (verts.length !== 4) return null;
  let sc = 0;
  let ss = 0;
  for (let i = 0; i < 4; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % 4];
    const len = dist(a, b);
    if (len < 1e-9) return null;
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    sc += len * Math.cos(4 * th);
    ss += len * Math.sin(4 * th);
  }
  if (Math.hypot(sc, ss) < 1e-9) return null;
  const angle = Math.atan2(ss, sc) / 4;
  const ux: Pt = [Math.cos(angle), Math.sin(angle)];
  const uy: Pt = [-Math.sin(angle), Math.cos(angle)];
  const along = verts.map((p) => p[0] * ux[0] + p[1] * ux[1]);
  const across = verts.map((p) => p[0] * uy[0] + p[1] * uy[1]);
  const a0 = Math.min(...along), a1 = Math.max(...along);
  const b0 = Math.min(...across), b1 = Math.max(...across);
  const at = (a: number, b: number): Pt => [a * ux[0] + b * uy[0], a * ux[1] + b * uy[1]];
  return closePath([at(a0, b0), at(a1, b0), at(a1, b1), at(a0, b1)]);
}

/** Is this four-cornered ring square-ish at every corner? */
function isRightAngled(verts: Pt[]) {
  if (verts.length !== 4) return false;
  return verts.every((p, i) => {
    const prev = verts[(i + 3) % 4];
    const next = verts[(i + 1) % 4];
    return Math.abs(interiorAngle(prev, p, next) - Math.PI / 2) < 0.35; // ~20°
  });
}

/** Is this ring's longest edge lined up with the page? */
function isAxisAligned(verts: Pt[]) {
  return verts.every((p, i) => {
    const q = verts[(i + 1) % verts.length];
    const th = Math.abs(Math.atan2(q[1] - p[1], q[0] - p[0])) % Math.PI;
    return Math.min(th, Math.abs(th - Math.PI / 2), Math.abs(th - Math.PI)) < AXIS_SNAP;
  });
}

/**
 * An arrow: a long shaft with a head folded back over it. Deliberately strict — a
 * checkmark and a "V" are two segments too, and neither should sprout an arrowhead.
 */
function arrowPath(verts: Pt[]): Pt[] | null {
  if (verts.length < 3 || verts.length > 4) return null;
  const tail = verts[0];
  const tip = verts[1];
  const shaft = dist(tail, tip);
  if (shaft < 1e-6) return null;
  const dir: Pt = [(tip[0] - tail[0]) / shaft, (tip[1] - tail[1]) / shaft];
  let barbLen = 0;
  for (const barb of verts.slice(2)) {
    const len = dist(tip, barb);
    if (len < 0.06 * shaft || len > 0.5 * shaft) return null;
    const bx = (barb[0] - tip[0]) / len;
    const by = (barb[1] - tip[1]) / len;
    if (bx * dir[0] + by * dir[1] > -0.4) return null; // must fold back over the shaft
    barbLen += len;
  }
  barbLen = Math.min(barbLen / (verts.length - 2), 0.32 * shaft);
  const back = Math.atan2(-dir[1], -dir[0]);
  const spread = 0.4; // ~23° either side
  const barb = (a: number): Pt => [tip[0] + barbLen * Math.cos(a), tip[1] + barbLen * Math.sin(a)];
  // Retracing the tip is how a single stroke draws two barbs.
  return [tail, tip, barb(back - spread), tip, barb(back + spread)];
}

// ---- recognition -----------------------------------------------------------------

/**
 * The shape a drawn path was meant to be, or null to keep the path as drawn.
 *
 * `points` are the stroke's own normalised page coordinates; `aspect` is the page's
 * width / height.
 */
export function recognizeShape(
  points: readonly [number, number, number][],
  aspect: number,
): Recognised | null {
  if (points.length < 5) return null;
  const pressure =
    Math.round((points.reduce((s, p) => s + (p[2] || 0.5), 0) / points.length) * 100) / 100;
  const pts = smooth(dedupe(points.map(([x, y]) => [x * aspect, y] as Pt), 1e-4));
  if (pts.length < 5) return null;

  const box = bboxOf(pts);
  const diag = Math.hypot(box.w, box.h);
  if (diag < MIN_DIAGONAL) return null;

  const len = pathLength(pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const gap = dist(first, last);
  const closed = gap < Math.max(0.25 * diag, 0.12 * len);
  const eps = CORNER_EPS * diag;
  const window = CORNER_WINDOW * diag;

  const candidates: { kind: ShapeKind; path: Pt[]; gate?: number }[] = [];
  /** Are these two extents close enough that the shape was meant to be even? */
  const even = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b, 1e-9) < EVEN_ENOUGH;
  /** Does every side have enough length to be a side someone drew on purpose? */
  const sidesWorthKeeping = (path: Pt[]) => {
    for (let i = 1; i < path.length; i++) if (dist(path[i - 1], path[i]) < MIN_SIDE * diag) return false;
    return true;
  };

  if (closed) {
    const verts = cornersOf([...pts, first], eps, window, true);
    const roundish = ellipsePath(box);
    if (verts.length <= 2) {
      // No corners at all: a round thing. A circle first, since that's almost always
      // what someone drawing freehand was aiming for.
      if (even(box.w, box.h)) {
        const r = (box.w + box.h) / 4;
        candidates.push({ kind: "circle", path: ellipsePath(box, { rx: r, ry: r }) });
      }
      candidates.push({ kind: "ellipse", path: roundish });
    } else if (verts.length === 3) {
      candidates.push({ kind: "triangle", path: closePath(verts) });
    } else if (verts.length === 4) {
      if (isRightAngled(verts)) {
        if (isAxisAligned(verts)) {
          candidates.push({ kind: even(box.w, box.h) ? "square" : "rectangle", path: rectPath(box) });
        }
        const turned = rotatedRectPath(verts);
        // A turned rectangle's own sides decide whether it's square — its bounding box
        // gets rounder the further it's rotated, whatever shape it is.
        if (turned) {
          const sq = even(dist(turned[0], turned[1]), dist(turned[1], turned[2]));
          candidates.push({ kind: sq ? "square" : "rectangle", path: turned });
        }
      }
      candidates.push({ kind: "polygon", path: closePath(verts) });
    } else {
      // Many corners: either a rounded blob the corner test over-read, or a real
      // polygon. Let the fit decide — on the curve's stricter gate, since the corners
      // are evidence against it.
      candidates.push({ kind: "ellipse", path: roundish, gate: CURVE_GATE });
      if (verts.length <= MAX_CORNERS) candidates.push({ kind: "polygon", path: closePath(verts) });
    }
  } else {
    const straight = gap > 0.02 && len < 1.3 * gap;
    if (straight) candidates.push({ kind: "line", path: [first, last] });
    const verts = cornersOf(pts, eps, window, false);
    const arrow = arrowPath(verts);
    if (arrow) candidates.push({ kind: "arrow", path: arrow });
    if (!straight && verts.length === 2) {
      // A single sweeping arc: straightening it would be wrong, so leave it be.
      return null;
    }
    if (verts.length > 2 && verts.length <= 5) candidates.push({ kind: "polyline", path: verts });
  }

  const drawnLen = closed ? len + gap : len;
  const cornered = (k: ShapeKind) => k === "polygon" || k === "polyline" || k === "triangle";
  for (const c of candidates) {
    if (fitError(pts, c.path) > (c.gate ?? FIT_GATE) * diag) continue;
    if (cornered(c.kind)) {
      // A polyline through its own corners fits whatever it came from, so the fit says
      // nothing. Slack does: a wiggle or a scribble spends far more pen than the shape
      // it would be flattened to. Curves are exempt — hand tremor alone adds a third to
      // a circle's drawn length, and their fit is a real test.
      if (drawnLen > MAX_SLACK * pathLength(c.path)) continue;
      if (!sidesWorthKeeping(c.path)) continue;
    }
    return {
      kind: c.kind,
      points: c.path.map(([x, y]) => [x / aspect, y, pressure] as [number, number, number]),
    };
  }
  return null;
}

/** The drawn stroke, snapped if it turned out to be a shape. */
export function snapStroke(s: Stroke, aspect: number): { stroke: Stroke; kind: ShapeKind | null } {
  const found = recognizeShape(s.points, aspect);
  return found ? { stroke: { ...s, points: found.points }, kind: found.kind } : { stroke: s, kind: null };
}

export const SHAPE_LABEL: Record<ShapeKind, string> = {
  line: "Line",
  arrow: "Arrow",
  circle: "Circle",
  ellipse: "Ellipse",
  rectangle: "Rectangle",
  square: "Square",
  triangle: "Triangle",
  polygon: "Polygon",
  polyline: "Straightened",
};
