// The user's own notebooks: PDFs they imported, and duplicates they made of
// planners already in the library.
//
// Where this lives, and why: the built-in planners are pre-rendered to WebP by
// scripts/add-planner.mjs at build time, which a user in a browser can't do. So
// an imported PDF is kept as the original file in IndexedDB and rendered on
// demand by pdf.js, page by page. That keeps a 30 MB notebook off the server
// entirely — the deployment has no blob storage and a serverless request body
// cap well under a typical planner PDF.
//
// The consequence is that an imported notebook's *file* lives on the device that
// imported it. Nothing else does. Handwriting is keyed by planner id and syncs
// through /api/planner, and since the notebook list itself now syncs through
// /api/sync (see syncUserPlanners below), an import shows up on every device —
// the ones without the file offer to re-add it, which relinks the same id and
// picks the ink back up.
//
// A "copy" stores no file at all — it points at the planner it was duplicated
// from and only claims a fresh id, so it gets its own ink layer. A "blank"
// notebook has no source at all: its pages are drawn from a paper template
// (src/lib/planner-paper.ts).
//
// Only these three kinds are editable. The shipped planners are read-only — you
// duplicate one to write in it — which is what keeps a stray stroke out of a
// notebook every other user shares.

import type { Hotspot } from "@/lib/planner";
import type { PlannerInfo } from "@/lib/planners";
import { clearLocalPlanner } from "@/lib/planner-ink";
import { DEFAULT_PAPER, DEFAULT_TINT } from "@/lib/planner-paper";
import { deleteDoc, docValue, pullScope, pushDoc, pushDocs } from "@/lib/sync";

const DB_NAME = "leadora-planner-library";
const DB_VERSION = 2;
const META_STORE = "meta";
export const FILE_STORE = "files";
/** Per-notebook page index (src/lib/planner-pages.ts), keyed by planner id. */
export const PAGE_STORE = "pages";
/** Reusable elements the user saved out of a page, keyed by element id. */
export const ELEMENT_STORE = "elements";
/** Templates the user made, keyed by template id. */
export const TEMPLATE_STORE = "templates";

export const USER_CATEGORY = "My Notebooks";

/** Hard limits: the ink API rejects pages above 2000, and huge files stall import. */
export const MAX_IMPORT_PAGES = 2000;
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export interface UserPlanner extends PlannerInfo {
  /** How this notebook came to exist. */
  kind: "import" | "copy" | "blank";
  createdAt: number;
  /** Last metadata change, so two devices can tell whose copy is newer. */
  updatedAt?: number;
  /** import: key of the PDF blob in IndexedDB. */
  pdfKey?: string;
  /** copy: the planner id this was duplicated from. */
  sourceId?: string;
  /** blank: paper template key + page tint (src/lib/planner-paper.ts). */
  paper?: string;
  tint?: string;
}

/**
 * True for the user's own notebooks — the only ones that can be written in,
 * renamed or deleted. Shipped planners have no `kind`.
 */
export const isOwned = (p: PlannerInfo): p is UserPlanner => "kind" in p;

// ---- IndexedDB plumbing -----------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Each store is created only if missing, so the same handler upgrades a v1
      // database and builds a fresh one.
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
      if (!db.objectStoreNames.contains(PAGE_STORE)) db.createObjectStore(PAGE_STORE, { keyPath: "plannerId" });
      if (!db.objectStoreNames.contains(ELEMENT_STORE)) db.createObjectStore(ELEMENT_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) db.createObjectStore(TEMPLATE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

// Generic record access, used by the page index, the element library and the user's
// own templates. Every one of them is "one JSON record per key", so they share the
// same three calls rather than each opening the database its own way. Reads
// swallow errors (a missing store or a blocked upgrade should degrade to "nothing
// saved yet"); writes propagate so callers can tell the user a save failed.

export async function idbGet<T>(store: string, key: IDBValidKey): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    return (await tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>)) ?? null;
  } catch {
    return null;
  }
}

export async function idbAll<T>(store: string): Promise<T[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    return (await tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>)) ?? [];
  } catch {
    return [];
  }
}

