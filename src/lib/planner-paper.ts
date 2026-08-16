// Paper — the vector page backgrounds a notebook page is drawn on.
//
// Every background is generated from a `TemplateDefinition`: a small record of
// pattern type, spacing, colours and margins. Nothing here is a screenshot, so
// paper stays crisp at any zoom and a new paper type is a new definition rather
// than new drawing code.
//
// Units are PostScript points (72 per inch), the same units the page sizes are
// declared in, so "7 mm ruled" means 7 mm on a printed A4 page and a Letter page
// of the same template gets the same physical spacing. Page content is stored in
// normalised 0..1 coordinates (see planner-ink.ts), so it is unaffected by page
// size — which is what lets a page change size or orientation without moving the
// handwriting on it.
//
// Rulings are drawn with <pattern> rather than one element per line: a dotted A4
// page is ~1500 dots, which as individual elements would be a 50 KB data URL
// re-parsed on every page flip.

import { LAYOUT_TEMPLATES, drawLayout } from "@/lib/planner-layouts";

// ---- page geometry ---------------------------------------------------------------

export type Orientation = "portrait" | "landscape";

export interface PageSizeDef {
  key: string;
  name: string;
  /** Portrait dimensions in points. */
  w: number;
  h: number;
}

/** Paper sizes offered when creating a page, portrait dimensions in points. */
export const PAGE_SIZES: PageSizeDef[] = [
  { key: "letter", name: "Letter", w: 612, h: 792 },
  { key: "a4", name: "A4", w: 595, h: 842 },
  { key: "a5", name: "A5", w: 420, h: 595 },
  { key: "a6", name: "A6", w: 298, h: 420 },
  { key: "legal", name: "Legal", w: 612, h: 1008 },
  { key: "executive", name: "Executive", w: 522, h: 756 },
  { key: "square", name: "Square", w: 600, h: 600 },
];

export const DEFAULT_PAGE_SIZE = "a4";

export const pageSizeFor = (key: string | undefined) =>
  PAGE_SIZES.find((s) => s.key === key) ?? PAGE_SIZES[1];

export interface PageGeometry {
  w: number;
  h: number;
}

/**
 * Page dimensions in points. A custom size carries its own width and height and
 * ignores the named size; orientation swaps the axes for everything else.
 */
export function pageDimensions(
  sizeKey: string | undefined,
  orientation: Orientation = "portrait",
  custom?: PageGeometry,
): PageGeometry {
  if (sizeKey === "custom" && custom) {
    const w = clamp(custom.w, 72, 5000);
    const h = clamp(custom.h, 72, 5000);
    return orientation === "landscape" && h > w ? { w: h, h: w } : { w, h };
  }
  const s = pageSizeFor(sizeKey);
  return orientation === "landscape" ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
}

export const aspectOf = (g: PageGeometry) => g.w / g.h;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---- page colours ----------------------------------------------------------------
// The page colour is deliberately separate from the template: switching ruling
// keeps the colour and vice versa, and neither touches page content.

export interface PageColor {
  key: string;
  name: string;
  value: string;
  /** Paper this dark needs light ruling and light default ink. */
  dark?: boolean;
}

export const PAGE_COLORS: PageColor[] = [
  { key: "white", name: "White", value: "#FFFFFF" },
  { key: "warm", name: "Warm white", value: "#FDFBF6" },
  { key: "cream", name: "Cream", value: "#FBF5E9" },
  { key: "grey", name: "Light grey", value: "#F3F4F6" },
  { key: "pink", name: "Pale pink", value: "#FDF2F4" },
  { key: "blue", name: "Pale blue", value: "#F1F6FC" },
  { key: "green", name: "Pale green", value: "#F1F8F2" },
  { key: "yellow", name: "Pale yellow", value: "#FDF9EA" },
  { key: "lavender", name: "Lavender", value: "#F5F2FC" },
  { key: "darkgrey", name: "Dark grey", value: "#2B2E33", dark: true },
  { key: "black", name: "Black", value: "#16181C", dark: true },
];

export const DEFAULT_PAGE_COLOR = "#FFFFFF";

export const colorPreset = (value: string) =>
  PAGE_COLORS.find((c) => c.value.toLowerCase() === value.toLowerCase());

