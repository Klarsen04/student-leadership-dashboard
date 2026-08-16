// Client half of /api/sync: pull a scope, push a document, tombstone a document.
//
// Every call is best-effort. Signing in is not a precondition for using the app
// offline, and a failed sync must never lose the local copy — callers write
// locally first and treat the network as a mirror, the same contract the planner
// uses for ink.

/** Scopes must match the allowlist in src/app/api/sync/route.ts. */
export type SyncScope = "setting" | "notebook" | "pageIndex" | "sticker" | "template";

export interface SyncDoc {
  key: string;
  /** null when the document has been deleted on another device. */
  value: string | null;
  deleted: boolean;
  updatedAt: number;
}

/** Pull every document in a scope. Returns null if the server couldn't be reached. */
export async function pullScope(scope: SyncScope): Promise<SyncDoc[] | null> {
  try {
    const res = await fetch(`/api/sync?scope=${scope}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body?.items) ? (body.items as SyncDoc[]) : null;
  } catch {
    return null;
  }
}

/** Pull one document. Returns null if it's missing, deleted, or unreachable. */
export async function pullDoc(scope: SyncScope, key: string): Promise<SyncDoc | null> {
  try {
    const res = await fetch(`/api/sync?scope=${scope}&key=${encodeURIComponent(key)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json();
    const doc = body?.items?.[0] as SyncDoc | undefined;
    return doc && !doc.deleted ? doc : null;
  } catch {
    return null;
  }
}

/** Push one document. True if the server stored it. */
export async function pushDoc(scope: SyncScope, key: string, value: unknown): Promise<boolean> {
  return pushDocs(scope, [{ key, value }]);
}

/** Push several documents in one request — how a first sync uploads a whole scope. */
export async function pushDocs(
  scope: SyncScope,
  docs: { key: string; value: unknown }[],
): Promise<boolean> {
  if (!docs.length) return true;
  try {
    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        items: docs.map((d) => ({ key: d.key, value: JSON.stringify(d.value ?? null) })),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Tombstone a document so other devices drop their copy too. */
export async function deleteDoc(scope: SyncScope, key: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/sync?scope=${scope}&key=${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Parse a document's JSON, or null if it's absent, deleted or corrupt. */
export function docValue<T>(doc: SyncDoc | null | undefined): T | null {
  if (!doc || doc.deleted || doc.value === null) return null;
  try {
    return JSON.parse(doc.value) as T;
  } catch {
    return null;
  }
}
