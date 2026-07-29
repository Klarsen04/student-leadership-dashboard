"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Calendar, BookOpen, Plus, ArrowRight, Command } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  commands: CommandItem[];
}

export function CommandPalette({ commands }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((p) => !p);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      setIsOpen(false);
      setQuery("");
    }
  };

  const categories = [...new Set(filtered.map((c) => c.category))];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            className="fixed top-[20%] left-1/2 z-[201] w-[520px] -translate-x-1/2 rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5">
              <Search className="w-4 h-4 text-black/30" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search commands..."
                className="flex-1 text-sm text-black bg-transparent outline-none placeholder:text-black/30"
              />
              <kbd className="px-1.5 py-0.5 rounded bg-black/5 text-[9px] font-mono text-black/40 border border-black/10">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto p-2">
              {categories.map((category) => (
                <div key={category}>
                  <p className="text-[9px] uppercase tracking-wider font-semibold text-black/30 px-2 py-1.5">
                    {category}
                  </p>
                  {filtered
                    .filter((c) => c.category === category)
                    .map((cmd) => {
                      const globalIdx = filtered.indexOf(cmd);
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => { cmd.action(); setIsOpen(false); setQuery(""); }}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors",
                            globalIdx === selectedIndex
                              ? "bg-purple-50 text-purple-900"
                              : "text-black/70 hover:bg-black/[0.03]"
                          )}
                        >
                          <span className="text-black/40">{cmd.icon}</span>
                          <span className="text-xs font-medium flex-1">{cmd.label}</span>
                          {globalIdx === selectedIndex && (
                            <ArrowRight className="w-3 h-3 text-purple-400" />
                          )}
                        </button>
                      );
                    })}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-black/30 py-6">No commands found</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-black/[0.02] border-t border-black/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[9px] text-black/30">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] text-black/30">
                <Command className="w-3 h-3" />
                <span>K to toggle</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