/** Rough luminance test, so custom colours also get light ruling when dark. */
export function isDarkPaper(value: string): boolean {
  const preset = colorPreset(value);
  if (preset) return Boolean(preset.dark);
  const hex = value.replace("#", "");
  if (hex.length !== 6 && hex.length !== 3) return false;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

/** Ink that reads on this paper — used as the default pen colour on dark pages. */
export const defaultInkFor = (paper: string) => (isDarkPaper(paper) ? "#F5F5F5" : "#1a1a1a");

// ---- template model ---------------------------------------------------------------

export type PatternType =
  | "blank"
  | "ruled"
  | "dotted"
  | "grid"
  | "graph"
  | "cornell"
  | "checklist"
  | "layout";

export type TemplateCategory =
  | "Basic"
  | "Lined"
  | "Dotted"
  | "Grid"
  | "Graph"
  | "Cornell"
  | "Planner"
  | "School"
  | "Meetings"
  | "Productivity"
  | "Custom";

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "Basic",
  "Lined",
  "Dotted",
  "Grid",
  "Graph",
  "Cornell",
  "Planner",
  "School",
  "Meetings",
  "Productivity",
  "Custom",
];

/**
 * Everything the renderer needs to draw one kind of paper. Only `id`, `name`,
 * `category` and `pattern` are required — the rest fall back to values that look
 * right for the pattern, so a new template is usually three or four lines.
 */
export interface TemplateDefinition {
  id: string;
  name: string;
  category: TemplateCategory;
  hint?: string;
  pattern: PatternType;
  /** For `pattern: "layout"` — which planner layout to draw (planner-layouts.ts). */
  layout?: string;
  /** Pattern period in points. */
  spacing?: number;
  /** Ruling thickness in points. */
  lineWidth?: number;
  /** Ruling colour; defaults to a blue-grey that suits both light and dark paper. */
  patternColor?: string;
  patternOpacity?: number;
  /** Inset from the page edge, in points, that the ruling keeps clear. */
  margin?: number;
  /** Extra inset for content, used by the layouts. */
  padding?: number;
  /** Default page colour when this template is picked. */
  background?: string;
  /** Default page size / orientation when this template is picked. */
  size?: string;
  orientation?: Orientation;
  /**
   * A user template made from a PDF page or an image: the background is that
   * picture rather than a generated pattern. Stored in IndexedDB, so this is the
   * blob key rather than the data itself.
   */
  imageKey?: string;
  /** Set on templates the user made, which are the only deletable ones. */
  custom?: boolean;
  createdAt?: number;
  /** Last edit to a user template, so devices can tell whose copy is newer. */
  updatedAt?: number;
}

const RULE = "#C7D5E2";
const FAINT = "#DEE7EF";
const ACCENT = "#E9B4AC";
const DARK_RULE = "#5A6270";

/** Default ruling colour for a template on a given paper. */
function rulingColor(def: TemplateDefinition, paper: string): string {
  if (def.patternColor) return def.patternColor;
  return isDarkPaper(paper) ? DARK_RULE : RULE;
}

const faintColor = (def: TemplateDefinition, paper: string) =>
  def.patternColor ?? (isDarkPaper(paper) ? DARK_RULE : FAINT);

// Spacing defaults per pattern, in points (~7 mm ruled, 5 mm grid).
const DEFAULT_SPACING: Record<PatternType, number> = {
  blank: 0,
  ruled: 24,
  dotted: 20,
  grid: 20,
  graph: 14,
  cornell: 24,
  checklist: 30,
  layout: 0,
};

const DEFAULT_MARGIN = 36; // half an inch

// ---- the shipped templates --------------------------------------------------------

