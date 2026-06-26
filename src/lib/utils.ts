import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ROLE_BADGE_VARIANTS: Record<string, string> = {
  Personal: "secondary",
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
