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

/** A variable-width stroke, drawn segment by segment with midpoint smoothing. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, W: number, H: number) {
  if (s.points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = s.color;
  ctx.globalAlpha = s.tool === "highlighter" ? HIGHLIGHT_ALPHA : 1;
  const base = s.size * W * (s.tool === "highlighter" ? 6 : 1);

  if (s.points.length === 1) {
    const [x, y, p] = s.points[0];
    ctx.beginPath();
    ctx.arc(x * W, y * H, Math.max(0.5, (base * (0.4 + p)) / 2), 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = 1; i < s.points.length; i++) {
    const [x0, y0, p0] = s.points[i - 1];
    const [x1, y1, p1] = s.points[i];
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.6, base * (0.4 + (p0 + p1) / 2));
    const mx = ((x0 + x1) / 2) * W;
    const my = ((y0 + y1) / 2) * H;
    ctx.moveTo(x0 * W, y0 * H);
    ctx.quadraticCurveTo(x0 * W, y0 * H, mx, my);
    ctx.lineTo(x1 * W, y1 * H);
    ctx.stroke();
  }
  ctx.restore();
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
  let resolved = stack;
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
  for (const el of elements) if (!isText(el)) drawStroke(ctx, el as Stroke, W, H);
  for (const el of elements) if (isText(el)) drawTextBox(ctx, el as TextBox, W, H, textHeight?.(el as TextBox));
}

/** Available font keys, so a caller can pre-warm the family cache if it wants. */
export const FONT_KEYS = PLANNER_FONTS.map((f) => f.key);
