import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export const CATEGORIES = [
  { value: "Academics", color: "bg-blue-500", label: "Academics" },
  { value: "RA", color: "bg-green-500", label: "RA" },
  { value: "PSG", color: "bg-purple-500", label: "PSG" },
  { value: "PHE", color: "bg-orange-500", label: "PHE" },
  { value: "Ministry", color: "bg-yellow-500", label: "Ministry" },
  { value: "Personal", color: "bg-gray-500", label: "Personal" },
] as const;

export const CONTEXTS = [
  "Resident",
  "PSG Student",
  "PHE Contact",
  "InterVarsity",
  "Classmate",
  "Staff",
  "Other",
] as const;
