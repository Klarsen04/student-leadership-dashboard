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
// The consequence is that an imported notebook lives on the device that
// imported it. Handwriting does *not*: ink is keyed by planner id and still
// syncs to the account through /api/planner, so the same notebook re-imported
// on another device picks its ink back up.
//
// A "copy" stores no file at all — it points at the planner it was duplicated
// from and only claims a fresh id, which is what gives it a blank ink layer.

import type { Hotspot } from "@/lib/planner";
import type { PlannerInfo } from "@/lib/planners";

const DB_NAME = "leadora-planner-library";
const DB_VERSION = 1;
const META_STORE = "meta";
const FILE_STORE = "files";

export const USER_CATEGORY = "My Notebooks";

/** Hard limits: the ink API rejects pages above 2000, and huge files stall import. */
export const MAX_IMPORT_PAGES = 2000;
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export interface UserPlanner extends PlannerInfo {
  /** How this notebook came to exist. */
  kind: "import" | "copy";
  createdAt: number;
  /** import: key of the PDF blob in IndexedDB. */
  pdfKey?: string;
  /** copy: the planner id this was duplicated from. */
  sourceId?: string;
}

// ---- IndexedDB plumbing -----------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
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
  await tx(META_STORE, "readwrite", (s) => s.put(meta));
}

export async function renameUserPlanner(id: string, name: string) {
  const all = await listUserPlanners();
  const meta = all.find((m) => m.id === id);
  if (meta) await putMeta({ ...meta, name });
}

/**
 * Remove a notebook. The PDF is only deleted once no other notebook still
 * points at it, so deleting an import that has copies doesn't break them.
 */
export async function deleteUserPlanner(id: string) {
  const all = await listUserPlanners();
  const meta = all.find((m) => m.id === id);
  await tx(META_STORE, "readwrite", (s) => s.delete(id));
  if (meta?.pdfKey) {
    const stillUsed = all.some((m) => m.id !== id && m.pdfKey === meta.pdfKey);
    if (!stillUsed) await tx(FILE_STORE, "readwrite", (s) => s.delete(meta.pdfKey!));
  }
}

async function putFile(key: string, blob: Blob) {
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
function newId(prefix: "u" | "c", taken: Set<string>): string {
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

async function openPdf(data: ArrayBuffer) {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({
    data,
    // The production CSP has no 'unsafe-eval'; pdf.js falls back to a slower
    // but allowed path for scaled fonts when told eval is unavailable.
    isEvalSupported: false,
  }).promise;
}

/** Pull the PDF's own hyperlinks out as normalised hotspots, keyed by page. */
async function extractLinks(doc: Awaited<ReturnType<typeof openPdf>>, pages: number) {
  const links: Record<string, Hotspot[]> = {};
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const [, , W, H] = page.view;
    const spots: Hotspot[] = [];
    for (const a of (await page.getAnnotations()) as any[]) {
      if (a.subtype !== "Link" || !a.rect) continue;
      let target: number | null = null;
      try {
        const dest = a.dest ? (typeof a.dest === "string" ? await doc.getDestination(a.dest) : a.dest) : null;
        if (dest?.[0]) target = (await doc.getPageIndex(dest[0])) + 1;
      } catch {}
      if (!target) continue;
      const [x1, y1, x2, y2] = a.rect; // PDF coords have their origin bottom-left
      spots.push({
        x: Math.min(x1, x2) / W,
        y: 1 - Math.max(y1, y2) / H,
        w: Math.abs(x2 - x1) / W,
        h: Math.abs(y2 - y1) / H,
        page: target,
        label: `p${target}`,
      });
    }
    if (spots.length) links[String(p)] = spots;
  }
  return links;
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
  const doc = await openPdf(bytes.slice(0));
  const pages = doc.numPages;
  if (!pages) throw new Error("That PDF has no pages.");
  if (pages > MAX_IMPORT_PAGES) {
    throw new Error(`That PDF has ${pages} pages — the limit is ${MAX_IMPORT_PAGES}.`);
  }

  const first = await doc.getPage(1);
  const [, , W, H] = first.view;

  onProgress?.("links", 0, pages);
  const links = await extractLinks(doc, pages);
  doc.destroy();

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
 * Duplicate a notebook. The copy shares its source's pages — and its PDF, if it
 * has one — but takes a new id, so it starts with a blank writing layer.
 */
export async function duplicatePlanner(source: PlannerInfo | UserPlanner): Promise<UserPlanner> {
  const existing = await listUserPlanners();
  const id = newId("c", new Set(existing.map((m) => m.id)));
  const src = source as UserPlanner;

  // Copying a copy points at the original rather than building a chain.
  const sourceId = src.kind === "copy" && src.sourceId ? src.sourceId : source.id;
  const base = existing.find((m) => m.id === sourceId) ?? source;

  const nth = existing.filter((m) => m.sourceId === sourceId).length + 2;
  const meta: UserPlanner = {
    ...base,
    id,
    kind: "copy",
    sourceId,
    name: `${stripCopySuffix(source.name)} (copy${nth > 2 ? ` ${nth - 1}` : ""})`,
    category: USER_CATEGORY,
    description: `Blank copy of ${stripCopySuffix(source.name)} — its own handwriting, same pages.`,
    createdAt: Date.now(),
  };
  await putMeta(meta);
  return meta;
}

const stripCopySuffix = (name: string) => name.replace(/\s*\(copy(?:\s+\d+)?\)$/, "");

/** Folder the page images come from: a copy reads its source's renders. */
export const imageBaseId = (p: PlannerInfo) => (p as UserPlanner).sourceId ?? p.id;

// ---- on-demand page rendering ------------------------------------------------------

/**
 * Renders pages of an imported PDF to object URLs, one document kept open per
 * renderer. Pages are cached because flipping back and forth is the common case,
 * and evicted oldest-first so a 700-page notebook can't grow without bound.
 */
export class PdfRenderer {
  private docPromise: Promise<any> | null = null;
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
    const doc = await this.doc();
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
    this.docPromise?.then((d) => d.destroy()).catch(() => {});
    this.docPromise = null;
  }
}
