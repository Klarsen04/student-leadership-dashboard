"use client";

import { useState } from "react";

interface SemesterInfo {
  name: string;
  weekNumber: number;
  totalWeeks: number;
  isExamPeriod: boolean;
  daysUntilEnd: number;
  /** Where "now" sits relative to the term: before it starts / during / after. */
  phase: "before" | "active" | "after";
  daysUntilStart: number;
}

const STORAGE_KEY = "leadership-os-semester";

interface SemesterConfig {
  startDate: string;
  endDate: string;
  examStart: string;
  name: string;
}

function getDefaultSemester(): SemesterConfig {
  const now = new Date();
  const month = now.getMonth();

  if (month >= 7 && month <= 11) {
    const year = now.getFullYear();
    return {
      startDate: `${year}-08-25`,
      endDate: `${year}-12-15`,
      examStart: `${year}-12-01`,
      name: `Fall ${year}`,
    };
  } else {
    const year = now.getFullYear();
    return {
      startDate: `${year}-01-15`,
      endDate: `${year}-05-15`,
      examStart: `${year}-05-01`,
      name: `Spring ${year}`,
    };
  }
}

function getInitialConfig(): SemesterConfig {
  if (typeof window === "undefined") return getDefaultSemester();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return getDefaultSemester();
}

export function useSemester() {
  const [config, setConfig] = useState<SemesterConfig>(getInitialConfig);

  const updateSemester = (newConfig: SemesterConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  const getInfo = (): SemesterInfo => {
    const now = new Date();
    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const examStart = new Date(config.examStart);

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const totalWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / WEEK_MS));

    // Phase: before the term begins, during it, or after it ends. Week counting
    // is only meaningful while active — before the start we show a countdown, not
    // "Week 1", so a dashboard opened over the break isn't misleading.
    const phase: "before" | "active" | "after" =
      now < start ? "before" : now > end ? "after" : "active";

    const weekNumber =
      phase === "active"
        ? Math.max(1, Math.min(totalWeeks, Math.ceil((now.getTime() - start.getTime()) / WEEK_MS)))
        : phase === "after"
        ? totalWeeks
        : 0;

    const daysUntilStart = Math.max(0, Math.ceil((start.getTime() - now.getTime()) / DAY_MS));
    const daysUntilEnd = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
    const isExamPeriod = phase === "active" && now >= examStart;

    return {
      name: config.name,
      weekNumber,
      totalWeeks,
      isExamPeriod,
      daysUntilEnd,
      phase,
      daysUntilStart,
    };
  };

  return { config, updateSemester, getInfo };
}
