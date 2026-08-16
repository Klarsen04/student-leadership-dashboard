// Templates the user made: a page saved for reuse, an imported image, or a page
// lifted out of a PDF.
//
// A custom template is an ordinary `TemplateDefinition` with `imageKey` set — the
// picture lives in the same IndexedDB blob store as imported PDFs, and the
// definition only points at it. A page that uses one keeps the picture as its
// *background*: the user's handwriting stays in the page's element list, so a page
// made from a template can still be re-papered later without losing a stroke.

import {
  FILE_STORE,
  TEMPLATE_STORE,
  getFile,
  idbAll,
  idbDelete,
  idbGet,
  idbPut,
  putFile,
  renderPdfPage,
} from "@/lib/planner-library";
import { deleteDoc, docValue, pullScope, pushDoc } from "@/lib/sync";
import type { TemplateCategory, TemplateDefinition } from "@/lib/planner-paper";

/** A blob this big is a scanned page, not paper — refuse it before it fills the quota. */
const MAX_TEMPLATE_BYTES = 12 * 1024 * 1024;

export async function listUserTemplates(): Promise<TemplateDefinition[]> {
  const all = await idbAll<TemplateDefinition>(TEMPLATE_STORE);
  return all.filter((t) => t?.id).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export interface SaveTemplateOptions {
  name: string;
  category?: TemplateCategory;
  /** The picture to use as the page background. */
  image: Blob;
  hint?: string;
}

/** Store a picture as a reusable template. Throws with a user-facing message. */
export async function saveUserTemplate(opts: SaveTemplateOptions): Promise<TemplateDefinition> {
  if (opts.image.size > MAX_TEMPLATE_BYTES) {
    throw new Error(`That image is ${(opts.image.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_TEMPLATE_BYTES / 1024 / 1024} MB.`);
  }
  const existing = await listUserTemplates();
  const id = newTemplateId(new Set(existing.map((t) => t.id)));
  const imageKey = `tpl-${id}`;
  await putFile(imageKey, opts.image);
  const def: TemplateDefinition = {
    id,
    name: opts.name.trim().slice(0, 60) || "My template",
    category: opts.category ?? "Custom",
    hint: opts.hint,
    // "blank" so nothing is drawn over the picture: the picture *is* the paper.
    pattern: "blank",
    imageKey,
    custom: true,
    createdAt: Date.now(),
  };
  await idbPut(TEMPLATE_STORE, def);
  void pushTemplate(def);
  return def;
}

export interface ImportTemplateOptions {
  name?: string;
  /** Which page of a PDF to lift, 1-based. Ignored for images. */
  page?: number;
  category?: TemplateCategory;
}

/**
 * Turn an image, or one page of a PDF, into a reusable template. The picture
 * becomes the page's background — never part of anybody's handwriting layer, so a
 * page made from it can still be re-papered later.
 */
export async function importTemplateFile(file: File, opts: ImportTemplateOptions = {}): Promise<TemplateDefinition> {
  const stem = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 60);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > MAX_TEMPLATE_BYTES * 4) {
      throw new Error("That PDF is too big to lift a page out of here — import it as a notebook instead.");
    }
    const { blob, page, pages } = await renderPdfPage(await file.arrayBuffer(), opts.page ?? 1);
    return saveUserTemplate({
      name: opts.name || stem || "Imported page",
      category: opts.category,
      image: blob,
      hint: pages > 1 ? `Page ${page} of ${pages} · ${file.name}` : `From ${file.name}`,
    });
  }
  if (!file.type.startsWith("image/")) throw new Error("Pick an image or a PDF.");
  return saveUserTemplate({
    name: opts.name || stem || "Imported paper",
    category: opts.category,
    image: file,
    hint: `From ${file.name}`,
  });
}

export async function deleteUserTemplate(id: string): Promise<void> {
  const def = await idbGet<TemplateDefinition>(TEMPLATE_STORE, id);
  await idbDelete(TEMPLATE_STORE, id);
  // The picture goes with it. Pages already using it keep rendering from the
  // object URL they hold until they reload, then fall back to plain paper.
  if (def?.imageKey) await idbDelete(FILE_STORE, def.imageKey);
  revoke(id);
  void deleteDoc("template", id);
}

export async function renameUserTemplate(id: string, name: string): Promise<void> {
  const def = await idbGet<TemplateDefinition>(TEMPLATE_STORE, id);
  if (!def) return;
  const next = { ...def, name: name.trim().slice(0, 60) || def.name, updatedAt: Date.now() };
  await idbPut(TEMPLATE_STORE, next);
  void pushTemplate(next);
}

// ---- cross-device sync ----------------------------------------------------------------
//
// Unlike a sticker, a custom template is a *picture*, so syncing the definition
// alone would land a template on the iPad that renders as blank paper. The image
// travels with it, inlined, which is only reasonable because these are single
// rendered pages — a few hundred KB of WebP. Anything bigger stays on the device
// that made it rather than turning the sync table into a file store.

/** Largest image carried across devices, before base64 expands it by a third. */
const MAX_SYNC_IMAGE_BYTES = 1_200_000;

interface TemplateDoc {
  def: TemplateDefinition;
  /** The template's picture as a data URL, when it was small enough to carry. */
  image?: string;
}

