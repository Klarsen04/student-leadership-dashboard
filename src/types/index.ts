import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export type Category =
  | "Academics"
  | "RA"
  | "PSG"
  | "PHE"
  | "Ministry"
  | "Personal";

export type Context =
  | "Resident"
  | "PSG Student"
  | "PHE Contact"
  | "InterVarsity"
  | "Classmate"
  | "Staff"
  | "Other";

export type ReflectionType = "daily" | "weekly" | "monthly";

export interface WeeklyReport {
  totalHours: number;
  hoursByCategory: Record<Category, number>;
  eventsAttended: number;
  eventsLed: number;
  interactions: number;
  newPeopleMet: number;
}

export interface BurnoutIndicator {
  score: number;
  factors: string[];
  recommendation: string;
}
