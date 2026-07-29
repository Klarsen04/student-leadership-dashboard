"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, Square, Clock, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  TimeTracker                                                                */
/* -------------------------------------------------------------------------- */

interface TimeTrackerProps {
  /** Whether the widget is visible on-screen */
  isVisible: boolean;
  /** Optional task name being tracked */
  taskName?: string;
  /** Called when the timer is stopped, receives total elapsed seconds */
  onStop?: (seconds: number) => void;
}

/**
 * A ClickUp-inspired floating time tracker widget.
 * Appears as a persistent pill in the bottom-right corner with
 * glassmorphic styling, play/pause/stop controls, and a minimized state.
 */
export function TimeTracker({ isVisible, taskName, onStop }: TimeTrackerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer interval logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handlePlayPause = () => {
    setIsRunning((prev) => !prev);
  };

  const handleStop = () => {
    setIsRunning(false);
    onStop?.(seconds);
    setSeconds(0);
  };

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "rounded-2xl overflow-hidden",
            "shadow-lg shadow-purple-900/30"
          )}
          style={{
            background: "rgba(20, 16, 36, 0.75)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(124, 58, 237, 0.25)",
          }}
        >
          {/* Expanded state */}
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="px-4 py-3 min-w-[220px]"
              >
                {/* Task name row */}
                {taskName && (
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-xs text-purple-200 truncate max-w-[160px]">
                      {taskName}
                    </span>
                  </div>
                )}

                {/* Timer display */}
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-lg font-mono font-semibold tracking-wide text-white"
                    style={{
                      textShadow: isRunning
                        ? "0 0 8px rgba(124, 58, 237, 0.6)"
                        : "none",
                    }}
                  >
                    {formatTime(seconds)}
                  </span>

                  {/* Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePlayPause}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        "transition-colors duration-150",
                        isRunning
                          ? "bg-purple-500/20 hover:bg-purple-500/30 text-purple-300"
                          : "bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                      )}
                      aria-label={isRunning ? "Pause timer" : "Start timer"}
                    >
                      {isRunning ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      )}
                    </button>

                    <button
                      onClick={handleStop}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        "bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400",
                        "transition-colors duration-150"
                      )}
                      aria-label="Stop timer"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setIsExpanded(false)}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white",
                        "transition-colors duration-150"
                      )}
                      aria-label="Minimize timer"
                    >
                      <ChevronUp className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Minimized state - just the timer */
              <motion.button
                key="minimized"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setIsExpanded(true)}
                className={cn(
                  "px-4 py-2.5 flex items-center gap-2",
                  "hover:bg-white/5 transition-colors duration-150",
                  "cursor-pointer"
                )}
                aria-label="Expand timer"
              >
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isRunning ? "bg-[#7C3AED] animate-pulse" : "bg-gray-500"
                  )}
                />
                <span
                  className="text-sm font-mono font-medium text-white"
                  style={{
                    textShadow: isRunning
                      ? "0 0 6px rgba(124, 58, 237, 0.5)"
                      : "none",
                  }}
                >
                  {formatTime(seconds)}
                </span>
                <ChevronUp className="w-3 h-3 text-gray-400" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
