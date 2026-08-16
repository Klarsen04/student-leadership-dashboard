// The page model: what a notebook's pages are, in what order, and what each one
// is drawn on.
//
// The load-bearing idea is the **slot**. Handwriting is stored per page number
// (`PlannerInk.page`), so if "page 3" meant "the third entry in the list", then
// inserting a page would silently shift everyone's ink down by one. Instead each
// page carries a `slot` — the number its content is stored under — which is
// handed out once and never changes. Reordering, inserting and deleting only ever
// touch the *order* of the list, so content stays welded to its page.
//
//   position  1     2     3     4      <- what the user sees / the URL's ?page=
//   slot      1     7     2     3      <- where the ink for that page lives
//
// A page also owns its own background, colour, size and orientation, which is what
// lets one notebook hold an A5 dotted page and a Letter landscape weekly planner.
// The background is a *reference* (a template id, or "page 4 of the source PDF") —
// never baked into the content layer, so changing paper leaves every stroke alone.
//
// Only the user's own notebooks have an index: shipped planners are read-only and
// keep the implicit "position N = slot N = source page N" model, which is exactly
// what `defaultIndex()` builds anyway.

import type { PlannerInfo } from "@/lib/planners";
import { imageSrc, isPaperBacked, isPdfBacked } from "@/lib/planners";
import {
  PAGE_STORE,
  idbGet,
  idbPut,
  isOwned,
  updateUserPlanner,
  type UserPlanner,
} from "@/lib/planner-library";
import { parseElements, pushPage, serializeElements, type PageElement } from "@/lib/planner-ink";
import {
  DEFAULT_PAGE_COLOR,
  DEFAULT_TEMPLATE,
  aspectOf,
  pageDimensions,
  templateDataUrl,
  templateFor,
  type Orientation,
  type PageGeometry,
  type TemplateDefinition,
} from "@/lib/planner-paper";

/** The ink API rejects page numbers above this, so slots have to fit under it. */
export const MAX_SLOT = 2000;

export interface PatternOverrides {
  spacing?: number;
  lineWidth?: number;
  patternColor?: string;
  patternOpacity?: number;
  margin?: number;
}

/**
 * Where a page's background comes from. `source` means the notebook's own
 * material (a rendered planner page, or a page of the imported PDF); `template`
 * means paper generated from a template definition.
 */
export interface PageBackground {
  kind: "source" | "template";
  /** `source`: which page of the source material, 1-based. */
  sourcePage?: number;
  /** `template`: which template to draw. */
  templateId?: string;
  /** `template`: per-page tweaks to the template's pattern. */
  overrides?: PatternOverrides;
  /** `template`: blob key of a picture template (an imported image or PDF page). */
  imageKey?: string;
}

export interface PageMeta {
  /** Stable content key. Never renumbered — see the note at the top of the file. */
  slot: number;
  background: PageBackground;
  /** Page colour, independent of the template. */
  color?: string;
  /** Page size key from PAGE_SIZES, or "custom". */
  size?: string;
  orientation?: Orientation;
  /** Dimensions in points, when `size` is "custom". */
  custom?: PageGeometry;
  /** Optional name, shown under the thumbnail. */
  label?: string;
}

export interface PageIndex {
  plannerId: string;
  version: 1;
  pages: PageMeta[];
  /** Next slot to hand out. Only ever increases, until it hits MAX_SLOT. */
  nextSlot: number;
  /** Slots of deleted pages, reused only once every fresh slot is spent. */
  freed?: number[];
  updatedAt: number;
}

// ---- building and loading ----------------------------------------------------------

/**
 * The index a notebook has before anyone rearranges it: one page per source page,
 * in order, each in its matching slot. Building this explicitly (rather than
 * treating "no index" as a special case everywhere) means the viewer has one code
 * path for laid-out and untouched notebooks alike.
 */
