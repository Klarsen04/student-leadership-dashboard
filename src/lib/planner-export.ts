// Exporting pages: a page, a selection, or a whole notebook, as PNG or PDF.
//
// Two rules from the brief shape this file. Nothing is exported by screenshotting the
// live page — every export is composited fresh from the page's own background image and
// its vector strokes and text, at whatever resolution is asked for, so it's crisp rather
// than a picture of the screen. And an *annotated PDF* of an imported PDF keeps the
// original document intact: the ink is drawn onto its real pages, so the PDF's own text
// stays selectable underneath.
//
// pdf-lib is loaded on demand — it's only needed the moment someone exports, and it has
// no business in the initial planner bundle.

import type { PageElement, TextBox } from "@/lib/planner-ink";
import { paintElements } from "@/lib/planner-render";
import type { Bounds } from "@/lib/planner-select";

/** Longest edge (px) of an exported page — sharp in print without runaway file sizes. */
export const EXPORT_LONG_EDGE = 2400;

export interface PageForExport {
  /** The page's background, already loaded. Null for a paper-less blank page. */
  background: HTMLImageElement | HTMLCanvasElement | null;
  elements: PageElement[];
  /** Page width / height. */
  aspect: number;
  /** Solid page colour behind everything (paper tint), if the background has gaps. */
  fill?: string;
  /** A text box's measured wrapped height, when the DOM has reported it. */
  textHeight?: (t: TextBox) => number | undefined;
}

// ---- loading images ---------------------------------------------------------------

/** Load an image URL (or data URL) into a decoded <img>. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // so a same-origin render can be read back
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load a page background for export."));
    img.src = src;
  });
}

// ---- one page to a canvas ---------------------------------------------------------

function targetSize(aspect: number): { w: number; h: number } {
  return aspect >= 1
    ? { w: EXPORT_LONG_EDGE, h: Math.round(EXPORT_LONG_EDGE / aspect) }
    : { w: Math.round(EXPORT_LONG_EDGE * aspect), h: EXPORT_LONG_EDGE };
}

/** Composite background + ink into a fresh canvas at export resolution. */
export function renderPageCanvas(page: PageForExport): HTMLCanvasElement {
  const { w, h } = targetSize(page.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser wouldn't give us a canvas to export with.");
  ctx.fillStyle = page.fill ?? "#ffffff";
  ctx.fillRect(0, 0, w, h);
  if (page.background) {
    try {
      ctx.drawImage(page.background, 0, 0, w, h);
    } catch {
      // A tainted (cross-origin) background can't be drawn; the ink still exports.
    }
  }
  paintElements(ctx, page.elements, w, h, page.textHeight);
  return canvas;
}

/** Just the ink of a selection, on transparency, cropped to its bounds. */
export function renderSelectionCanvas(
  elements: PageElement[],
  bounds: Bounds,
  aspect: number,
  textHeight?: (t: TextBox) => number | undefined,
): HTMLCanvasElement {
  // The crop's own aspect, in screen-round space, decides the canvas shape.
  const cropAspect = (bounds.w * aspect) / bounds.h;
  const { w, h } = targetSize(cropAspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser wouldn't give us a canvas to export with.");
  // Paint in full-page pixels but translated/scaled so the selection fills the canvas.
  const pageW = w / bounds.w;
  const pageH = h / bounds.h;
  ctx.translate(-bounds.x * pageW, -bounds.y * pageH);
  paintElements(ctx, elements, pageW, pageH, textHeight);
  return canvas;
}

// ---- turning canvases into files --------------------------------------------------

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the image."))), type, quality);
  });
}

/**
 * A PDF built from page canvases. JPEG for photographic PDF/template backgrounds keeps
 * the file small; a page that's mostly ink on paper stays PNG-crisp. The choice is the
 * caller's, per page, via `hasPhoto`.
 */
export async function canvasesToPdf(
  pages: { canvas: HTMLCanvasElement; hasPhoto?: boolean }[],
): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const { canvas, hasPhoto } of pages) {
    const type = hasPhoto ? "image/jpeg" : "image/png";
    const bytes = new Uint8Array(await (await canvasToBlob(canvas, type, hasPhoto ? 0.85 : undefined)).arrayBuffer());
    const img = hasPhoto ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    // One PDF point per canvas pixel: the page is the image's own size, so nothing scales.
    const p = pdf.addPage([canvas.width, canvas.height]);
    p.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height });
  }
  return pdfBlob(await pdf.save());
}

/**
 * An annotated copy of an existing PDF: the user's ink drawn onto the real pages, so the
 * document's own selectable text and vectors stay underneath. `inkByPage` is keyed by
 * 1-based PDF page number; pages without ink are copied through untouched.
 */
export async function annotatePdf(
  originalBytes: ArrayBuffer,
  inkByPage: Map<number, HTMLCanvasElement>,
): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(originalBytes);
  const pages = pdf.getPages();
  for (const [n, canvas] of inkByPage) {
    const page = pages[n - 1];
    if (!page) continue;
    const bytes = new Uint8Array(await (await canvasToBlob(canvas, "image/png")).arrayBuffer());
    const img = await pdf.embedPng(bytes);
    const { width, height } = page.getSize();
    // The ink canvas covers the whole page, transparent everywhere it isn't ink, so it
    // drops straight on at page size.
    page.drawImage(img, { x: 0, y: 0, width, height });
  }
  return pdfBlob(await pdf.save());
}

/** Wrap pdf-lib's bytes in a Blob, copied into a plain ArrayBuffer for the Blob types. */
function pdfBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: "application/pdf" });
}

// ---- saving -----------------------------------------------------------------------

/** Offer a blob to the user as a download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke a tick later — some browsers cancel the download if the URL dies too soon.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** A safe, readable filename stem from a notebook name. */
export function safeName(name: string): string {
  return (name || "planner").replace(/[^\w\-. ]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "planner";
}
