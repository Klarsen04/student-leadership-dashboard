"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface EventReminderProps {
  event: {
    id: string;
    title: string;
    startTime: string;
    location?: string | null;
  } | null;
  minutesBefore?: number;
  onDismiss: () => void;
  onOpen: (id: string) => void;
}

export function EventReminder({
  event,
  minutesBefore = 5,
  onDismiss,
  onOpen,
}: EventReminderProps) {
  useEffect(() => {
    if (!event) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, 10000);

    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  const handleOpen = useCallback(() => {
    if (event) {
      onOpen(event.id);
    }
  }, [event, onOpen]);

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.id}
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "fixed top-20 right-4 z-50 w-[360px]",
            "flex overflow-hidden rounded-xl",
            "bg-white/80 dark:bg-gray-900/80",
            "backdrop-blur-xl",
            "border border-white/20 dark:border-gray-700/50",
            "shadow-xl shadow-purple-500/10"
          )}
        >
          {/* Purple gradient accent bar */}
          <div className="w-1.5 shrink-0 bg-gradient-to-b from-purple-500 via-violet-500 to-indigo-500" />

          <div className="flex flex-1 items-start gap-3 p-4">
            {/* Pulsing bell icon */}
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40"
            >
              <Bell className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </motion.div>

            {/* Content */}
            <div className="flex flex-1 flex-col gap-1.5 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {event.title}
              </p>

              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Starts in {minutesBefore} min
                </span>
                {event.location && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                {format(new Date(event.startTime), "h:mm a")}
              </p>

              {/* Action buttons */}
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="h-7 px-2.5 text-xs"
                >
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpen}
                  className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Open
                </Button>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onDismiss}
              className="shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
