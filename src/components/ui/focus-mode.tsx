"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface FocusModeProps {
  isActive: boolean;
  onToggle: () => void;
  className?: string;
}

export function FocusModeToggle({ isActive, onToggle, className }: FocusModeProps) {
  return (
    <motion.button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
        isActive
          ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
          : "bg-black/5 text-black/50 hover:bg-black/10",
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      <span>Focus</span>
    </motion.button>
  );
}

interface FocusOverlayProps {
  isActive: boolean;
  currentHour: number;
  startHour: number;
  hourHeight: number;
}

export function FocusOverlay({ isActive, currentHour, startHour, hourHeight }: FocusOverlayProps) {
  if (!isActive) return null;

  const currentPosition = (currentHour - startHour) * hourHeight;
  const windowHeight = hourHeight * 2;
  const topDimHeight = Math.max(0, currentPosition - windowHeight / 2);
  const bottomStart = currentPosition + windowHeight / 2;

  return (
    <AnimatePresence>
      <>
        <motion.div
          className="absolute left-0 right-0 top-0 bg-black/10 pointer-events-none z-20 rounded-t-lg"
          style={{ height: topDimHeight }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
        <motion.div
          className="absolute left-0 right-0 bottom-0 bg-black/10 pointer-events-none z-20 rounded-b-lg"
          style={{ top: bottomStart }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
        <motion.div
          className="absolute left-0 right-0 pointer-events-none z-20 border-y-2 border-purple-300/50"
          style={{ top: topDimHeight, height: windowHeight }}
          initial={{ opacity: 0, scaleY: 0.8 }}
          animate={{ opacity: 1, scaleY: 1 }}
          exit={{ opacity: 0, scaleY: 0.8 }}
          transition={{ duration: 0.3 }}
        />
      </>
    </AnimatePresence>
  );
}
