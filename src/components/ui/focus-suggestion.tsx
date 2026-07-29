"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface FocusSuggestionProps {
  gaps: { start: number; end: number; day: string }[];
  className?: string;
  onScheduleFocus?: (day: string, start: number, end: number) => void;
}

export function FocusSuggestion({ gaps, className, onScheduleFocus }: FocusSuggestionProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || gaps.length === 0) return null;

  const bestGap = gaps.reduce((best, gap) =>
    (gap.end - gap.start) > (best.end - best.start) ? gap : best
  , gaps[0]);

  const durationMins = bestGap.end - bestGap.start;
  const startHour = Math.floor(bestGap.start / 60);
  const startMin = bestGap.start % 60;
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className={cn(
          "rounded-xl border border-purple-200/50 bg-gradient-to-r from-purple-50 to-indigo-50 overflow-hidden",
          className
        )}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <motion.div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm shadow-purple-500/20"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-purple-900">AI Focus Suggestion</p>
            <p className="text-[10px] text-purple-700/70">
              {durationMins >= 60
                ? `${Math.floor(durationMins / 60)}h ${durationMins % 60 > 0 ? `${durationMins % 60}m` : ""}`
                : `${durationMins}m`
              } free on {bestGap.day} at {formatTime(bestGap.start)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <motion.button
              onClick={() => onScheduleFocus?.(bestGap.day, bestGap.start, bestGap.end)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-semibold shadow-sm hover:bg-purple-700 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Zap className="w-3 h-3" />
              Block
            </motion.button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-md hover:bg-purple-200/50 text-purple-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
