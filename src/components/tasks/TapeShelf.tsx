"use client";

import { useState } from "react";
import Image from "next/image";

const TAPES = [
  {
    day: "Sunday",
    short: "Sun",
    index: 0,
    spine: "/tasktape/sunday-spine.png",
    cover: "/tasktape/sunday-cover.png",
    color: "from-rose-400/30 to-rose-200/10",
    accent: "rgb(244, 63, 94)",
    motto: "rest, recharge, reset for a new week",
  },
  {
    day: "Monday",
    short: "Mon",
    index: 1,
    spine: "/tasktape/monday-spine.png",
    cover: "/tasktape/monday-cover.png",
    color: "from-purple-400/30 to-purple-200/10",
    accent: "rgb(168, 85, 247)",
    motto: "plan with purpose, start strong, stay focused",
  },
  {
    day: "Tuesday",
    short: "Tue",
    index: 2,
    spine: "/tasktape/tuesday-spine.png",
    cover: "/tasktape/tuesday-cover.png",
    color: "from-pink-400/30 to-pink-200/10",
    accent: "rgb(236, 72, 153)",
    motto: "take small steps, make steady progress",
  },
  {
    day: "Wednesday",
    short: "Wed",
    index: 3,
    spine: "/tasktape/wednesday-spine.png",
    cover: "/tasktape/wednesday-cover.png",
    color: "from-yellow-400/30 to-yellow-200/10",
    accent: "rgb(234, 179, 8)",
    motto: "stay consistent, build your momentum",
  },
  {
    day: "Thursday",
    short: "Thu",
    index: 4,
    spine: "/tasktape/thursday-spine.png",
    cover: "/tasktape/thursday-cover.png",
    color: "from-green-400/30 to-green-200/10",
    accent: "rgb(34, 197, 94)",
    motto: "grow your habits, achieve your goals",
  },
  {
    day: "Friday",
    short: "Fri",
    index: 5,
    spine: "/tasktape/friday-spine.png",
    cover: "/tasktape/friday-cover.png",
    color: "from-orange-400/30 to-orange-200/10",
    accent: "rgb(249, 115, 22)",
    motto: "finish strong, feel proud",
  },
  {
    day: "Saturday",
    short: "Sat",
    index: 6,
    spine: "/tasktape/saturday-spine.png",
    cover: "/tasktape/saturday-cover.png",
    color: "from-blue-400/30 to-blue-200/10",
    accent: "rgb(59, 130, 246)",
    motto: "stay positive, make it happen",
  },
];

interface TapeShelfProps {
  selectedDay: number;
  onSelectDay: (day: number) => void;
  taskCounts: Record<number, { total: number; done: number }>;
}

export function TapeShelf({ selectedDay, onSelectDay, taskCounts }: TapeShelfProps) {
  const [hoveredTape, setHoveredTape] = useState<number | null>(null);
  const selectedTape = TAPES.find((t) => t.index === selectedDay)!;

  return (
    <div className="relative">
      {/* Tape Shelf - Spine View */}
      <div className="flex items-end justify-center gap-1 md:gap-2 h-48 md:h-64 px-2">
        {TAPES.map((tape) => {
          const isSelected = tape.index === selectedDay;
          const isHovered = tape.index === hoveredTape;
          const counts = taskCounts[tape.index];
          const progress = counts && counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0;

          return (
            <button
              key={tape.day}
              onClick={() => onSelectDay(tape.index)}
              onMouseEnter={() => setHoveredTape(tape.index)}
              onMouseLeave={() => setHoveredTape(null)}
              className={`relative transition-all duration-300 ease-out flex-shrink-0 ${
                isSelected
                  ? "z-30 scale-105 -translate-y-2"
                  : isHovered
                  ? "z-20 scale-[1.02] -translate-y-1"
                  : "z-10"
              }`}
              style={{ width: isSelected ? "clamp(80px, 15vw, 120px)" : "clamp(28px, 6vw, 48px)" }}
            >
              {/* Spine (collapsed) */}
              <div
                className={`relative h-40 md:h-56 transition-all duration-300 ${
                  isSelected ? "opacity-0 pointer-events-none absolute" : "opacity-100"
                }`}
              >
                <Image
                  src={tape.spine}
                  alt={`${tape.day} spine`}
                  fill
                  className="object-contain object-bottom drop-shadow-md"
                  sizes="48px"
                />
              </div>

              {/* Cover (expanded) */}
              <div
                className={`relative h-40 md:h-56 transition-all duration-300 ${
                  isSelected ? "opacity-100" : "opacity-0 pointer-events-none absolute inset-0"
                }`}
              >
                <Image
                  src={tape.cover}
                  alt={`${tape.day} cover`}
                  fill
                  className="object-contain object-bottom drop-shadow-lg rounded-sm"
                  sizes="120px"
                />
                {/* Progress ring overlay */}
                {isSelected && counts && counts.total > 0 && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <span className="text-[10px] text-white font-medium">{progress}%</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Label + Motto */}
      <div className="text-center mt-4 space-y-1">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-serif" style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif" }}>
          {selectedTape.day}
        </h2>
        <p className="text-sm text-muted-foreground italic">
          {selectedTape.motto}
        </p>
      </div>
    </div>
  );
}

export { TAPES };