export const PAPER_TEMPLATES: TemplateDefinition[] = [
  // Basic ------------------------------------------------------------------
  { id: "blank", name: "Blank", category: "Basic", pattern: "blank", hint: "Plain paper — nothing in the way" },
  { id: "blank-cream", name: "Cream", category: "Basic", pattern: "blank", background: "#FBF5E9", hint: "Warm plain paper" },
  { id: "blank-grey", name: "Grey", category: "Basic", pattern: "blank", background: "#F3F4F6", hint: "Cool plain paper" },
  { id: "blank-dark", name: "Dark", category: "Basic", pattern: "blank", background: "#2B2E33", hint: "Dark paper for light ink" },

  // Lined ------------------------------------------------------------------
  { id: "narrow", name: "Narrow ruled", category: "Lined", pattern: "ruled", spacing: 17, hint: "Tight lines, most per page" },
  { id: "college", name: "College ruled", category: "Lined", pattern: "ruled", spacing: 20, hint: "7 mm — standard for notes" },
  { id: "lined", name: "Medium ruled", category: "Lined", pattern: "ruled", spacing: 24, hint: "Everyday ruled paper" },
  { id: "wide", name: "Wide ruled", category: "Lined", pattern: "ruled", spacing: 32, hint: "Room for big handwriting" },
  { id: "lined-margin", name: "Ruled + margin", category: "Lined", pattern: "ruled", spacing: 24, hint: "Ruled with a red margin rule" },

  // Dotted -----------------------------------------------------------------
  { id: "dotted-small", name: "Small dots", category: "Dotted", pattern: "dotted", spacing: 14, hint: "Fine dot grid" },
  { id: "dotted", name: "Dotted", category: "Dotted", pattern: "dotted", spacing: 20, hint: "Bullet-journal dot grid" },
  { id: "dotted-large", name: "Large dots", category: "Dotted", pattern: "dotted", spacing: 28, hint: "Roomy dot grid" },

  // Grid -------------------------------------------------------------------
  { id: "grid-small", name: "Small grid", category: "Grid", pattern: "grid", spacing: 14, hint: "5 mm squares" },
  { id: "grid", name: "Grid", category: "Grid", pattern: "grid", spacing: 20, hint: "7 mm squares" },
  { id: "grid-large", name: "Large grid", category: "Grid", pattern: "grid", spacing: 28, hint: "1 cm squares" },

  // Graph ------------------------------------------------------------------
  { id: "graph-fine", name: "Fine graph", category: "Graph", pattern: "graph", spacing: 10, hint: "Fine squares, bold every 5th" },
  { id: "graph", name: "Graph", category: "Graph", pattern: "graph", spacing: 14, hint: "Squares with major gridlines" },
  { id: "graph-large", name: "Large graph", category: "Graph", pattern: "graph", spacing: 20, hint: "Big squares for plotting" },

  // Cornell ----------------------------------------------------------------
  { id: "cornell", name: "Cornell notes", category: "Cornell", pattern: "cornell", hint: "Cue column, notes area, summary" },

  // Productivity -----------------------------------------------------------
  { id: "checklist", name: "Checklist", category: "Productivity", pattern: "checklist", hint: "A tick box on every line" },

  // Planner / School / Meetings come from the layout engine.
  ...LAYOUT_TEMPLATES,
];

export const DEFAULT_TEMPLATE = "lined";

export const templateFor = (id: string | undefined, extra: TemplateDefinition[] = []) =>
  extra.find((t) => t.id === id) ?? PAPER_TEMPLATES.find((t) => t.id === id) ?? PAPER_TEMPLATES[0];

/** Group templates for the gallery, keeping the declared category order. */
export function templatesByCategory(extra: TemplateDefinition[] = []) {
  const all = [...PAPER_TEMPLATES, ...extra];
  return TEMPLATE_CATEGORIES.map((category) => ({
    category,
    templates: all.filter((t) => t.category === category),
  })).filter((g) => g.templates.length > 0);
}

// ---- rendering --------------------------------------------------------------------

const pattern = (id: string, w: number, h: number, body: string) =>
  `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`;

const fillRect = (id: string, x: number, y: number, w: number, h: number) =>
  `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="url(#${id})"/>`;

const round = (n: number) => Math.round(n * 100) / 100;

export interface RenderOptions {
  /** Page dimensions in points. */
  page: PageGeometry;
  /** Page colour; the template's own default is used when omitted. */
  color?: string;
  /** Per-page overrides of the template's pattern parameters. */
  overrides?: Partial<Pick<TemplateDefinition, "spacing" | "lineWidth" | "patternColor" | "patternOpacity" | "margin">>;
  /** Background picture for an image/PDF-page template, as a URL. */
  imageUrl?: string;
  /**
   * How many times smaller than the page this render will be shown — 7 or so for a
   * thumbnail in the page rail. The ruling is specified in page points, so at that
   * size a hairline lands on a fraction of a pixel and the paper reads as blank.
   * This thickens the ruling to compensate, leaving the spacing (and the stored
   * template) alone, so a thumbnail still shows the right paper.
   */
  shrink?: number;
}

