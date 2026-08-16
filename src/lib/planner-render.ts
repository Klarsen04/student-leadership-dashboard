// Painting page content onto a canvas: the one place strokes and text boxes become
// pixels.
//
// The live viewer draws strokes here and lays text out as DOM (so it stays editable);
// export draws both here, so a saved PNG or PDF matches the screen. Keeping the stroke
// painter in one place is what stops those two ever drifting apart.
//
// Everything is in normalised page coordinates (0..1), scaled by the target canvas size
// passed in — so the same code paints a 240px thumbnail and a 3000px export page.

import { PLANNER_FONTS, fontStack, isText, type PageElement, type Stroke, type TextBox } from "@/lib/planner-ink";

export const HIGHLIGHT_ALPHA = 0.35;
export const PENCIL_ALPHA = 0.82;

/** How wide each tool is for a given `size`, so one size control suits them all. */
export const TOOL_WIDTH: Record<Stroke["tool"], number> = { pen: 1, pencil: 1.15, marker: 3, highlighter: 6 };

/** How see-through each tool is out of the box. */
export const TOOL_ALPHA: Record<Stroke["tool"], number> = {
  pen: 1,
  pencil: PENCIL_ALPHA,
  marker: 1,
  highlighter: HIGHLIGHT_ALPHA,
};

/** How see-through a whole stroke is: its own setting, else what the tool usually is. */
export const strokeAlpha = (s: Stroke): number => s.opacity ?? TOOL_ALPHA[s.tool] ?? 1;

/**
 * Strokes whose transparency belongs to the *stroke*, not to each of its segments.
 *
 * Segments are painted one at a time (that's what makes variable width and resuming
 * possible), and a see-through segment laid over its neighbour's round cap builds up
 * where samples bunch — a pencil beads at every dot, and a highlighter taken back and
 * forth over a word turns into a solid block that hides it. So these are painted at
 * full strength on their own layer and laid down once, whole. See `paintStrokes`.
 *
 * A highlighter and a pencil are always flattened, however opaque, because both lay
 * light passes over one another even at full strength; anything else only needs it once
 * it's see-through.
 */
export const isFlattened = (s: Stroke) =>
  s.tool === "pencil" || s.tool === "highlighter" || strokeAlpha(s) < 1;

/**
 * Deterministic pseudo-randomness for pencil grain, from the sample's own index and
 * position: the same stroke grains the same way in the viewer, in a thumbnail and in an
 * export, and resuming a half-painted stroke can't shift it.
 */
const grain = (i: number, x: number, y: number) => {
  const n = Math.sin(i * 12.9898 + x * 78.233 + y * 37.719) * 43758.5453;
  return n - Math.floor(n); // 0..1
};

/**
 * A variable-width stroke, drawn segment by segment with midpoint smoothing.
 *
 * `from` resumes: with `from = n`, the first n points are taken as already painted and
 * only the segments after them are drawn. That's what lets the viewer paint a stroke as
 * it's being written without repainting the part already on the canvas. Because every
 * segment is an independent path with its own width and alpha, resuming lands exactly
 * the same pixels as one pass over the whole stroke — the live layer can't drift from
 * what a full repaint (or an export) would produce.
 */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, W: number, H: number, from = 0) {
  if (s.points.length === 0 || s.points.length <= from) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = strokeAlpha(s);
  const base = s.size * W * TOOL_WIDTH[s.tool];
  // A marker is a felt tip: it lays down the same width however hard it's pressed,
  // which is most of what tells it apart from the pen at a glance. The others taper.
  const flat = s.tool === "marker" || s.tool === "highlighter";
  const width = (p0: number, p1: number) => (flat ? base : base * (0.4 + (p0 + p1) / 2));

  if (s.points.length === 1) {
    const [x, y, p] = s.points[0];
    ctx.beginPath();
    ctx.arc(x * W, y * H, Math.max(0.5, width(p, p) / 2), 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = Math.max(1, from); i < s.points.length; i++) {
    const [x0, y0, p0] = s.points[i - 1];
    const [x1, y1, p1] = s.points[i];
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.6, width(p0, p1));
    const mx = ((x0 + x1) / 2) * W;
    const my = ((y0 + y1) / 2) * H;
    ctx.moveTo(x0 * W, y0 * H);
    ctx.quadraticCurveTo(x0 * W, y0 * H, mx, my);
    ctx.lineTo(x1 * W, y1 * H);
    ctx.stroke();

    // Graphite sits unevenly on paper: a lighter, thinner second pass nudged off to one
    // side of the segment gives the edge some tooth without any bitmap texture.
    if (s.tool === "pencil") {
      const g = grain(i, x0, y0);
      const len = Math.hypot((x1 - x0) * W, (y1 - y0) * H) || 1;
      const off = (ctx.lineWidth * (0.18 + g * 0.22)) * (g > 0.5 ? 1 : -1);
      const nx = (-(y1 - y0) * H * off) / len;
      const ny = ((x1 - x0) * W * off) / len;
      ctx.save();
      ctx.globalAlpha = strokeAlpha(s) * (0.2 + g * 0.2);
      ctx.lineWidth = Math.max(0.4, ctx.lineWidth * 0.5);
      ctx.beginPath();
      ctx.moveTo(x0 * W + nx, y0 * H + ny);
      ctx.lineTo(x1 * W + nx, y1 * H + ny);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Paint a page's strokes in order, giving pencil and highlighter strokes their own
 * layer first (see `isFlattened`).
 *
 * A highlighter is then laid down with `multiply`, which is what a real one does: it
 * darkens the paper it crosses but can't lighten the handwriting already there, so ink
 * highlighted over stays perfectly readable and going over it twice doesn't bury it.
 */
export function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], W: number, H: number) {
  let scratch: HTMLCanvasElement | null = null;
  for (const s of strokes) {
    if (!isFlattened(s) || typeof document === "undefined") {
      drawStroke(ctx, s, W, H);
      continue;
    }
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    if (!scratch) {
      scratch = document.createElement("canvas");
      scratch.width = cw;
      scratch.height = ch;
    } else if (scratch.width !== cw || scratch.height !== ch) {
      scratch.width = cw;
      scratch.height = ch;
    }
    const sc = scratch.getContext("2d");
    if (!sc) { drawStroke(ctx, s, W, H); continue; }
    const t = ctx.getTransform();
    // Clear only the box this stroke can touch — a page with a lot of highlighting
    // would otherwise wipe the whole scratch layer once per stroke.
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [px, py] of s.points) {
      x0 = Math.min(x0, px); y0 = Math.min(y0, py);
      x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
    const pad = s.size * TOOL_WIDTH[s.tool] * W * 1.5 + 4;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(
      x0 * W * t.a + t.e - pad, y0 * H * t.d + t.f - pad,
      (x1 - x0) * W * t.a + pad * 2, (y1 - y0) * H * t.d + pad * 2,
    );
    sc.setTransform(t);
    drawStroke(sc, { ...s, opacity: 1 }, W, H);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // the clip stays; only the mapping is dropped
    ctx.globalAlpha = strokeAlpha(s);
    if (s.tool === "highlighter") ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }
}

// ---- text ------------------------------------------------------------------------
// The DOM renders text with next/font's CSS variables; a canvas can't use `var(--x)`,
// so the concrete family behind each variable is read once from the document and cached.
// Off the DOM (a worker, a test) it falls back to the stack's non-variable part.

const familyCache = new Map<string, string>();

function canvasFontFamily(key: string): string {
  const cached = familyCache.get(key);
  if (cached) return cached;
  const stack = fontStack(key);
  let resolved: string;
  if (typeof document !== "undefined") {
    // Replace each var(--x[, fallback]) with the computed value of --x.
    const root = getComputedStyle(document.documentElement);
    resolved = stack.replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (whole, name) => {
      const v = root.getPropertyValue(name).trim();
      return v || whole;
    });
    // If a variable didn't resolve (SSR-hydration race), drop the var() and keep fallbacks.
    resolved = resolved.replace(/var\([^)]*\)\s*,?\s*/g, "").trim() || stack;
  } else {
    resolved = stack.replace(/var\([^)]*\)\s*,?\s*/g, "").trim() || "sans-serif";
  }
  familyCache.set(key, resolved);
  return resolved;
}

