import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ROLES = [
  "Student",
  "RA",
  "PSG",
  "PHE",
  "InterVarsity",
  "Career",
  "Personal",
] as const;

export const ROLE_COLORS: Record<string, string> = {
  Student: "bg-blue-500",
  RA: "bg-green-500",
  PSG: "bg-purple-500",
  PHE: "bg-orange-500",
  InterVarsity: "bg-yellow-500",
  Career: "bg-cyan-500",
  Personal: "bg-gray-500",
};

export const ROLE_BADGE_VARIANTS: Record<string, string> = {
  Student: "info",
  RA: "success",
  PSG: "purple",
  PHE: "orange",
  InterVarsity: "warning",
  Career: "secondary",
  Personal: "outline",
};

export const PERSON_CATEGORIES = [
  "Resident",
  "Student",
  "PSG Connection",
  "PHE Connection",
  "Bible Study",
  "InterVarsity",
  "Friend",
  "Mentor",
  "Faculty",
] as const;

export const GOAL_CATEGORIES = [
  "Academic",
  "Leadership",
  "Ministry",
  "Career",
  "Health",
  "Personal",
] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type Role = (typeof ROLES)[number];
