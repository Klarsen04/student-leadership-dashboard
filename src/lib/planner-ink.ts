// Page content for the /planner notebooks, and the durable save path for it.
//
// A page holds a flat list of elements: pen/highlighter strokes and typed text
// boxes. Coordinates are normalised to the page (0..1 in both axes) so content
// stays put at any screen size or zoom.
//
// Saving is best-effort-but-never-lossy: every edit is mirrored to localStorage
// *before* the network call, and the mirror is only cleared once the server has
// acknowledged the write. A failed save therefore degrades to "not synced yet"
// rather than "your handwriting is gone", and survives a reload or a crash.

export interface Stroke {
  tool: "pen" | "highlighter";
  color: string;
  size: number; // base width as a fraction of page width
  points: [number, number, number][]; // x, y, pressure
}

export interface TextBox {
  kind: "text";
  id: string;
  x: number;
  y: number;
  w: number; // width as a fraction of page width; height grows with the text
  text: string;
  font: string; // key into PLANNER_FONTS
  size: number; // line height as a fraction of page height
  color: string;
  align: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
}

/** Anything that can sit on a page. Strokes predate text boxes and have no `kind`. */
export type PageElement = Stroke | TextBox;

export const isText = (e: PageElement): e is TextBox => (e as TextBox).kind === "text";
export const isStroke = (e: PageElement): e is Stroke => !isText(e);

// ---- typography -----------------------------------------------------------------
// Font stacks are CSS-only, so a text box renders identically in the editable
// overlay and after a reload. The variable fonts come from next/font in the root
// layout; the rest are system stacks that need no download.

export interface PlannerFont {
  key: string;
  name: string;
  stack: string;
}

export const PLANNER_FONTS: PlannerFont[] = [
  { key: "sans", name: "Sans", stack: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" },
  { key: "serif", name: "Serif", stack: "var(--font-instrument-serif), Georgia, 'Times New Roman', serif" },
  { key: "rounded", name: "Rounded", stack: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" },
  { key: "hand", name: "Handwriting", stack: "var(--font-caveat), 'Segoe Script', cursive" },
  { key: "print", name: "Print", stack: "var(--font-patrick-hand), 'Comic Sans MS', cursive" },
  { key: "mono", name: "Mono", stack: "ui-monospace, SFMono-Regular, Menlo, monospace" },
];

export const fontStack = (key: string) =>
  (PLANNER_FONTS.find((f) => f.key === key) ?? PLANNER_FONTS[0]).stack;

/** Text sizes as a fraction of page height — roughly 11pt / 14pt / 18pt / 24pt on A4. */
export const TEXT_SIZES = [0.013, 0.017, 0.022, 0.03];

// ---- payload shaping ------------------------------------------------------------

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/**
 * Drop points too close together to see, and round the rest.
 *
 * A pen reporting coalesced events at 240Hz produces far more precision than a
 * page can show: full doubles cost ~54 bytes per point, which put a densely
 * written page within reach of the server's payload cap. Four decimal places is
 * still sub-pixel on a 4K screen and cuts that to ~17.
 */
export function simplifyStroke(s: Stroke): Stroke {
  const MIN_GAP = 0.0006; // ~1px at 1600px wide
  const out: [number, number, number][] = [];
  for (let i = 0; i < s.points.length; i++) {
    const [x, y, p] = s.points[i];
    const last = out[out.length - 1];
    const isLast = i === s.points.length - 1;
    if (last && !isLast && Math.abs(x - last[0]) < MIN_GAP && Math.abs(y - last[1]) < MIN_GAP) continue;
    out.push([round(x, 4), round(y, 4), round(p, 2)]);
  }
  return { ...s, points: out };
}

export function serializeElements(elements: PageElement[]): string {
  return JSON.stringify(
    elements.map((e) =>
      isText(e)
        ? { ...e, x: round(e.x, 4), y: round(e.y, 4), w: round(e.w, 4), size: round(e.size, 4) }
        : e,
    ),
  );
}

export function parseElements(raw: string | null | undefined): PageElement[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as PageElement[]) : [];
  } catch {
    return [];
  }
}

// ---- local mirror ----------------------------------------------------------------
// Only *unsaved* pages are mirrored, so the store stays small and a leftover
// entry unambiguously means "this page never reached the server".

const LOCAL_PREFIX = "leadership-os-ink:";

const localKey = (plannerId: string, page: number) => `${LOCAL_PREFIX}${plannerId}:${page}`;

export interface LocalPage {
  json: string;
  savedAt: number;
}

export function writeLocal(plannerId: string, page: number, json: string) {
  try {
    localStorage.setItem(localKey(plannerId, page), JSON.stringify({ json, savedAt: Date.now() }));
  } catch {
    // Quota exhausted — the in-memory copy and the server are still the real
    // sources of truth, so a missing mirror only costs crash-resistance.
  }
}

export function readLocal(plannerId: string, page: number): LocalPage | null {
  try {
    const raw = localStorage.getItem(localKey(plannerId, page));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return typeof data?.json === "string" ? data : null;
  } catch {
    return null;
  }
}

export function clearLocal(plannerId: string, page: number) {
  try {
    localStorage.removeItem(localKey(plannerId, page));
  } catch {}
}

/** Pages of this planner that are still waiting to reach the server. */
export function pendingLocalPages(plannerId: string): number[] {
  const prefix = `${LOCAL_PREFIX}${plannerId}:`;
  const pages: number[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const page = parseInt(key.slice(prefix.length), 10);
      if (page > 0) pages.push(page);
    }
  } catch {}
  return pages.sort((a, b) => a - b);
}

/**
 * Drop every mirrored page of one planner — for a deleted notebook, whose unsaved
 * pages would otherwise sit in localStorage waiting to sync to something gone.
 */
export function clearLocalPlanner(plannerId: string) {
  for (const page of pendingLocalPages(plannerId)) clearLocal(plannerId, page);
}

// ---- network ---------------------------------------------------------------------

export interface PushResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Message for a failed save that says what to actually do about it. */
export function saveErrorMessage(r: PushResult): string {
  if (r.status === 401) return "You've been signed out — sign in again to save your notes.";
  if (r.status === 409) return r.error || "Your account wasn't found — sign in again.";
  if (r.status === 413) return "This page is too full to save. Erase something and it'll retry.";
  if (r.status === 0 || r.status === undefined) return "You're offline — your notes are saved on this device and will sync when you reconnect.";
  return r.error ? `Couldn't save: ${r.error}` : "Couldn't save your notes — retrying.";
}

export async function pushPage(plannerId: string, page: number, json: string): Promise<PushResult> {
  try {
    const res = await fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planner: plannerId, page, strokes: json }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    return { ok: false, status: res.status, error: body?.error };
  } catch {
    return { ok: false, status: 0 }; // network down / request blocked
  }
}

/** Backoff for save retries, in ms. Caps out so a long session keeps trying. */
export const retryDelay = (attempt: number) => Math.min(30_000, 2000 * 2 ** Math.min(attempt, 4));
