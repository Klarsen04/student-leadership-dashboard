"use client";

import { useState } from "react";

interface SemesterInfo {
  name: string;
  weekNumber: number;
  totalWeeks: number;
  isExamPeriod: boolean;
  daysUntilEnd: number;
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

    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = now.getTime() - start.getTime();
    const totalWeeks = Math.ceil(totalMs / (7 * 24 * 60 * 60 * 1000));
    const weekNumber = Math.max(1, Math.min(totalWeeks, Math.ceil(elapsedMs / (7 * 24 * 60 * 60 * 1000))));

    const daysUntilEnd = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const isExamPeriod = now >= examStart && now <= end;

    return {
      name: config.name,
      weekNumber,
      totalWeeks,
      isExamPeriod,
      daysUntilEnd,
    };
  };

  return { config, updateSemester, getInfo };
}