export function defaultIndex(planner: PlannerInfo): PageIndex {
  const paper = isPaperBacked(planner);
  const pages: PageMeta[] = [];
  for (let i = 1; i <= planner.pages; i++) {
    pages.push(
      paper
        ? {
            slot: i,
            background: { kind: "template", templateId: (planner as UserPlanner).paper ?? DEFAULT_TEMPLATE },
            color: (planner as UserPlanner).tint ?? DEFAULT_PAGE_COLOR,
          }
        : { slot: i, background: { kind: "source", sourcePage: i } },
    );
  }
  return {
    plannerId: planner.id,
    version: 1,
    pages,
    nextSlot: planner.pages + 1,
    updatedAt: 0,
  };
}

/**
 * A notebook's saved page arrangement, or the default one. Read-only planners
 * never get a stored index — nobody can rearrange them — so they always resolve
 * to the default.
 */
export async function loadPageIndex(planner: PlannerInfo): Promise<PageIndex> {
  if (!isOwned(planner)) return defaultIndex(planner);
  const stored = await idbGet<PageIndex>(PAGE_STORE, planner.id);
  const valid =
    stored &&
    Array.isArray(stored.pages) &&
    stored.pages.length > 0 &&
    stored.pages.every((p) => Number.isFinite(p?.slot) && p.slot >= 1 && Boolean(p.background));
  if (!valid) return defaultIndex(planner);
  // The page count on the notebook record is what the library card shows; the
  // index is the truth, so trust the index and let a save reconcile the record.
  return { ...stored, plannerId: planner.id };
}

/**
 * Persist an arrangement, keeping the notebook record's page count in step so the
 * library card and the initial page bounds stay right.
 */
export async function savePageIndex(index: PageIndex): Promise<void> {
  const next: PageIndex = { ...index, updatedAt: Date.now() };
  await idbPut(PAGE_STORE, next);
  await updateUserPlanner(index.plannerId, { pages: index.pages.length });
}

/** True once the arrangement differs from the plain "page N = source page N" one. */
export const isRearranged = (index: PageIndex) =>
  index.pages.some((p, i) => p.slot !== i + 1 || p.background.kind !== "source" || p.background.sourcePage !== i + 1);

// ---- geometry and backgrounds -------------------------------------------------------

/** A page's size in points, falling back to the notebook's own page shape. */
export function pageGeometry(page: PageMeta | undefined, planner: PlannerInfo): PageGeometry {
  if (page?.size) return pageDimensions(page.size, page.orientation ?? "portrait", page.custom);
  const aspect = planner.aspect || 595 / 842;
  return { w: 612, h: Math.round(612 / aspect) };
}

export const pageAspect = (page: PageMeta | undefined, planner: PlannerInfo) =>
  aspectOf(pageGeometry(page, planner));

/**
 * What to draw behind a page. `pdf` means "ask the PdfRenderer for this page of
 * the imported document"; everything else resolves to an image URL directly.
 */
export type ResolvedBackground =
  | { kind: "image"; src: string }
  | { kind: "pdf"; page: number }
  | { kind: "none" };

export interface ResolveOptions {
  /** Templates the user made, so a page can reference one. */
  customTemplates?: TemplateDefinition[];
  /** Resolved object URL for a picture template's blob, if it has been loaded. */
  imageUrl?: string;
  /** How many times smaller than the page this will be shown — see RenderOptions. */
  shrink?: number;
}

