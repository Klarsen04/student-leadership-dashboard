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
    cassette: "/tasktape/sunday-cassette.png",
    accentRgb: "225, 29, 72",
    spineColor: "bg-rose-300",
    motto: "rest, recharge, reset for a new week",
    dayNumber: "007",
  },
  {
    day: "Monday",
    short: "Mon",
    index: 1,
    spine: "/tasktape/monday-spine.png",
    cover: "/tasktape/monday-cover.png",
    cassette: "/tasktape/monday-cassette.png",
    accentRgb: "147, 51, 234",
    spineColor: "bg-purple-300",
    motto: "plan with purpose, start strong, stay focused",
    dayNumber: "001",
  },
  {
    day: "Tuesday",
    short: "Tue",
    index: 2,
    spine: "/tasktape/tuesday-spine.png",
    cover: "/tasktape/tuesday-cover.png",
    cassette: "/tasktape/tuesday-cassette.png",
    accentRgb: "219, 39, 119",
    spineColor: "bg-pink-300",
    motto: "take small steps, make steady progress",
    dayNumber: "002",
  },
  {
    day: "Wednesday",
    short: "Wed",
    index: 3,
    spine: "/tasktape/wednesday-spine.png",
    cover: "/tasktape/wednesday-cover.png",
    cassette: "/tasktape/wednesday-cassette.png",
    accentRgb: "217, 167, 43",
    spineColor: "bg-yellow-300",
    motto: "stay consistent, build your momentum",
    dayNumber: "003",
  },
  {
    day: "Thursday",
    short: "Thu",
    index: 4,
    spine: "/tasktape/thursday-spine.png",
    cover: "/tasktape/thursday-cover.png",
    cassette: "/tasktape/thursday-cassette.png",
    accentRgb: "34, 197, 94",
    spineColor: "bg-green-300",
    motto: "grow your habits, achieve your goals",
    dayNumber: "004",
  },
  {
    day: "Friday",
    short: "Fri",
    index: 5,
    spine: "/tasktape/friday-spine.png",
    cover: "/tasktape/friday-cover.png",
    cassette: "/tasktape/friday-cassette.png",
    accentRgb: "234, 88, 12",
    spineColor: "bg-orange-300",
    motto: "finish strong, feel proud",
    dayNumber: "005",
  },
  {
    day: "Saturday",
    short: "Sat",
    index: 6,
    spine: "/tasktape/saturday-spine.png",
    cover: "/tasktape/saturday-cover.png",
    cassette: "/tasktape/saturday-cassette.png",
    accentRgb: "59, 130, 246",
    spineColor: "bg-blue-300",
    motto: "stay positive, make it happen",
    dayNumber: "006",
  },
];

function blendOver(accentRgb: string, opacity: number): string {
  const [r, g, b] = accentRgb.split(",").map((s) => parseInt(s.trim()));
  const br = Math.round(r * opacity + 239 * (1 - opacity));
  const bg = Math.round(g * opacity + 238 * (1 - opacity));
  const bb = Math.round(b * opacity + 236 * (1 - opacity));
  return `rgb(${br}, ${bg}, ${bb})`;
}

function getGradientBg(accentRgb: string): string {
  const s0 = blendOver(accentRgb, 0.75);
  const s1 = blendOver(accentRgb, 0.45);
  const s2 = blendOver(accentRgb, 0.24);
  const s3 = blendOver(accentRgb, 0.106);
  return `radial-gradient(135% 115% at 50% -10%, ${s0} 0%, ${s1} 28%, ${s2} 52%, ${s3} 78%, rgb(239, 238, 236) 100%)`;
}

interface DayTabsProps {
  selectedDay: number;
  onSelectDay: (day: number) => void;
}

function DayTabs({ selectedDay, onSelectDay }: DayTabsProps) {
  return (
    <div className="flex gap-1 overflow-auto pb-3 scrollbar-none">
      {TAPES.map((tape) => {
        const isActive = tape.index === selectedDay;
        return (
          <button
            key={tape.day}
            onClick={() => onSelectDay(tape.index)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              isActive
                ? "text-white shadow-lg"
                : "border border-black/10 text-black/60 hover:text-black hover:border-black/20"
            }`}
            style={isActive ? { backgroundColor: `rgb(${tape.accentRgb})` } : undefined}
          >
            <span className={`w-0.5 h-4 rounded-full ${isActive ? "bg-white/60" : tape.spineColor}`} />
            {tape.short}
          </button>
        );
      })}
    </div>
  );
}

interface CassetteDisplayProps {
  selectedDay: number;
}

function CassetteDisplay({ selectedDay }: CassetteDisplayProps) {
  const tape = TAPES[selectedDay];

  return (
    <div className="relative flex flex-col items-center justify-center h-full min-h-[300px] lg:min-h-[400px]">
      {/* Glow effect behind cassette */}
      <div
        className="absolute w-64 h-64 rounded-full blur-[64px] pointer-events-none"
        style={{ background: `rgba(${tape.accentRgb}, 0.2)` }}
      />

      {/* Cover art - tilted behind */}
      <div className="absolute -top-4 -left-2 lg:-top-8 lg:-left-4 z-0">
        <div className="relative w-36 h-52 lg:w-48 lg:h-72 transform -rotate-6">
          <Image
            src={tape.cover}
            alt={`${tape.day} cover`}
            fill
            className="object-contain rounded-sm drop-shadow-xl"
            sizes="(max-width: 1024px) 144px, 192px"
          />
        </div>
      </div>

      {/* 3D Cassette - main */}
      <div className="relative z-10 transform rotate-[1deg]">
        <div className="relative w-72 h-48 lg:w-96 lg:h-64">
          <Image
            src={tape.cassette}
            alt={`${tape.day} cassette`}
            fill
            className="object-contain drop-shadow-2xl"
            sizes="(max-width: 1024px) 288px, 384px"
            priority
          />
        </div>
      </div>
    </div>
  );
}

export { TAPES, DayTabs, CassetteDisplay, getGradientBg };
