"use client";

import { useCallback } from "react";
import { readSetting, useSyncedSetting, type SettingSpec } from "@/lib/synced-setting";

const DEFAULT_ROLES = [
  "Personal",
];

const STORAGE_KEY = "leadership-os-roles";

const ROLE_COLOR_POOL = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-cyan-500",
  "bg-gray-500",
  "bg-pink-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-lime-500",
];

// Roles follow the account (src/lib/synced-setting.ts).
const ROLES: SettingSpec<string[]> = {
  key: STORAGE_KEY,
  fallback: DEFAULT_ROLES,
  revive: (raw) => (Array.isArray(raw) && raw.length > 0 ? (raw as string[]) : null),
};

const getStoredRoles = (): string[] => readSetting(ROLES);

export function useRoles() {
  const { value: roles, setValue } = useSyncedSetting(ROLES);

  const saveRoles = useCallback((newRoles: string[]) => {
    setValue(newRoles);
  }, [setValue]);

  const addRole = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const current = getStoredRoles();
    if (current.some((r) => r.toLowerCase() === trimmed.toLowerCase())) return false;
    saveRoles([...current, trimmed]);
    return true;
  }, [saveRoles]);

  const deleteRole = useCallback((name: string) => {
    const current = getStoredRoles();
    saveRoles(current.filter((r) => r !== name));
  }, [saveRoles]);

  // No cross-component event to dispatch any more: the synced store notifies
  // every hook instance itself, which also covers a value arriving from the account.
  return { roles, addRole, deleteRole };
}

export function getRoleColor(role: string): string {
  const stored = getStoredRoles();
  const idx = stored.indexOf(role);
  if (idx >= 0) return ROLE_COLOR_POOL[idx % ROLE_COLOR_POOL.length];
  return "bg-gray-400";
}