export function resolveBackground(
  page: PageMeta | undefined,
  planner: PlannerInfo,
  opts: ResolveOptions = {},
): ResolvedBackground {
  if (!page) return { kind: "none" };
  const bg = page.background;

  if (bg.kind === "template") {
    const def = templateFor(bg.templateId, opts.customTemplates ?? []);
    // A picture template whose blob hasn't loaded yet draws as plain paper for a
    // frame rather than flashing an empty page.
    return {
      kind: "image",
      src: templateDataUrl(def, {
        page: pageGeometry(page, planner),
        color: page.color ?? def.background ?? DEFAULT_PAGE_COLOR,
        overrides: bg.overrides,
        imageUrl: opts.imageUrl,
        shrink: opts.shrink,
      }),
    };
  }

  const sourcePage = bg.sourcePage ?? 1;
  if (isPdfBacked(planner)) return { kind: "pdf", page: sourcePage };
  if (isPaperBacked(planner)) {
    // A paper-backed notebook has no rendered pages: its "source" is its paper.
    const def = templateFor((planner as UserPlanner).paper, opts.customTemplates ?? []);
    return {
      kind: "image",
      src: templateDataUrl(def, {
        page: pageGeometry(page, planner),
        color: page.color ?? (planner as UserPlanner).tint ?? DEFAULT_PAGE_COLOR,
        shrink: opts.shrink,
      }),
    };
  }
  return { kind: "image", src: imageSrc(planner, sourcePage) };
}

// ---- slot allocation ----------------------------------------------------------------

/**
 * Take the next content slot.
 *
 * Fresh slots are preferred, so a new page never lands on a deleted page's
 * handwriting. Only once all 2000 are spent does it recycle a freed slot, and it
 * says so — the caller then has to clear that slot's content before using it.
 */
export function allocSlot(index: PageIndex): { slot: number; recycled: boolean; index: PageIndex } | null {
  if (index.nextSlot <= MAX_SLOT) {
    return { slot: index.nextSlot, recycled: false, index: { ...index, nextSlot: index.nextSlot + 1 } };
  }
  const freed = [...(index.freed ?? [])];
  const inUse = new Set(index.pages.map((p) => p.slot));
  while (freed.length) {
    const slot = freed.shift()!;
    if (!inUse.has(slot)) return { slot, recycled: true, index: { ...index, freed } };
  }
  return null;
}

// ---- page operations ----------------------------------------------------------------
// All pure: each takes an index and returns a new one, which is what makes undo a
// matter of keeping the previous index (a few hundred bytes of metadata) rather
// than of snapshotting content.

export interface NewPageSpec {
  background: PageBackground;
  color?: string;
  size?: string;
  orientation?: Orientation;
  custom?: PageGeometry;
  label?: string;
}

export interface InsertResult {
  index: PageIndex;
  /** Slots that were recycled and whose stale content the caller must clear. */
  clear: number[];
  /** 1-based position of the first page added. */
  at: number;
}

/**
 * Insert `count` pages so the first lands at 1-based position `at`. `at` beyond
 * the end appends.
 */
export function insertPages(index: PageIndex, at: number, count: number, spec: NewPageSpec): InsertResult {
  const pos = Math.max(1, Math.min(index.pages.length + 1, Math.round(at)));
  const n = Math.max(1, Math.min(MAX_SLOT, Math.round(count)));
  let work = index;
  const added: PageMeta[] = [];
  const clear: number[] = [];
  for (let i = 0; i < n; i++) {
    if (work.pages.length + added.length >= MAX_SLOT) break;
    const got = allocSlot(work);
    if (!got) break;
    work = got.index;
    if (got.recycled) clear.push(got.slot);
    added.push({ ...spec, slot: got.slot });
  }
  const pages = [...work.pages];
  pages.splice(pos - 1, 0, ...added);
  return { index: { ...work, pages }, clear, at: pos };
}

export interface DuplicateResult extends InsertResult {
  /** Source slot → new slot, for the caller to copy content across. */
  copies: Array<{ from: number; to: number }>;
}

/**
 * Duplicate the pages at the given 1-based positions, each new page landing
 * immediately after the block. Content is not copied here — the caller does that
 * with `copySlot`, because it is a server round trip.
 */
