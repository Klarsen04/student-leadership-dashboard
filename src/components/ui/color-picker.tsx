"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = [
  { hex: "#ef4444", name: "Red" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#10b981", name: "Emerald" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#6366f1", name: "Indigo" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#64748b", name: "Slate" },
] as const;

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);

  return (
    <div className={cn("relative", className)}>
      <div className="grid grid-cols-4 gap-2">
        {COLORS.map((color) => {
          const isSelected = value === color.hex;

          return (
            <div key={color.hex} className="relative flex items-center justify-center">
              <motion.button
                type="button"
                onClick={() => onChange(color.hex)}
                onMouseEnter={() => setHoveredColor(color.hex)}
                onMouseLeave={() => setHoveredColor(null)}
                className="relative w-7 h-7 rounded-lg transition-shadow duration-200"
                style={{
                  backgroundColor: color.hex,
                  boxShadow: `inset 0 2px 4px rgba(0, 0, 0, 0.15)`,
                  outline: isSelected ? `2px solid ${color.hex}` : undefined,
                  outlineOffset: isSelected ? "2px" : undefined,
                }}
                whileHover={{
                  scale: 1.1,
                  boxShadow: `inset 0 2px 4px rgba(0, 0, 0, 0.15), 0 0 12px ${color.hex}80`,
                }}
                transition={{ duration: 0.2 }}
              >
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <Check className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredColor === color.hex && (
                  <motion.div
                    className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-medium whitespace-nowrap pointer-events-none z-10"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {color.name}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
