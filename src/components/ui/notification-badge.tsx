"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NotificationBadgeProps {
  count: number;
  className?: string;
  maxCount?: number;
  color?: string;
}

export function NotificationBadge({ count, className, maxCount = 99, color = "#ef4444" }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const display = count > maxCount ? `${maxCount}+` : String(count);

  return (
    <AnimatePresence>
      <motion.span
        key={count}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={cn(
          "absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1",
          className
        )}
        style={{ background: color }}
      >
        {display}
      </motion.span>
    </AnimatePresence>
  );
}