/** Ruling markup for one template, in page points. */
function drawPattern(def: TemplateDefinition, opts: RenderOptions, paper: string): string {
  const { w, h } = opts.page;
  const o = opts.overrides ?? {};
  const gap = Math.max(4, o.spacing ?? def.spacing ?? DEFAULT_SPACING[def.pattern] ?? 24);
  const base = o.lineWidth ?? def.lineWidth ?? 0.9;
  // Thickened for a small render (see `shrink`), but never past a fifth of the
  // spacing: fine paper should still read as fine rather than as a solid block.
  const lw = Math.min(base * Math.min(8, Math.max(1, opts.shrink ?? 1)), Math.max(base, gap / 5));
  const margin = Math.max(0, o.margin ?? def.margin ?? DEFAULT_MARGIN);
  const stroke = o.patternColor ?? rulingColor(def, paper);
  const faint = o.patternColor ?? faintColor(def, paper);
  const opacity = o.patternOpacity ?? def.patternOpacity ?? 1;
  const box = { x: margin, y: margin, w: w - margin * 2, h: h - margin * 2 };
  if (box.w <= 0 || box.h <= 0) return "";

  const wrap = (body: string) => (opacity < 1 ? `<g opacity="${opacity}">${body}</g>` : body);

  switch (def.pattern) {
    case "blank":
      return "";

    case "ruled": {
      const body = `<line x1="0" y1="${round(gap - lw)}" x2="${round(box.w)}" y2="${round(gap - lw)}" stroke="${stroke}" stroke-width="${lw}"/>`;
      let out = `<defs>${pattern("r", box.w, gap, body)}</defs>${fillRect("r", box.x, box.y, box.w, box.h)}`;
      if (def.id === "lined-margin") {
        const mx = box.x + Math.min(72, box.w * 0.12);
        out += `<line x1="${round(mx)}" y1="${round(box.y)}" x2="${round(mx)}" y2="${round(box.y + box.h)}" stroke="${def.patternColor ?? ACCENT}" stroke-width="${lw + 0.4}"/>`;
      }
      return wrap(out);
    }

    case "dotted": {
      const r = Math.min(Math.max(0.6, lw * 1.15), gap / 5);
      const body = `<circle cx="${r}" cy="${r}" r="${round(r)}" fill="${stroke}"/>`;
      return wrap(`<defs>${pattern("d", gap, gap, body)}</defs>${fillRect("d", box.x, box.y, box.w, box.h)}`);
    }

    case "grid": {
      const body =
        `<line x1="0" y1="0" x2="${gap}" y2="0" stroke="${faint}" stroke-width="${lw}"/>` +
        `<line x1="0" y1="0" x2="0" y2="${gap}" stroke="${faint}" stroke-width="${lw}"/>`;
      return wrap(`<defs>${pattern("g", gap, gap, body)}</defs>${fillRect("g", box.x, box.y, box.w, box.h)}`);
    }

    case "graph": {
      // Minor squares everywhere, a heavier line every fifth — graph paper reads
      // as two nested patterns rather than one.
      const major = gap * 5;
      const minor =
        `<line x1="0" y1="0" x2="${gap}" y2="0" stroke="${faint}" stroke-width="${lw * 0.8}"/>` +
        `<line x1="0" y1="0" x2="0" y2="${gap}" stroke="${faint}" stroke-width="${lw * 0.8}"/>`;
      const bold =
        `<line x1="0" y1="0" x2="${major}" y2="0" stroke="${stroke}" stroke-width="${lw * 1.5}"/>` +
        `<line x1="0" y1="0" x2="0" y2="${major}" stroke="${stroke}" stroke-width="${lw * 1.5}"/>`;
      return wrap(
        `<defs>${pattern("gm", gap, gap, minor)}${pattern("gM", major, major, bold)}</defs>` +
          fillRect("gm", box.x, box.y, box.w, box.h) +
          fillRect("gM", box.x, box.y, box.w, box.h),
      );
    }

    case "cornell": {
      const cue = box.x + box.w * 0.28;
      const head = box.y + Math.min(64, box.h * 0.08);
      const summary = box.y + box.h * 0.82;
      const notes = `<defs>${pattern("cn", box.w - (cue - box.x), gap, `<line x1="0" y1="${round(gap - lw)}" x2="${round(box.w)}" y2="${round(gap - lw)}" stroke="${faint}" stroke-width="${lw}"/>`)}</defs>` +
        fillRect("cn", cue, head, box.x + box.w - cue, summary - head);
      const accent = def.patternColor ?? ACCENT;
      return wrap(
        notes +
          `<g stroke="${accent}" stroke-width="${lw + 0.5}" fill="none">` +
          `<line x1="${round(box.x)}" y1="${round(head)}" x2="${round(box.x + box.w)}" y2="${round(head)}"/>` +
          `<line x1="${round(cue)}" y1="${round(head)}" x2="${round(cue)}" y2="${round(summary)}"/>` +
          `<line x1="${round(box.x)}" y1="${round(summary)}" x2="${round(box.x + box.w)}" y2="${round(summary)}"/>` +
          `</g>` +
          label("Cue", box.x + 8, head + 16, stroke) +
          label("Notes", cue + 8, head + 16, stroke) +
          label("Summary", box.x + 8, summary + 18, stroke),
      );
    }

    case "checklist": {
      const s = Math.min(14, gap * 0.45);
      const body =
        `<rect x="1" y="${round(gap - s - 5)}" width="${round(s)}" height="${round(s)}" rx="${round(s * 0.25)}" fill="none" stroke="${stroke}" stroke-width="${lw + 0.3}"/>` +
        `<line x1="${round(s + 10)}" y1="${round(gap - 4)}" x2="${round(box.w)}" y2="${round(gap - 4)}" stroke="${faint}" stroke-width="${lw}"/>`;
      return wrap(`<defs>${pattern("c", box.w, gap, body)}</defs>${fillRect("c", box.x, box.y, box.w, box.h)}`);
    }

    case "layout":
      return wrap(drawLayout(def, box, { gap, lw, stroke, faint, accent: def.patternColor ?? ACCENT }));
  }
}

