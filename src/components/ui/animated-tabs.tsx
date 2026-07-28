"use client";

import { motion } from "framer-motion";
import { useRef, useState, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function AnimatedTabs({ tabs, activeTab, onTabChange, className }: AnimatedTabsProps) {
  const [dimensions, setDimensions] = useState({ width: 0, left: 0 });
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const update = () => {
      const btn = buttonRefs.current.get(activeTab);
      const container = containerRef.current;
      if (btn && container) {
        const rect = btn.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        setDimensions({ width: rect.width, left: rect.left - containerRect.left });
      }
    };
    requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeTab]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center gap-0.5 bg-white border border-black/10 rounded-full p-1 shadow-sm",
        className
      )}
    >
      {/* Sliding pill background */}
      <motion.div
        className="absolute h-[calc(100%-8px)] rounded-full bg-black shadow-sm"
        initial={false}
        animate={{ width: dimensions.width - 4, x: dimensions.left + 2 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ top: 4 }}
      />

      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => { if (el) buttonRefs.current.set(tab.id, el); }}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative z-10 px-3 py-1.5 rounded-full text-xs font-medium transition-colors duration-200",
              isActive ? "text-white" : "text-black/60 hover:text-black"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
