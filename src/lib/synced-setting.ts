"use client";

// A single JSON document that follows the account instead of the browser.
//
// Sub-calendars, the class schedule, roles, goal categories, the term dates and
// the time budget were all `localStorage.setItem` and nothing else, so signing in
// on a second device showed the defaults. Each is one small document, so they all
// sit on the same primitive here rather than each hook growing its own fetching.
//
// The rules that make this safe to use everywhere:
//   * localStorage stays the immediate store. Reads are synchronous on first
//     paint (no flash of defaults) and an edit is saved before the network is
//     touched, so a failed request costs nothing.
//   * The server is pulled once per key per page load. If it has a document, it
//     wins — that's what makes the iPad show what the laptop created.
//   * ...unless the user edited first. A local edit outranks the pull it raced,
//     and gets pushed up instead of being overwritten.
//   * One value per key process-wide, with subscribers, so a calendar added in a
//     dialog shows up in the sidebar that's already mounted.

import { useCallback, useEffect, useState } from "react";
import { pullDoc, pushDoc, docValue } from "@/lib/sync";

/** How long to coalesce edits before pushing. Long enough to swallow a burst of
 *  keystrokes in a rename box, short enough that closing the tab keeps up. */
const PUSH_DEBOUNCE_MS = 600;

interface Entry<T> {
  value: T;
  /** Read from localStorage yet? */
  loaded: boolean;
  /** Pull from the server attempted? */
  hydrated: boolean;
  /** Edited locally since load, so the pull must not clobber it. */
  dirty: boolean;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
  pull: Promise<void> | null;
}

const entries = new Map<string, Entry<unknown>>();

function entryFor<T>(key: string, fallback: T): Entry<T> {
  let e = entries.get(key) as Entry<T> | undefined;
  if (!e) {
    e = { value: fallback, loaded: false, hydrated: false, dirty: false, listeners: new Set(), timer: null, pull: null };
    entries.set(key, e as Entry<unknown>);
  }
  return e;
}

const notify = (e: Entry<unknown>) => e.listeners.forEach((fn) => fn());

/**
 * A setting: how to store it and how to read a stored copy back.
 *
 * `revive` exists because these documents predate the sync and some hold shapes
 * from older versions of the app (tags that used to be plain strings, calendars
 * with a dropped `engine` field). It runs on whatever comes back from either
 * store, so migration logic lives in one place per setting.
 */
export interface SettingSpec<T> {
  key: string;
  fallback: T;
  /** Turn parsed JSON into a valid value, or return null to fall back. */
  revive?: (raw: unknown) => T | null;
}

function reviveOr<T>(spec: SettingSpec<T>, raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  try {
    return spec.revive ? spec.revive(raw) : (raw as T);
  } catch {
    return null;
  }
}

/** Synchronous local read. Safe on the server, where it just yields the fallback. */
export function readSetting<T>(spec: SettingSpec<T>): T {
  const e = entryFor(spec.key, spec.fallback);
  if (e.loaded || typeof window === "undefined") return e.value;
  e.loaded = true;
  try {
    const raw = localStorage.getItem(spec.key);
    if (raw !== null) {
      const revived = reviveOr(spec, JSON.parse(raw));
      if (revived !== null) e.value = revived;
    }
  } catch {
    // Unreadable local copy: keep the fallback rather than blocking the app.
  }
  return e.value;
}

function schedulePush<T>(spec: SettingSpec<T>) {
  const e = entryFor(spec.key, spec.fallback);
  if (e.timer) clearTimeout(e.timer);
  e.timer = setTimeout(() => {
    e.timer = null;
    void pushDoc("setting", spec.key, e.value);
  }, PUSH_DEBOUNCE_MS);
}

/** Save a new value: locally now, to the account shortly after. */
export function writeSetting<T>(spec: SettingSpec<T>, value: T): void {
  const e = entryFor(spec.key, spec.fallback);
  e.value = value;
  e.loaded = true;
  e.dirty = true;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(spec.key, JSON.stringify(value));
    } catch {
      // Out of quota or blocked: the push below is still the durable copy.
    }
  }
  notify(e as Entry<unknown>);
  schedulePush(spec);
}

/**
 * Pull this setting from the account, once per page load.
 *
 * Adopting the server's copy is the whole point, but only while the user hasn't
 * already changed something locally — their edit is newer than the response we
 * were waiting for. When the account has nothing stored yet, the local copy is
 * uploaded, which is how everything created before this existed gets carried up
 * the first time the app is opened.
 */
export function hydrateSetting<T>(spec: SettingSpec<T>): Promise<void> {
  const e = entryFor(spec.key, spec.fallback);
  if (e.hydrated) return Promise.resolve();
  e.pull ??= (async () => {
    const local = readSetting(spec);
    const remote = reviveOr(spec, docValue<unknown>(await pullDoc("setting", spec.key)));
    e.hydrated = true;
    if (remote !== null && !e.dirty) {
      e.value = remote;
      try {
        localStorage.setItem(spec.key, JSON.stringify(remote));
      } catch {}
      notify(e as Entry<unknown>);
    } else if (remote === null) {
      await pushDoc("setting", spec.key, e.dirty ? e.value : local);
    } else {
      // Remote existed but we've been edited: our version is the newer one.
      schedulePush(spec);
    }
  })();
  return e.pull;
}

/**
 * Read and write one synced setting.
 *
 * The value is shared with every other caller of the same spec, so callbacks can
 * derive the next value from `current()` without re-reading a store.
 */
export function useSyncedSetting<T>(spec: SettingSpec<T>): {
  value: T;
  setValue: (next: T) => void;
  current: () => T;
  hydrated: boolean;
} {
  const [value, setLocal] = useState<T>(() => (typeof window === "undefined" ? spec.fallback : readSetting(spec)));
  const [hydrated, setHydrated] = useState(() => entryFor(spec.key, spec.fallback).hydrated);

  useEffect(() => {
    const e = entryFor(spec.key, spec.fallback);
    const sync = () => setLocal(e.value);
    e.listeners.add(sync);
    // Adopt anything already loaded or pulled by another component first.
    sync();
    void hydrateSetting(spec).then(() => {
      sync();
      setHydrated(true);
    });
    return () => {
      e.listeners.delete(sync);
    };
    // The spec is a module constant per setting; only its key identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.key]);

  const setValue = useCallback(
    (next: T) => writeSetting(spec, next),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.key],
  );

  const current = useCallback(
    () => readSetting(spec),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.key],
  );

  return { value, setValue, current, hydrated };
}