/** Small uppercase caption used by the ruled layouts. */
export function label(text: string, x: number, y: number, color: string, size = 8.5, weight = 600): string {
  return (
    `<text x="${round(x)}" y="${round(y)}" fill="${color}" font-size="${size}" font-weight="${weight}" ` +
    `letter-spacing="0.08em" font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">` +
    escapeXml(text.toUpperCase()) +
    `</text>`
  );
}

export const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One page of paper as SVG markup, in page points. */
export function renderTemplateSvg(def: TemplateDefinition, opts: RenderOptions): string {
  const { w, h } = opts.page;
  const paper = opts.color ?? def.background ?? DEFAULT_PAGE_COLOR;
  const picture = opts.imageUrl
    ? `<image href="${escapeXml(opts.imageUrl)}" x="0" y="0" width="${round(w)}" height="${round(h)}" preserveAspectRatio="none"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${round(w)} ${round(h)}" width="${round(w)}" height="${round(h)}">` +
    `<rect width="${round(w)}" height="${round(h)}" fill="${paper}"/>` +
    picture +
    drawPattern(def, opts, paper) +
    `</svg>`
  );
}

/**
 * One page of paper as a data URL, for use as an <img> source.
 *
 * encodeURIComponent rather than base64: it keeps the URL readable in devtools
 * and escapes the '#' in colours, which would otherwise truncate the data URL at
 * the fragment.
 */
export function templateDataUrl(def: TemplateDefinition, opts: RenderOptions): string {
  return `data:image/svg+xml,${encodeURIComponent(renderTemplateSvg(def, opts))}`;
}

// ---- legacy surface ----------------------------------------------------------------
// Blank notebooks created before the template engine store a paper key from the
// old seven-item list ("lined", "narrow", "grid", "dotted", "cornell",
// "checklist", "blank") and an aspect ratio rather than a page size. Those are all
// template ids above, so they keep resolving; these wrappers keep the old call
// shape working for the library cards and the create-notebook dialog.

export interface PaperType {
  key: string;
  name: string;
  hint: string;
}

/** The paper choices offered when creating a notebook (a curated subset). */
export const PAPER_TYPES: PaperType[] = [
  "blank",
  "lined",
  "narrow",
  "dotted",
  "grid",
  "graph",
  "cornell",
  "checklist",
].map((id) => {
  const t = templateFor(id);
  return { key: t.id, name: t.name, hint: t.hint ?? "" };
});

export const DEFAULT_PAPER = DEFAULT_TEMPLATE;

export const paperFor = (key: string | undefined) => templateFor(key);

/** Page shapes offered when creating a notebook (width / height). */
export const PAPER_SIZES = [
  { key: "a4", name: "A4 portrait", aspect: 595 / 842 },
  { key: "a4l", name: "A4 landscape", aspect: 842 / 595 },
  { key: "letter", name: "Letter portrait", aspect: 612 / 792 },
  { key: "square", name: "Square", aspect: 1 },
];

export const PAPER_TINTS = PAGE_COLORS.filter((c) =>
  ["white", "cream", "warm", "grey", "blue", "green", "pink", "lavender", "darkgrey"].includes(c.key),
);

export const DEFAULT_TINT = DEFAULT_PAGE_COLOR;

/**
 * Paper for a notebook described the old way: a paper key plus an aspect ratio.
 * The page is rendered at Letter width so pattern spacing stays physical.
 */
export function paperSrc(paperKey: string | undefined, aspect: number, tint = DEFAULT_TINT): string {
  const w = 612;
  const h = Math.round(w / clamp(aspect, 0.25, 4));
  return templateDataUrl(templateFor(paperKey), { page: { w, h }, color: tint });
}