/** Wrap `text` to `maxWidth`, honouring explicit newlines. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") { lines.push(""); continue; }
    let line = "";
    for (const word of paragraph.split(/(\s+)/)) {
      const next = line + word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/**
 * Paint one text box, wrapped and aligned as the DOM lays it out (line height 1.3,
 * rotation about the box's own centre). `measuredHeight` is the box's known wrapped
 * height as a fraction of page height, used only to find the rotation centre.
 */
export function drawTextBox(
  ctx: CanvasRenderingContext2D,
  t: TextBox,
  W: number,
  H: number,
  measuredHeight?: number,
) {
  if (!t.text) return;
  const fontPx = t.size * H;
  if (fontPx < 0.5) return;
  const lineH = fontPx * 1.3;
  const weight = t.bold ? "700" : "400";
  const style = t.italic ? "italic" : "normal";
  const family = canvasFontFamily(t.font);
  ctx.save();
  ctx.font = `${style} ${weight} ${fontPx}px ${family}`;
  ctx.fillStyle = t.color;
  ctx.textBaseline = "top";
  ctx.textAlign = t.align;

  const boxW = t.w * W;
  const lines = wrapText(ctx, t.text, boxW);
  const boxH = measuredHeight != null ? measuredHeight * H : lines.length * lineH;

  if (t.rot) {
    // Turn about the box's centre, matching the DOM's transform-origin: center center.
    const cx = t.x * W + boxW / 2;
    const cy = t.y * H + boxH / 2;
    ctx.translate(cx, cy);
    ctx.rotate(t.rot);
    ctx.translate(-cx, -cy);
  }

  const anchorX = t.align === "center" ? t.x * W + boxW / 2 : t.align === "right" ? t.x * W + boxW : t.x * W;
  let y = t.y * H;
  for (const line of lines) {
    ctx.fillText(line, anchorX, y);
    y += lineH;
  }
  ctx.restore();
}

/**
 * Paint a whole page's content. Strokes go down first in their own order, then text —
 * because on screen text is a DOM overlay that always sits above the ink canvas, so this
 * is what an export has to do to match what the page looked like.
 */
export function paintElements(
  ctx: CanvasRenderingContext2D,
  elements: PageElement[],
  W: number,
  H: number,
  textHeight?: (t: TextBox) => number | undefined,
) {
  paintStrokes(ctx, elements.filter((el) => !isText(el)) as Stroke[], W, H);
  for (const el of elements) if (isText(el)) drawTextBox(ctx, el as TextBox, W, H, textHeight?.(el as TextBox));
}

/** Available font keys, so a caller can pre-warm the family cache if it wants. */
export const FONT_KEYS = PLANNER_FONTS.map((f) => f.key);