export async function idbPut(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
  await tx(store, "readwrite", (s) => (key === undefined ? s.put(value) : s.put(value, key)));
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  try {
    await tx(store, "readwrite", (s) => s.delete(key));
  } catch {
    // Deleting something that isn't there is not a failure worth reporting.
  }
}

/** This device's notebooks, newest first. Local only — see loadUserPlanners. */
export async function listUserPlanners(): Promise<UserPlanner[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const all = await tx<UserPlanner[]>(META_STORE, "readonly", (s) => s.getAll() as IDBRequest<UserPlanner[]>);
    return all.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

async function putMeta(meta: UserPlanner) {
  const next = { ...meta, updatedAt: Date.now() };
  await tx(META_STORE, "readwrite", (s) => s.put(next));
  // Best-effort: IndexedDB already has it, so a failed push means "not on the
  // other devices yet", not "lost".
  void pushDoc("notebook", next.id, next);
  return next;
}

// ---- cross-device sync ------------------------------------------------------------
//
// The notebook list is per-account, not per-device. A device pulls the account's
// notebooks, reconciles them against its own IndexedDB, and pushes anything the
// account hasn't seen — which is also how notebooks made before this existed get
// carried up the first time the app is opened.
//
// Reconciling is per notebook and by id, never a wholesale replace: two devices
// each holding a notebook the other doesn't must end up with both.

/**
 * Whether this device holds the PDF an imported notebook needs.
 *
 * A copy or a blank notebook needs no file, so they're always openable. An import
 * that syncs to a second device arrives without its PDF; the library says so and
 * offers to re-add it rather than opening a notebook that can't render.
 */
export async function fileMissing(meta: PlannerInfo): Promise<boolean> {
  const p = meta as UserPlanner;
  if (p.kind !== "import" || !p.pdfKey) return false;
  return (await getFile(p.pdfKey)) === null;
}

/**
 * Merge the account's notebooks with this device's and return the result.
 *
 * Conflicts are settled by `updatedAt` — last edit wins, which for renaming a
 * notebook on one device while it sits idle on another is exactly right. A
 * tombstone always wins, so deleting a notebook on one device removes it
 * everywhere instead of being resurrected by the next device that syncs.
 *
 * Offline, or signed out, this is just `listUserPlanners()`.
 */
export async function syncUserPlanners(): Promise<UserPlanner[]> {
  const local = await listUserPlanners();
  const remote = await pullScope("notebook");
  if (!remote) return local;

  const byId = new Map(local.map((m) => [m.id, m]));
  const push: { key: string; value: UserPlanner }[] = [];
  const seen = new Set<string>();

  for (const doc of remote) {
    seen.add(doc.key);
    const mine = byId.get(doc.key);
    if (doc.deleted) {
      // Deleted elsewhere. Drop the local copy, but leave the ink alone: this
      // device isn't the one that decided, and deleteUserPlanner already told
      // the server what to do with it.
      if (mine) {
        byId.delete(doc.key);
        await idbDelete(META_STORE, doc.key);
        await idbDelete(PAGE_STORE, doc.key);
      }
      continue;
    }
    const theirs = docValue<UserPlanner>(doc);
    if (!theirs || typeof theirs.id !== "string" || theirs.id !== doc.key) continue;
    if (!mine || (theirs.updatedAt ?? 0) > (mine.updatedAt ?? mine.createdAt ?? 0)) {
      // Their metadata wins — except for pdfKey, which names a blob in *this*
      // device's IndexedDB. Keeping ours means a device that has the file
      // doesn't lose track of it because another device synced without one.
      const merged: UserPlanner = { ...theirs, pdfKey: mine?.pdfKey ?? theirs.pdfKey };
      byId.set(merged.id, merged);
      await tx(META_STORE, "readwrite", (s) => s.put(merged));
    } else if ((mine.updatedAt ?? 0) > (theirs.updatedAt ?? 0)) {
      push.push({ key: mine.id, value: mine });
    }
  }

  // Notebooks this device has that the account has never heard of.
  for (const mine of byId.values()) {
    if (!seen.has(mine.id)) push.push({ key: mine.id, value: mine });
  }
  if (push.length) void pushDocs("notebook", push);

  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function renameUserPlanner(id: string, name: string) {
  await updateUserPlanner(id, { name });
}

/**
 * Patch one notebook's metadata. Returns the saved record, or null if the id is
 * not one of the user's notebooks (shipped planners are read-only).
 */
export async function updateUserPlanner(
  id: string,
  patch: Partial<Omit<UserPlanner, "id" | "kind" | "createdAt">>,
): Promise<UserPlanner | null> {
  const all = await listUserPlanners();
  const meta = all.find((m) => m.id === id);
  if (!meta) return null;
  return await putMeta({ ...meta, ...patch });
}

/**
 * Remove a notebook. The PDF is only deleted once no other notebook still
 * points at it, so deleting an import that has copies doesn't break them.
 *
 * Handwriting: an import keeps its ink server-side, because re-importing the same
 * PDF lands on the same notebook and picks it back up. A copy or a blank notebook
 * has no way back — the id is gone — so its ink is deleted with it rather than
 * left orphaned in the account.
 */
export async function deleteUserPlanner(id: string) {
  const all = await listUserPlanners();
  const meta = all.find((m) => m.id === id);
  await tx(META_STORE, "readwrite", (s) => s.delete(id));
  await idbDelete(PAGE_STORE, id);
  // Tombstone both documents so the other devices drop their copies rather than
  // syncing this notebook straight back.
  void deleteDoc("notebook", id);
  void deleteDoc("pageIndex", id);
  if (meta?.pdfKey) {
    const stillUsed = all.some((m) => m.id !== id && m.pdfKey === meta.pdfKey);
    if (!stillUsed) await tx(FILE_STORE, "readwrite", (s) => s.delete(meta.pdfKey!));
  }
  if (meta && meta.kind !== "import") {
    clearLocalPlanner(id);
    // Best-effort: the notebook is already gone from the library either way.
    await fetch(`/api/planner?planner=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }
}

/**
 * The same reconcile as `syncUserPlanners`, for the plain id-keyed stores: the
 * user's stickers and their custom templates. Both are "one small JSON record per
 * id" with nothing device-specific in them, so they need no special cases.
 *
 * Records without an `updatedAt` fall back to `createdAt`, which is what every
 * record saved before this existed has.
 */
export async function syncRecords<T extends { id: string; updatedAt?: number; createdAt?: number }>(
  store: string,
  scope: "sticker" | "template",
): Promise<T[]> {
  const local = await idbAll<T>(store);
  const remote = await pullScope(scope);
  if (!remote) return local;

  const stamp = (r: T) => r.updatedAt ?? r.createdAt ?? 0;
  const byId = new Map(local.map((r) => [r.id, r]));
  const push: { key: string; value: T }[] = [];
  const seen = new Set<string>();

  for (const doc of remote) {
    seen.add(doc.key);
    const mine = byId.get(doc.key);
    if (doc.deleted) {
      if (mine) {
        byId.delete(doc.key);
        await idbDelete(store, doc.key);
      }
      continue;
    }
    const theirs = docValue<T>(doc);
    if (!theirs || theirs.id !== doc.key) continue;
    if (!mine || stamp(theirs) > stamp(mine)) {
      byId.set(theirs.id, theirs);
      await idbPut(store, theirs).catch(() => {});
    } else if (stamp(mine) > stamp(theirs)) {
      push.push({ key: mine.id, value: mine });
    }
  }
  for (const mine of byId.values()) if (!seen.has(mine.id)) push.push({ key: mine.id, value: mine });
  if (push.length) void pushDocs(scope, push);

  return [...byId.values()];
}

export async function putFile(key: string, blob: Blob) {
  await tx(FILE_STORE, "readwrite", (s) => s.put(blob, key));
}

export async function getFile(key: string): Promise<Blob | null> {
  try {
    return (await tx<Blob | undefined>(FILE_STORE, "readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>)) ?? null;
  } catch {
    return null;
  }
}

// ---- ids -------------------------------------------------------------------------

/**
 * A planner id doubles as the ink namespace, so it has to satisfy the API's
 * `^[a-z0-9][a-z0-9-]{0,39}$` and never collide with an existing notebook.
 */
function newId(prefix: "u" | "c" | "b", taken: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const id = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
    if (!taken.has(id)) return id;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

// ---- pdf.js ----------------------------------------------------------------------

// The minimal slice of pdf.js we use, so callers stay typed without a build/pdf
// declaration file (which pdfjs-dist doesn't ship for the sub-path).
interface Pdfjs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: any): { promise: Promise<any> };
}

let pdfjsPromise: Promise<Pdfjs> | null = null;

function loadPdfjs(): Promise<Pdfjs> {
  // Load pdf.js as a native browser module straight from /public rather than
  // letting webpack bundle it: webpack's ESM interop mangles pdf.js's module
  // shape ("Object.defineProperty called on non-object"). The magic comment
  // keeps webpack from rewriting the import, so the browser fetches the file
  // itself. Both files are copied into /public by scripts/copy-pdf-worker.mjs
  // from predev/prebuild, so they always match the installed version.
  pdfjsPromise ??= (
    // @ts-expect-error — served from /public, not a resolvable module specifier
    import(/* webpackIgnore: true */ "/pdf.min.mjs") as Promise<Pdfjs>
  ).then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod;
  });
  return pdfjsPromise;
}

/**
 * Open a PDF, returning the document and the call that shuts its worker down.
 *
 * The teardown is separate because pdf.js 6 removed `destroy()` from the document
 * itself — only the loading task can end the worker — and forgetting to call it
 * leaks a worker thread per import.
 */
async function openPdf(data: ArrayBuffer): Promise<{ doc: any; close: () => Promise<void> }> {
  const pdfjs = await loadPdfjs();
  // No isEvalSupported here: pdf.js 6 dropped that option along with the
  // eval-based path it guarded — the fix for GHSA-hq66-cqwq-w95j. The bundle and
  // worker carry no eval at all now, so this runs under the production CSP,
  // which grants no 'unsafe-eval'.
  const task = pdfjs.getDocument({ data }) as { promise: Promise<any>; destroy(): Promise<void> };
  return { doc: await task.promise, close: () => task.destroy() };
}

/**
 * Pull the PDF's own hyperlinks out as normalised hotspots, keyed by page — this
 * is what makes an imported planner's month tabs tappable.
 *
 * Annotation rects are in PDF user space: y runs bottom-up, the crop box need
 * not start at the origin, and the page may declare a rotation. Rather than
 * reimplement that, both corners go through the page's own viewport transform,
 * which lands them in the same top-left pixel space as the rendered image.
 */
async function extractLinks(doc: any, pages: number, onPage?: (done: number) => void) {
  const links: Record<string, Hotspot[]> = {};
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const { width: W, height: H } = viewport;
    const spots: Hotspot[] = [];
    for (const a of (await page.getAnnotations()) as any[]) {
      if (a.subtype !== "Link" || !a.rect) continue;
      const target = await destinationPage(doc, a);
      if (!target || target < 1 || target > pages) continue;
      const [ax1, ay1, ax2, ay2] = a.rect;
      const [vx1, vy1] = viewport.convertToViewportPoint(ax1, ay1);
      const [vx2, vy2] = viewport.convertToViewportPoint(ax2, ay2);
      const x = Math.min(vx1, vx2) / W;
      const y = Math.min(vy1, vy2) / H;
      const w = Math.abs(vx2 - vx1) / W;
      const h = Math.abs(vy2 - vy1) / H;
      // A degenerate or page-sized rect is a scanning artefact, not a tab, and
      // would swallow every tap on the page.
      if (w < 0.004 || h < 0.004 || (w > 0.96 && h > 0.96)) continue;
      spots.push({ x, y, w, h, page: target, label: `Page ${target}` });
    }
    if (spots.length) links[String(p)] = spots;
    page.cleanup();
    // Yield periodically so importing a 500-page PDF doesn't freeze the tab.
    if (p % 20 === 0) {
      onPage?.(p);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onPage?.(pages);
  return links;
}

/** 1-based page a link annotation points at, or null if it leaves the document. */
async function destinationPage(doc: any, a: any): Promise<number | null> {
  try {
    const dest = a.dest ? (typeof a.dest === "string" ? await doc.getDestination(a.dest) : a.dest) : null;
    const ref = dest?.[0];
    if (ref == null) return null;
    // An explicit destination names a page by reference; some PDFs store a plain
    // page index instead.
    if (typeof ref === "number") return ref + 1;
    return (await doc.getPageIndex(ref)) + 1;
  } catch {
    return null;
  }
}


export interface ImportProgress {
  (stage: "reading" | "links", done: number, total: number): void;
}

/** Import a PDF as a personal notebook. Throws with a user-facing message. */
export async function importPdf(file: File, onProgress?: ImportProgress): Promise<UserPlanner> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`That PDF is ${(file.size / 1024 / 1024).toFixed(0)} MB — the limit is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
  }
  onProgress?.("reading", 0, 1);
  const bytes = await file.arrayBuffer();
  // pdf.js takes ownership of the buffer it parses, so keep a copy for storage.
  const { doc, close } = await openPdf(bytes.slice(0));
  let W: number, H: number, pages: number, links: Record<string, Hotspot[]>;
  try {
    pages = doc.numPages;
    if (!pages) throw new Error("That PDF has no pages.");
    if (pages > MAX_IMPORT_PAGES) {
      throw new Error(`That PDF has ${pages} pages — the limit is ${MAX_IMPORT_PAGES}.`);
    }

    // Viewport rather than `view`: it accounts for the crop-box origin and any
    // declared page rotation, so a landscape scan doesn't come out portrait.
    const first = await doc.getPage(1);
    ({ width: W, height: H } = first.getViewport({ scale: 1 }));

    onProgress?.("links", 0, pages);
    links = await extractLinks(doc, pages, (done) => onProgress?.("links", done, pages));
  } finally {
    // Always let the worker go, including on a rejected import.
    await close().catch(() => {});
  }

  const existing = await listUserPlanners();
  const id = newId("u", new Set(existing.map((m) => m.id)));
  const pdfKey = `pdf-${id}`;
  await putFile(pdfKey, new Blob([bytes], { type: "application/pdf" }));

  const linkCount = Object.values(links).reduce((n, l) => n + l.length, 0);
  const meta: UserPlanner = {
    id,
    kind: "import",
    name: file.name.replace(/\.pdf$/i, "").slice(0, 80) || "Imported notebook",
    description: linkCount
      ? `Imported PDF · ${pages} pages · ${linkCount} tappable links`
      : `Imported PDF · ${pages} pages`,
    category: USER_CATEGORY,
    pages,
    aspect: Number((W / H).toFixed(5)),
    sizeMb: Number((file.size / 1024 / 1024).toFixed(1)),
    createdAt: Date.now(),
    pdfKey,
    links: Object.keys(links).length ? links : undefined,
  };
  await putMeta(meta);
  return meta;
}

/**
 * Give an imported notebook its PDF on *this* device.
 *
 * An import syncs as metadata — its file is far too big for the account — so on a
 * second device the notebook is listed but can't render. This puts the file back
 * under the notebook's existing key, which keeps the id, and with it every page
 * of handwriting already saved against it.
 *
 * The page count has to match. Attaching a different document would leave every
 * stroke sitting on the wrong page, and silently is the worst way to find out.
 */
export async function attachPdf(meta: UserPlanner, file: File): Promise<UserPlanner> {
  if (meta.kind !== "import" || !meta.pdfKey) {
    throw new Error("That notebook doesn't use a PDF.");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`That PDF is ${(file.size / 1024 / 1024).toFixed(0)} MB — the limit is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`);
  }
  const bytes = await file.arrayBuffer();
  // pdf.js takes ownership of the buffer it parses, so keep a copy for storage.
  const { doc, close } = await openPdf(bytes.slice(0));
  let pages: number;
  try {
    pages = doc.numPages;
  } finally {
    await close().catch(() => {});
  }
  if (!pages) throw new Error("That PDF has no pages.");
  if (pages !== meta.pages) {
    throw new Error(
      `“${meta.name}” has ${meta.pages} pages but that PDF has ${pages}. Pick the same file you imported, so your handwriting lines up.`,
    );
  }
  await putFile(meta.pdfKey, new Blob([bytes], { type: "application/pdf" }));
  // The record itself is unchanged, so nothing is pushed: the file is what this
  // device was missing, and the file never leaves it.
  return meta;
}

/** Name a copy would get by default, so the rename box can be pre-filled. */
export async function suggestedCopyName(source: PlannerInfo): Promise<string> {
  const existing = await listUserPlanners();
  const base = stripCopySuffix(source.name);
  const taken = new Set(existing.map((m) => m.name));
  if (!taken.has(`${base} (copy)`)) return `${base} (copy)`;
  for (let n = 2; n < 200; n++) {
    if (!taken.has(`${base} (copy ${n})`)) return `${base} (copy ${n})`;
  }
  return `${base} (copy)`;
}

export interface DuplicateOptions {
  /** Overrides the suggested "(copy)" name. */
  name?: string;
  /** Carry the source's handwriting into the copy (default: yes). */
  withInk?: boolean;
}

/**
 * Duplicate a notebook. The copy reuses its source's pages — and its PDF, if it
 * has one — but takes a new id, which is what gives it an independent ink layer.
 *
 * Handwriting lives server-side keyed by planner id, so copying it is a separate
 * request the caller makes; `withInk: false` skips it for a clean start.
 */
export async function duplicatePlanner(
  source: PlannerInfo | UserPlanner,
  opts: DuplicateOptions = {},
): Promise<UserPlanner> {
  const existing = await listUserPlanners();
  const id = newId("c", new Set(existing.map((m) => m.id)));
  const src = source as UserPlanner;

  // Copying a copy points at the original rather than building a chain, so the
  // page images always resolve in one hop.
  const sourceId = src.kind === "copy" && src.sourceId ? src.sourceId : source.id;
  // Everything else is taken from the notebook actually being duplicated, so its
  // paper, page count and per-page arrangement come along.
  const base = source;
  const name = opts.name?.trim().slice(0, 80) || (await suggestedCopyName(source));
  const withInk = opts.withInk !== false;

  const meta: UserPlanner = {
    ...base,
    id,
    kind: "copy",
    sourceId,
    name,
    category: USER_CATEGORY,
    description: withInk
      ? `Your copy of ${stripCopySuffix(source.name)} — edit freely.`
      : `Blank copy of ${stripCopySuffix(source.name)} — its own handwriting, same pages.`,
    createdAt: Date.now(),
  };
  await putMeta(meta);
  // The page index travels with the copy: its slots are the ink page keys, and
  // the ink is cloned slot-for-slot, so a rearranged notebook duplicates as it
  // looks rather than as its source was ordered.
  const index = await idbGet<{ plannerId: string }>(PAGE_STORE, source.id);
  if (index) {
    const copied = { ...index, plannerId: id, updatedAt: Date.now() };
    await idbPut(PAGE_STORE, copied);
    void pushDoc("pageIndex", id, copied);
  }
  // Ink comes from the notebook being duplicated, not from the image source: a
  // copy of your marked-up copy has to carry your handwriting, not the original's.
  if (withInk) await copyInk(source.id, id);
  return meta;
}

/**
 * Ask the server to clone one notebook's ink onto another id. Best-effort: a
 * failure leaves a usable blank copy rather than blocking the duplicate, so the
 * caller only needs to tell the user what happened.
 */
export async function copyInk(from: string, to: string): Promise<{ pages: number } | null> {
  try {
    const res = await fetch("/api/planner/duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const stripCopySuffix = (name: string) => name.replace(/\s*\(copy(?:\s+\d+)?\)$/, "");

// ---- blank notebooks --------------------------------------------------------------

export interface NewNotebook {
  name: string;
  paper: string;
  aspect: number;
  pages: number;
  tint?: string;
}

/** Create an empty notebook from a paper template. */
export async function createBlankNotebook(opts: NewNotebook): Promise<UserPlanner> {
  const existing = await listUserPlanners();
  const id = newId("b", new Set(existing.map((m) => m.id)));
  const pages = Math.max(1, Math.min(MAX_IMPORT_PAGES, Math.round(opts.pages) || 1));
  const meta: UserPlanner = {
    id,
    kind: "blank",
    name: opts.name.trim().slice(0, 80) || "New notebook",
    description: `${pages} ${pages === 1 ? "page" : "pages"} · add more any time`,
    category: USER_CATEGORY,
    pages,
    aspect: Number(opts.aspect.toFixed(5)),
    createdAt: Date.now(),
    paper: opts.paper || DEFAULT_PAPER,
    tint: opts.tint || DEFAULT_TINT,
  };
  await putMeta(meta);
  return meta;
}

// Adding, inserting, duplicating, deleting and reordering pages all live in
// src/lib/planner-pages.ts: they work on the notebook's page index, where each
// page keeps a stable ink slot, so rearranging pages can't shuffle handwriting.

/** Folder the page images come from: a copy reads its source's renders. */
export const imageBaseId = (p: PlannerInfo) => (p as UserPlanner).sourceId ?? p.id;

// ---- on-demand page rendering ------------------------------------------------------

/**
 * Renders pages of an imported PDF to object URLs, one document kept open per
 * renderer. Pages are cached because flipping back and forth is the common case,
 * and evicted oldest-first so a 700-page notebook can't grow without bound.
 */
export class PdfRenderer {
  private docPromise: Promise<{ doc: any; close: () => Promise<void> }> | null = null;
  private cache = new Map<number, string>();
  private order: number[] = [];
  private readonly limit = 12;
  private destroyed = false;

  constructor(private pdfKey: string, private targetWidth = 1600) {}

  private async doc() {
    this.docPromise ??= (async () => {
      const blob = await getFile(this.pdfKey);
      if (!blob) throw new Error("This notebook's PDF isn't on this device.");
      return openPdf(await blob.arrayBuffer());
    })();
    return this.docPromise;
  }

  async page(n: number): Promise<string> {
    const hit = this.cache.get(n);
    if (hit) return hit;
    const { doc } = await this.doc();
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, this.targetWidth / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
    if (this.destroyed) return "";
    const url = URL.createObjectURL(blob ?? new Blob());
    this.cache.set(n, url);
    this.order.push(n);
    while (this.order.length > this.limit) {
      const old = this.order.shift()!;
      const stale = this.cache.get(old);
      if (stale && old !== n) {
        URL.revokeObjectURL(stale);
        this.cache.delete(old);
      }
    }
    return url;
  }

  destroy() {
    this.destroyed = true;
    for (const url of this.cache.values()) URL.revokeObjectURL(url);
    this.cache.clear();
    this.order = [];
    this.docPromise?.then(({ close }) => close()).catch(() => {});
    this.docPromise = null;
  }
}

/**
 * Render one page of a PDF that's only in memory to an image.
 *
 * This is for "use a PDF page as page template": the document isn't becoming a
 * notebook, so nothing is stored and the worker is shut down straight away. The
 * page number is clamped and returned so the caller can say which page it got.
 */
export async function renderPdfPage(
  data: ArrayBuffer,
  pageNumber = 1,
  targetWidth = 1400,
): Promise<{ blob: Blob; page: number; pages: number }> {
  const { doc, close } = await openPdf(data);
  try {
    const pages: number = doc.numPages;
    if (!pages) throw new Error("That PDF has no pages.");
    const n = Math.max(1, Math.min(pages, Math.round(pageNumber) || 1));
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, targetWidth / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser wouldn't give us a canvas to draw on.");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
    if (!blob) throw new Error("Couldn't turn that page into an image.");
    return { blob, page: n, pages };
  } finally {
    await close().catch(() => {});
  }
}