/** Upload one template with its picture. Best-effort, like every other push. */
async function pushTemplate(def: TemplateDefinition): Promise<void> {
  const doc: TemplateDoc = { def };
  if (def.imageKey) {
    const blob = await getFile(def.imageKey);
    if (blob && blob.size <= MAX_SYNC_IMAGE_BYTES) {
      const url = await dataUrl(blob);
      if (url) doc.image = url;
    }
  }
  await pushDoc("template", def.id, doc);
}

/**
 * Merge the account's custom templates with this device's, newest edit winning.
 *
 * A template that arrives with its picture is written into the local blob store
 * under the same `imageKey`, so it renders exactly as it does on the device that
 * made it. One that arrives without a picture — too big to carry — is skipped
 * rather than added as an empty page template.
 */
export async function syncUserTemplates(): Promise<TemplateDefinition[]> {
  const local = await listUserTemplates();
  const remote = await pullScope("template");
  if (!remote) return local;

  const stamp = (t: TemplateDefinition) => t.updatedAt ?? t.createdAt ?? 0;
  const byId = new Map(local.map((t) => [t.id, t]));
  const push: TemplateDefinition[] = [];
  const seen = new Set<string>();

  for (const entry of remote) {
    seen.add(entry.key);
    const mine = byId.get(entry.key);
    if (entry.deleted) {
      if (mine) {
        byId.delete(entry.key);
        await deleteUserTemplate(entry.key).catch(() => {});
      }
      continue;
    }
    const doc = docValue<TemplateDoc>(entry);
    const theirs = doc?.def;
    if (!theirs?.id || theirs.id !== entry.key) continue;
    if (mine && stamp(mine) >= stamp(theirs)) {
      if (stamp(mine) > stamp(theirs)) push.push(mine);
      continue;
    }
    // Their copy is newer (or new to us). It's only usable with its picture:
    // either one already here under the same key, or one that came with it.
    const haveImage = theirs.imageKey ? (await getFile(theirs.imageKey)) !== null : true;
    if (!haveImage) {
      const blob = doc?.image ? dataUrlToBlob(doc.image) : null;
      if (!blob) continue;
      await putFile(theirs.imageKey!, blob);
    }
    byId.set(theirs.id, theirs);
    await idbPut(TEMPLATE_STORE, theirs).catch(() => {});
  }

  for (const mine of byId.values()) if (!seen.has(mine.id)) push.push(mine);
  // Sequential: each push reads a blob, and a burst of parallel FileReaders on a
  // first sync is a lot of memory for no gain.
  void (async () => { for (const t of push) await pushTemplate(t).catch(() => {}); })();

  return [...byId.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** Decode a data URL by hand — a data: fetch is at the mercy of the page's CSP. */
function dataUrlToBlob(url: string): Blob | null {
  const comma = url.indexOf(",");
  if (!url.startsWith("data:") || comma < 0) return null;
  const header = url.slice(5, comma);
  if (!header.endsWith(";base64")) return null;
  try {
    const bin = atob(url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: header.slice(0, -";base64".length) || "image/webp" });
  } catch {
    return null;
  }
}

function newTemplateId(taken: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const id = `t-${Math.random().toString(36).slice(2, 10)}`;
    if (!taken.has(id)) return id;
  }
  return `t-${Date.now().toString(36)}`;
}

// ---- picture URLs -------------------------------------------------------------------
// A picture template is drawn by embedding it in the paper's SVG, and an <img>
// rendering an SVG won't fetch anything external — a blob: URL loads as nothing.
// So these are **data** URLs, and they're cached per template id because a
// thumbnail grid and a page can both be showing the same template.

const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

export function templateImageUrl(def: TemplateDefinition): Promise<string | null> {
  if (!def.imageKey) return Promise.resolve(null);
  const cached = urls.get(def.id);
  if (cached) return Promise.resolve(cached);
  const inflight = pending.get(def.id);
  if (inflight) return inflight;
  const job = getFile(def.imageKey)
    .then(async (blob) => {
      if (!blob) return null;
      const url = await dataUrl(blob);
      if (url) urls.set(def.id, url);
      return url;
    })
    .catch(() => null)
    .finally(() => pending.delete(def.id));
  pending.set(def.id, job);
  return job;
}

/** Synchronous peek, for render paths that can't await. */
export const templateImageUrlNow = (id: string) => urls.get(id) ?? null;

const dataUrl = (blob: Blob) =>
  new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });

const revoke = (id: string) => { urls.delete(id); };

// ---- capturing a page ----------------------------------------------------------------

/**
 * Flatten a page's background and content into one picture, for "save this page as
 * a template". The result is a new background — the page it came from is untouched,
 * and pages made from it start with an empty content layer.
 */
export async function capturePage(
  background: HTMLImageElement | null,
  ink: HTMLCanvasElement | null,
  width = 1200,
): Promise<Blob> {
  const aspect = (background?.naturalHeight && background.naturalWidth)
    ? background.naturalHeight / background.naturalWidth
    : ink && ink.width
      ? ink.height / ink.width
      : Math.SQRT2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(width * aspect);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser wouldn't give us a canvas to draw on.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (background) {
    try {
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    } catch {
      // A cross-origin background can't be read back; the pattern is lost but the
      // handwriting still makes a usable template.
    }
  }
  if (ink) ctx.drawImage(ink, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob) throw new Error("Couldn't turn this page into an image.");
  return blob;
}
