"use client";

import { useState, useEffect, useCallback } from "react";

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

function getStoredRoles(): string[] {
  if (typeof window === "undefined") return DEFAULT_ROLES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_ROLES;
}

export function useRoles() {
  const [roles, setRoles] = useState<string[]>(DEFAULT_ROLES);

  useEffect(() => {
    setRoles(getStoredRoles());
  }, []);

  const saveRoles = useCallback((newRoles: string[]) => {
    setRoles(newRoles);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRoles));
    window.dispatchEvent(new Event("roles-updated"));
  }, []);

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

  useEffect(() => {
    const handler = () => setRoles(getStoredRoles());
    window.addEventListener("roles-updated", handler);
    return () => window.removeEventListener("roles-updated", handler);
  }, []);

  return { roles, addRole, deleteRole };
}

export function getRoleColor(role: string): string {
  const stored = getStoredRoles();
  const idx = stored.indexOf(role);
  if (idx >= 0) return ROLE_COLOR_POOL[idx % ROLE_COLOR_POOL.length];
  return "bg-gray-400";
}
