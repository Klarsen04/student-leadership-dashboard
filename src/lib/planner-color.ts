// Colour, for the picker.
//
// One representation throughout: an `#rrggbb` string, because that's what every stroke,
// text box and page already stores and what a canvas takes directly. Opacity is kept
// *beside* it, never folded into the string — a stroke has its own `opacity` field and the
// renderer multiplies by it, so an `#rrggbbaa` colour would end up applied twice.
//
// HSV is only ever a working form: the picker needs it (a saturation/value square with a
// hue slider is how people expect to choose a colour) but nothing is stored in it, so a
// round trip through hex is allowed to lose the hue of pure black.

export interface RGB { r: number; g: number; b: number }
/** h 0..360, s 0..1, v 0..1. */
export interface HSV { h: number; s: number; v: number }

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const hex2 = (n: number) => Math.round(clamp01(n) * 255).toString(16).padStart(2, "0");

/**
 * `input` as `#rrggbb`, or null if it isn't a colour. Accepts a missing `#`, three
 * digits, upper case, and an eight-digit value (the alpha is dropped — see above).
 */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (!/^[0-9a-f]+$/i.test(raw)) return null;
  if (raw.length === 3) return `#${raw.split("").map((c) => c + c).join("")}`.toLowerCase();
  if (raw.length === 6 || raw.length === 8) return `#${raw.slice(0, 6)}`.toLowerCase();
  return null;
}

export function hexToRgb(hex: string): RGB | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  return {
    r: parseInt(h.slice(1, 3), 16) / 255,
    g: parseInt(h.slice(3, 5), 16) / 255,
    b: parseInt(h.slice(5, 7), 16) / 255,
  };
}

export const rgbToHex = ({ r, g, b }: RGB): string => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const c = v * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r1, g1, b1] =
    hh < 1 ? [c, x, 0] :
    hh < 2 ? [x, c, 0] :
    hh < 3 ? [0, c, x] :
    hh < 4 ? [0, x, c] :
    hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = v - c;
  return { r: r1 + m, g: g1 + m, b: b1 + m };
}

export const hexToHsv = (hex: string): HSV | null => {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb) : null;
};

export const hsvToHex = (hsv: HSV): string => rgbToHex(hsvToRgb(hsv));

/** Perceived brightness 0..1, for deciding whether a tick on a swatch reads. */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

/** Black or white — whichever shows up on `hex`. */
export const contrastInk = (hex: string): string => (luminance(hex) > 0.55 ? "#000000" : "#ffffff");

export const sameColor = (a: string, b: string) => normalizeHex(a) === normalizeHex(b);

// ---- recent colours ----------------------------------------------------------------
// One list shared by every picker in the planner: a colour mixed for the pen is the one
// you're likely to want for a heading or a page tint a moment later, and keeping separate
// lists per tool would mean mixing it again.

export const RECENT_COLORS_KEY = "leadership-os-recent-colours";
export const MAX_RECENT = 12;

export function recentColors(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const v of raw) {
      const h = typeof v === "string" ? normalizeHex(v) : null;
      if (h && !out.includes(h)) out.push(h);
    }
    return out.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Put `hex` at the front of the list and return the new list. */
export function rememberColor(hex: string): string[] {
  const h = normalizeHex(hex);
  if (!h) return recentColors();
  const next = [h, ...recentColors().filter((c) => c !== h)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next));
  } catch {
    // A full or blocked store costs the user their history, not their colour.
  }
  return next;
}
