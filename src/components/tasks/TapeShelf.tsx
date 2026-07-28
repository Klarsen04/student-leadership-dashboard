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
    color: "from-rose-100 to-rose-50",
    gradientBg: "radial-gradient(135% 115% at 50% -10%, rgb(254,226,226) 0%, rgb(254,205,211) 28%, rgb(251,191,204) 52%, rgb(254,226,226) 78%, rgb(255,241,242) 100%)",
    accent: "rgb(225, 29, 72)",
    accentBg: "bg-rose-600",
    spineColor: "bg-rose-200",
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
    color: "from-purple-100 to-purple-50",
    gradientBg: "radial-gradient(135% 115% at 50% -10%, rgb(243,232,255) 0%, rgb(233,213,255) 28%, rgb(221,194,255) 52%, rgb(243,232,255) 78%, rgb(250,245,255) 100%)",
    accent: "rgb(147, 51, 234)",
    accentBg: "bg-purple-600",
    spineColor: "bg-purple-200",
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
    color: "from-pink-100 to-pink-50",
    gradientBg: "radial-gradient(135% 115% at 50% -10%, rgb(252,231,243) 0%, rgb(251,207,232) 28%, rgb(249,186,220) 52%, rgb(252,231,243) 78%, rgb(253,242,248) 100%)",
    accent: "rgb(219, 39, 119)",
    accentBg: "bg-pink-600",
    spineColor: "bg-pink-200",
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
    color: "from-yellow-100 to-amber-50",
    gradientBg: "radial-gradient(135% 115% at 50% -10%, rgb(254,249,195) 0%, rgb(254,240,138) 28%, rgb(253,224,71) 52%, rgb(254,249,195) 78%, rgb(254,252,232) 100%)",
    accent: "rgb(161, 98, 7)",
    accentBg: "bg-amber-700",
    spineColor: "bg-yellow-200",
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
    color: "from-green-100 to-emerald-50",
    gradientBg: "radial-gradient(135% 115% at 50% -10%, rgb(220,252,231) 0%, rgb(187,247,208) 28%, rgb(134,239,172) 52%, rgb(220,252,231) 78%, rgb(240,253,244) 100%)",
    accent: "rgb(21, 128, 61)",
    accentBg: "bg-green-700",
    spineColor: "bg-green-200",
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
    color: "from-orange-100 to-orange-50",
    gradientBg: "radial-gradient(135% 115% at 50% -10%, rgb(255,237,213) 0%, rgb(254,215,170) 28%, rgb(253,186,116) 52%, rgb(255,237,213) 78%, rgb(255,247,237) 100%)",
    accent: "rgb(194, 65, 12)",
    accentBg: "bg-orange-700",
    spineColor: "bg-orange-200",
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
    color: "from-blue-100 to-blue-50",
    gradientBg: "radial-gradient(135% 115% at 50% -10%, rgb(219,234,254) 0%, rgb(191,219,254) 28%, rgb(147,197,253) 52%, rgb(219,234,254) 78%, rgb(239,246,255) 100%)",
    accent: "rgb(29, 78, 216)",
    accentBg: "bg-blue-700",
    spineColor: "bg-blue-200",
    motto: "stay positive, make it happen",
    dayNumber: "006",
  },
];

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
                ? "bg-foreground text-background shadow-lg"
                : "border border-black/10 text-foreground/60 hover:text-foreground hover:border-black/20"
            }`}
          >
            <span className={`w-0.5 h-4 rounded-full ${tape.spineColor}`} />
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
        className="absolute w-64 h-64 rounded-full blur-[64px] opacity-60 pointer-events-none"
        style={{ background: tape.accent, opacity: 0.2 }}
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

export { TAPES, DayTabs, CassetteDisplay };
