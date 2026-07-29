"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScheduleHeatmapProps {
  classes: Array<{ days: string[]; startTime: string; endTime: string }>;
  events: Array<{ startTime: string; endTime: string }>;
  className?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

const CLASS_DAY_MAP: Record<string, number[]> = {
  MWF: [0, 2, 4], TuTh: [1, 3], MW: [0, 2], TuThF: [1, 3, 4],
  Mon: [0], Tue: [1], Wed: [2], Thu: [3], Fri: [4], Sat: [5], Sun: [6],
};

function getMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function ScheduleHeatmap({ classes, events, className }: ScheduleHeatmapProps) {
  const heatData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 5 }, () => Array(HOURS.length).fill(0));

    classes.forEach((cls) => {
      const startMin = getMinutes(cls.startTime);
      const endMin = getMinutes(cls.endTime);
      const dayIndices = cls.days.flatMap(d => CLASS_DAY_MAP[d] || []);
      dayIndices.forEach((di) => {
        if (di >= 5) return;
        HOURS.forEach((hour, hi) => {
          const hourStart = hour * 60;
          const hourEnd = (hour + 1) * 60;
          if (startMin < hourEnd && endMin > hourStart) {
            grid[di][hi] += 1;
          }
        });
      });
    });

    events.forEach((ev) => {
      const start = new Date(ev.startTime);
      const end = new Date(ev.endTime);
      const dayIdx = (start.getDay() + 6) % 7;
      if (dayIdx >= 5) return;
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();
      HOURS.forEach((hour, hi) => {
        const hourStart = hour * 60;
        const hourEnd = (hour + 1) * 60;
        if (startMin < hourEnd && endMin > hourStart) {
          grid[dayIdx][hi] += 1;
        }
      });
    });

    return grid;
  }, [classes, events]);

  const maxVal = Math.max(1, ...heatData.flat());

  return (
    <div className={cn("bg-white rounded-2xl shadow-sm border border-black/5 p-3", className)}>
      <p className="text-[10px] font-semibold text-black/50 uppercase tracking-wider mb-2">Schedule Density</p>
      <div className="flex gap-0.5">
        {/* Hour labels */}
        <div className="flex flex-col justify-between pr-1 py-0.5">
          {[8, 12, 16, 20].map((h) => (
            <span key={h} className="text-[7px] text-black/30 leading-none">
              {h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}
            </span>
          ))}
        </div>
        {/* Grid */}
        {DAYS.map((day, di) => (
          <div key={day} className="flex-1 flex flex-col gap-0.5">
            <span className="text-[8px] text-center text-black/40 font-medium mb-0.5">{day[0]}</span>
            {HOURS.map((_, hi) => {
              const val = heatData[di][hi];
              const intensity = val / maxVal;
              return (
                <motion.div
                  key={hi}
                  className="w-full aspect-square rounded-[2px]"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (di * HOURS.length + hi) * 0.01, duration: 0.3 }}
                  style={{
                    background: val === 0
                      ? "rgba(0,0,0,0.03)"
                      : `rgba(168, 85, 247, ${0.15 + intensity * 0.7})`,
                  }}
                  title={`${day} ${HOURS[hi]}:00 — ${val} item${val !== 1 ? "s" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-2">
        <span className="text-[7px] text-black/30">Less</span>
        {[0.1, 0.3, 0.5, 0.7, 1].map((v, i) => (
          <div key={i} className="w-2 h-2 rounded-[1px]" style={{ background: `rgba(168, 85, 247, ${0.15 + v * 0.7})` }} />
        ))}
        <span className="text-[7px] text-black/30">More</span>
      </div>
    </div>
  );
}
