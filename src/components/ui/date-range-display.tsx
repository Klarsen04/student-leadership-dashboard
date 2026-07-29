"use client";

import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRangeDisplayProps {
  startDate: Date;
  endDate: Date;
  className?: string;
  onClick?: () => void;
}

export function DateRangeDisplay({ startDate, endDate, className, onClick }: DateRangeDisplayProps) {
  const formatShort = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isSameMonth = startDate.getMonth() === endDate.getMonth();

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 border border-black/5 shadow-sm text-xs font-medium text-black/70 hover:bg-white hover:shadow-md transition-all",
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Calendar className="w-3.5 h-3.5 text-purple-500" />
      <span>
        {formatShort(startDate)}
        {!isSameMonth && ` – ${formatShort(endDate)}`}
        {isSameMonth && ` – ${endDate.getDate()}`}
      </span>
    </motion.button>
  );
}
