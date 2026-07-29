"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Check, AlertCircle, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type SyncState = "synced" | "syncing" | "error" | "idle";

interface SyncStatusProps {
  state: SyncState;
  lastSyncTime?: Date;
  onSync: () => void;
  className?: string;
}

const stateConfig = {
  synced: {
    label: "Synced",
    dotColor: "bg-green-500",
    textColor: "text-green-700",
    icon: Check,
  },
  syncing: {
    label: "Syncing...",
    dotColor: "bg-blue-500",
    textColor: "text-blue-700",
    icon: RefreshCw,
  },
  error: {
    label: "Sync failed",
    dotColor: "bg-red-500",
    textColor: "text-red-700",
    icon: AlertCircle,
  },
  idle: {
    label: "Idle",
    dotColor: "bg-gray-400",
    textColor: "text-gray-600",
    icon: Cloud,
  },
};

export function SyncStatus({
  state,
  lastSyncTime,
  onSync,
  className,
}: SyncStatusProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  const tooltipText = lastSyncTime
    ? `Last synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}`
    : "Never synced";

  return (
    <motion.button
      onClick={onSync}
      title={tooltipText}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        "border border-gray-200 bg-white shadow-sm transition-colors",
        "hover:bg-gray-50 active:bg-gray-100",
        state === "error" && "shadow-red-100",
        className
      )}
      whileTap={{ scale: 0.96 }}
    >
      {/* Status dot / icon */}
      <AnimatePresence mode="wait">
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.2 }}
          className="relative flex items-center justify-center"
        >
          {state === "syncing" ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="flex items-center justify-center"
            >
              <RefreshCw className="h-3 w-3 text-blue-600" />
            </motion.span>
          ) : (
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75",
                  config.dotColor,
                  state === "synced" && "animate-ping"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  config.dotColor
                )}
              />
            </span>
          )}
        </motion.span>
      </AnimatePresence>

      {/* Label */}
      <AnimatePresence mode="wait">
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className={cn("whitespace-nowrap", config.textColor)}
        >
          {config.label}
        </motion.span>
      </AnimatePresence>

      {/* Error glow */}
      {state === "error" && (
        <motion.span
          className="absolute inset-0 rounded-full bg-red-400/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
}
