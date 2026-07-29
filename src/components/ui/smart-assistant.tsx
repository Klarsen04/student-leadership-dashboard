"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Clock, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Insight {
  id: string;
  type: "tip" | "warning" | "stat";
  message: string;
  icon: "clock" | "alert" | "trend";
}

interface SmartAssistantProps {
  totalClasses: number;
  totalHours: number;
  busyDays: number;
  freeDays: number;
  className?: string;
}

export function SmartAssistant({ totalClasses, totalHours, busyDays, freeDays, className }: SmartAssistantProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const insights: Insight[] = [];

  if (totalHours > 30) {
    insights.push({ id: "overloaded", type: "warning", message: `You have ${totalHours.toFixed(0)}h scheduled this week. Consider lighter load.`, icon: "alert" });
  }
  if (freeDays > 0) {
    insights.push({ id: "free-days", type: "tip", message: `${freeDays} day${freeDays > 1 ? "s" : ""} with no classes — perfect for deep work!`, icon: "clock" });
  }
  if (totalClasses >= 4) {
    insights.push({ id: "full-load", type: "stat", message: `${totalClasses} classes this semester. Above average student load.`, icon: "trend" });
  }
  if (busyDays >= 4) {
    insights.push({ id: "packed", type: "warning", message: `${busyDays} busy days this week. Remember to take breaks.`, icon: "alert" });
  }

  const visible = insights.filter((i) => !dismissed.includes(i.id));
  if (visible.length === 0) return null;

  const iconMap = { clock: Clock, alert: AlertCircle, trend: TrendingUp };
  const colorMap = { tip: "text-blue-600 bg-blue-50", warning: "text-amber-600 bg-amber-50", stat: "text-purple-600 bg-purple-50" };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5 px-1">
        <Sparkles className="w-3 h-3 text-purple-500" />
        <span className="text-[9px] uppercase tracking-wider font-semibold text-black/40">AI Insights</span>
      </div>
      <AnimatePresence>
        {visible.slice(0, 2).map((insight, idx) => {
          const Icon = iconMap[insight.icon];
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
              className={cn("flex items-start gap-2 px-2.5 py-2 rounded-lg border", colorMap[insight.type], "border-current/10")}
            >
              <Icon className="w-3 h-3 mt-0.5 shrink-0" />
              <p className="text-[10px] leading-tight flex-1">{insight.message}</p>
              <button onClick={() => setDismissed((d) => [...d, insight.id])} className="p-0.5 rounded hover:bg-black/10 shrink-0 opacity-50 hover:opacity-100">
                <X className="w-2.5 h-2.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
