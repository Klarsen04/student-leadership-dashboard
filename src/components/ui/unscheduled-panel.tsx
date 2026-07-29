"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Calendar, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnscheduledTask {
  id: string;
  title: string;
  priority: string;
  status: string;
}

interface UnscheduledPanelProps {
  tasks: UnscheduledTask[];
  className?: string;
  onScheduleTask?: (taskId: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

export function UnscheduledPanel({ tasks, className, onScheduleTask }: UnscheduledPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const unscheduled = tasks.filter((t) => t.status !== "done");

  if (unscheduled.length === 0) return null;

  return (
    <div className={cn("bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-semibold text-black/70">Unscheduled</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
            {unscheduled.length}
          </span>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 text-black/40" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-0.5 max-h-32 overflow-y-auto">
              {unscheduled.slice(0, 8).map((task, idx) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-black/[0.03] group cursor-grab active:cursor-grabbing transition-colors"
                  draggable
                  onDragStart={(e: any) => {
                    e.dataTransfer?.setData("text/plain", task.id);
                  }}
                >
                  <GripVertical className="w-3 h-3 text-black/20 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium }}
                  />
                  <span className="text-[11px] text-black/70 truncate flex-1">{task.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onScheduleTask?.(task.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium transition-opacity hover:bg-purple-200"
                  >
                    Schedule
                  </button>
                </motion.div>
              ))}
              {unscheduled.length > 8 && (
                <p className="text-[9px] text-black/30 text-center py-1">+{unscheduled.length - 8} more</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
