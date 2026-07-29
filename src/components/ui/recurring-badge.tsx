"use client";

import * as React from "react";
import { Repeat } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ─── RecurringBadge ──────────────────────────────────────────────────────────

interface RecurringBadgeProps {
  className?: string;
  size?: "sm" | "md";
  tooltip?: string;
}

export function RecurringBadge({
  className,
  size = "sm",
  tooltip = "Recurring",
}: RecurringBadgeProps) {
  const sizeMap = { sm: 14, md: 18 } as const;
  const px = sizeMap[size];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-purple-50 text-purple-500",
        size === "sm" && "h-5 w-5",
        size === "md" && "h-6 w-6",
        className
      )}
      title={tooltip}
    >
      <Repeat
        size={px}
        className="animate-[spin_8s_linear_infinite]"
      />
    </span>
  );
}

// ─── PriorityFlag ────────────────────────────────────────────────────────────

type Priority = "urgent" | "high" | "medium" | "low";

interface PriorityFlagProps {
  priority: Priority;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

const PRIORITY_CLASSES: Record<Priority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-500",
};

export function PriorityFlag({
  priority,
  size = "sm",
  showLabel = false,
  className,
}: PriorityFlagProps) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-3 w-3";

  const dot =
    priority === "urgent" ? (
      <motion.span
        className={cn("inline-block rounded-full", dotSize, PRIORITY_CLASSES[priority])}
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.7, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      />
    ) : (
      <span
        className={cn("inline-block rounded-full", dotSize)}
        style={{ backgroundColor: PRIORITY_COLORS[priority] }}
      />
    );

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      {dot}
      {showLabel && (
        <span
          className="text-xs font-medium capitalize"
          style={{ color: PRIORITY_COLORS[priority] }}
        >
          {priority}
        </span>
      )}
    </span>
  );
}
