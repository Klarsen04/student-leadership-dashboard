// Paper for blank notebooks — the "templates" a user picks when making one.
//
// A shipped planner is a folder of rendered page images and an import is a PDF,
// but a blank notebook has no source file at all: its pages are drawn here as an
// SVG data URL. One string serves every page of the notebook, so a 200-page grid
// notebook costs nothing to store and stays crisp at any zoom.
//
// The rulings are drawn with <pattern> rather than a line per row: a dotted A4
// page is ~1500 dots, which as individual elements would be a 50 KB data URL
// re-parsed on every page flip.

export interface PaperType {
  key: string;
  name: string;
  hint: string;
  /** Ruling markup for a page `w` x `h` units, drawn behind the ink. */
  draw(w: number, h: number): string;
}

const RULE = "#C7D5E2";
const FAINT = "#DEE7EF";
const MARGIN_RULE = "#E9B4AC";

/** Inset from the page edge, in page units, so ruling doesn't run to the bleed. */
const PAD = 58;

const pattern = (id: string, w: number, h: number, body: string) =>
  `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`;

const fill = (id: string, x: number, y: number, w: number, h: number) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id})"/>`;

/** Horizontal lines every `gap` units, filling one rectangle of the page. */
function ruledRect(w: number, gap: number, x: number, y: number, rw: number, rh: number) {
  const body = `<line x1="0" y1="${gap - 0.8}" x2="${w}" y2="${gap - 0.8}" stroke="${RULE}" stroke-width="1.6"/>`;
  return `<defs>${pattern("r", w, gap, body)}</defs>${fill("r", x, y, rw, rh)}`;
}

/** A ruled page, inset from the bleed. */
const ruled = (w: number, h: number, gap: number) =>
  ruledRect(w, gap, PAD, PAD, w - PAD * 2, h - PAD * 2);

export const PAPER_TYPES: PaperType[] = [
  {
    key: "blank",
    name: "Blank",
    hint: "Plain paper — nothing in the way",
    draw: () => "",
  },
  {
    key: "lined",
    name: "Lined",
    hint: "Standard ruled lines",
    draw: (w, h) => ruled(w, h, 38),
  },
  {
    key: "narrow",
    name: "Narrow ruled",
    hint: "Tighter lines, more per page",
    draw: (w, h) => ruled(w, h, 27),
  },
  {
    key: "grid",
    name: "Grid",
    hint: "Squared paper for diagrams and maths",
    draw: (w, h) => {
      const g = 32;
      const body =
        `<line x1="0" y1="0" x2="${g}" y2="0" stroke="${FAINT}" stroke-width="1.4"/>` +
        `<line x1="0" y1="0" x2="0" y2="${g}" stroke="${FAINT}" stroke-width="1.4"/>`;
      return `<defs>${pattern("g", g, g, body)}</defs>${fill("g", PAD, PAD, w - PAD * 2, h - PAD * 2)}`;
    },
  },
  {
    key: "dotted",
    name: "Dotted",
    hint: "Bullet-journal dot grid",
    draw: (w, h) => {
      const g = 32;
      const body = `<circle cx="0.5" cy="0.5" r="2.1" fill="${RULE}"/>`;
      return `<defs>${pattern("d", g, g, body)}</defs>${fill("d", PAD, PAD, w - PAD * 2, h - PAD * 2)}`;
    },
  },
  {
    key: "cornell",
    name: "Cornell notes",
    hint: "Cue column, notes area and a summary strip",
    draw: (w, h) => {
      const cue = PAD + (w - PAD * 2) * 0.28; // cue/notes divider
      const summary = h - PAD - (h - PAD * 2) * 0.18; // summary strip top
      const head = PAD + 74; // title rule
      // Ruling belongs to the notes block only — the cue column and the summary
      // strip stay open.
      return (
        ruledRect(w, 38, cue, head, w - PAD - cue, summary - head) +
        `<g stroke="${MARGIN_RULE}" stroke-width="2">` +
        `<line x1="${PAD}" y1="${head}" x2="${w - PAD}" y2="${head}"/>` +
        `<line x1="${cue}" y1="${head}" x2="${cue}" y2="${summary}"/>` +
        `<line x1="${PAD}" y1="${summary}" x2="${w - PAD}" y2="${summary}"/>` +
        `</g>`
      );
    },
  },
  {
    key: "checklist",
    name: "Checklist",
    hint: "A tick box on every line",
    draw: (w, h) => {
      const g = 44;
      const body =
        `<rect x="2" y="${g - 26}" width="19" height="19" rx="4.5" fill="none" stroke="${RULE}" stroke-width="1.8"/>` +
        `<line x1="32" y1="${g - 5}" x2="${w}" y2="${g - 5}" stroke="${FAINT}" stroke-width="1.5"/>`;
      return `<defs>${pattern("c", w, g, body)}</defs>${fill("c", PAD, PAD, w - PAD * 2, h - PAD * 2)}`;
    },
  },
];

export const DEFAULT_PAPER = "lined";

export const paperFor = (key: string | undefined) =>
  PAPER_TYPES.find((p) => p.key === key) ?? PAPER_TYPES[0];

/** Page shapes offered when creating a notebook (width / height). */
export const PAPER_SIZES = [
  { key: "a4", name: "A4 portrait", aspect: 210 / 297 },
  { key: "a4l", name: "A4 landscape", aspect: 297 / 210 },
  { key: "letter", name: "Letter portrait", aspect: 8.5 / 11 },
  { key: "square", name: "Square", aspect: 1 },
];

export const PAPER_TINTS = [
  { key: "white", name: "White", value: "#FFFFFF" },
  { key: "cream", name: "Cream", value: "#FBF5E9" },
  { key: "mint", name: "Mint", value: "#F1F7F2" },
  { key: "grey", name: "Grey", value: "#F3F5F7" },
];

export const DEFAULT_TINT = PAPER_TINTS[0].value;

/**
 * One page of paper as an SVG data URL, sized to the notebook's aspect ratio.
 * Every page of a notebook is identical, so callers can memoise on the planner.
 */
export function paperSrc(paperKey: string | undefined, aspect: number, tint = DEFAULT_TINT): string {
  const paper = paperFor(paperKey);
  const w = 1000;
  const h = Math.round(w / Math.min(4, Math.max(0.25, aspect)));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="${tint}"/>${paper.draw(w, h)}</svg>`;
  // encodeURIComponent (not base64) keeps this readable and escapes the '#' in
  // colours, which would otherwise truncate the data URL at the fragment.
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
