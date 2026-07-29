"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileText, Image, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportButtonProps {
  onExport: (format: "pdf" | "ical" | "image" | "share") => void;
  className?: string;
}

export function ExportButton({ onExport, className }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const options = [
    { id: "pdf" as const, label: "Export PDF", icon: FileText, color: "#ef4444" },
    { id: "ical" as const, label: "Export iCal", icon: Download, color: "#3b82f6" },
    { id: "image" as const, label: "Save Image", icon: Image, color: "#10b981" },
    { id: "share" as const, label: "Share Link", icon: Share2, color: "#a855f7" },
  ];

  const handleExport = (format: "pdf" | "ical" | "image" | "share") => {
    onExport(format);
    setExported(format);
    setTimeout(() => { setExported(null); setIsOpen(false); }, 1500);
  };

  return (
    <div className={cn("relative", className)}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/5 text-black/60 text-xs font-medium hover:bg-black/10 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Download className="w-3 h-3" />
        <span>Export</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -5 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute top-full right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-black/10 overflow-hidden z-50"
          >
            {options.map((opt, i) => (
              <motion.button
                key={opt.id}
                onClick={() => handleExport(opt.id)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-black/[0.03] transition-colors"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <opt.icon className="w-3.5 h-3.5" style={{ color: opt.color }} />
                <span className="text-xs text-black/70 font-medium flex-1">{opt.label}</span>
                {exported === opt.id && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <Check className="w-3 h-3 text-green-500" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