export function duplicatePages(index: PageIndex, positions: number[]): DuplicateResult {
  const picked = normalise(positions, index.pages.length);
  if (!picked.length) return { index, clear: [], at: 1, copies: [] };
  let work = index;
  const added: PageMeta[] = [];
  const copies: Array<{ from: number; to: number }> = [];
  const clear: number[] = [];
  for (const pos of picked) {
    const src = index.pages[pos - 1];
    if (work.pages.length + added.length >= MAX_SLOT) break;
    const got = allocSlot(work);
    if (!got) break;
    work = got.index;
    if (got.recycled) clear.push(got.slot);
    added.push({ ...src, slot: got.slot, label: src.label ? `${src.label} (copy)` : undefined });
    copies.push({ from: src.slot, to: got.slot });
  }
  const after = picked[picked.length - 1];
  const pages = [...work.pages];
  pages.splice(after, 0, ...added);
  return { index: { ...work, pages }, clear, at: after + 1, copies };
}

/**
 * Remove pages at the given 1-based positions. Their slots are recorded as freed
 * but their content is deliberately left on the server: undo has to be able to
 * bring the page back with its handwriting, and a page is small metadata whereas
 * handwriting is the thing you can't recreate. A notebook always keeps one page.
 */
export function deletePages(index: PageIndex, positions: number[]): PageIndex {
  const picked = new Set(normalise(positions, index.pages.length));
  if (!picked.size) return index;
  const pages = index.pages.filter((_, i) => !picked.has(i + 1));
  if (!pages.length) return index;
  const freed = [...(index.freed ?? []), ...index.pages.filter((_, i) => picked.has(i + 1)).map((p) => p.slot)];
  return { ...index, pages, freed };
}

/**
 * Move the pages at `positions` so they sit before the page currently at 1-based
 * `before` (`pages.length + 1` moves them to the end). The moved pages keep their
 * relative order and, being the same page objects, their content.
 */
export function movePages(index: PageIndex, positions: number[], before: number): PageIndex {
  const picked = normalise(positions, index.pages.length);
  if (!picked.length) return index;
  const moving = picked.map((p) => index.pages[p - 1]);
  const set = new Set(picked);
  const rest = index.pages.filter((_, i) => !set.has(i + 1));
  // Count how many of the pages before the drop point are being lifted out, so
  // the insertion point still means the same gap after the removal.
  const lifted = picked.filter((p) => p < before).length;
  const target = Math.max(0, Math.min(rest.length, before - 1 - lifted));
  const pages = [...rest];
  pages.splice(target, 0, ...moving);
  return { ...index, pages };
}

/** Patch the given pages — background, colour, size or orientation. */
export function setPageProps(index: PageIndex, positions: number[], patch: Partial<Omit<PageMeta, "slot">>): PageIndex {
  const picked = new Set(normalise(positions, index.pages.length));
  if (!picked.size) return index;
  return {
    ...index,
    pages: index.pages.map((p, i) => (picked.has(i + 1) ? { ...p, ...patch } : p)),
  };
}

/** Sorted, de-duplicated, in-range positions. */
function normalise(positions: number[], length: number): number[] {
  return [...new Set(positions.map((p) => Math.round(p)))].filter((p) => p >= 1 && p <= length).sort((a, b) => a - b);
}

// ---- content moves ------------------------------------------------------------------

/** Read one slot's content straight from the server, bypassing any cache. */
export async function fetchSlot(plannerId: string, slot: number): Promise<PageElement[]> {
  try {
    const res = await fetch(`/api/planner?planner=${encodeURIComponent(plannerId)}&page=${slot}`);
    if (!res.ok) return [];
    const data = await res.json();
    return parseElements(data?.strokes);
  } catch {
    return [];
  }
}

/**
 * Copy one page's content to another slot. Used by page duplication; returns
 * false if the copy didn't reach the server, which the caller reports rather than
 * pretending the page duplicated cleanly.
 */
export async function copySlot(plannerId: string, from: number, to: number): Promise<boolean> {
  const elements = await fetchSlot(plannerId, from);
  if (!elements.length) return true;
  return (await pushPage(plannerId, to, serializeElements(elements))).ok;
}

/** Blank a slot, for the rare case where a recycled slot still holds content. */
export async function clearSlot(plannerId: string, slot: number): Promise<void> {
  await pushPage(plannerId, slot, serializeElements([]));
}
