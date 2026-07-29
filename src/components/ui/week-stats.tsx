"use client";

import { motion } from "framer-motion";
import { Clock, BookOpen, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeekStatsProps {
  totalClasses: number;
  totalEvents: number;
  totalHours: number;
  busyPercentage: number;
  className?: string;
}

export function WeekStats({ totalClasses, totalEvents, totalHours, busyPercentage, className }: WeekStatsProps) {
  const stats = [
    { icon: BookOpen, label: "Classes", value: totalClasses, color: "#a855f7" },
    { icon: Calendar, label: "Events", value: totalEvents, color: "#3b82f6" },
    { icon: Clock, label: "Hours", value: `${totalHours.toFixed(1)}h`, color: "#10b981" },
    { icon: TrendingUp, label: "Busy", value: `${busyPercentage}%`, color: busyPercentage > 80 ? "#ef4444" : busyPercentage > 50 ? "#f59e0b" : "#10b981" },
  ];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 + 0.3, duration: 0.4 }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/80 border border-black/5 shadow-sm"
        >
          <stat.icon className="w-3 h-3" style={{ color: stat.color }} />
          <span className="text-[10px] font-bold text-black/80">{stat.value}</span>
          <span className="text-[9px] text-black/40 hidden sm:inline">{stat.label}</span>
        </motion.div>
      ))}
    </div>
  );
}
