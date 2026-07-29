"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["N"], description: "New event" },
  { keys: ["C"], description: "New class" },
  { keys: ["T"], description: "Today" },
  { keys: ["1"], description: "Day view" },
  { keys: ["3"], description: "3-Day view" },
  { keys: ["5"], description: "5-Day view" },
  { keys: ["W"], description: "Week view" },
  { keys: ["M"], description: "Month view" },
  { keys: ["←"], description: "Previous" },
  { keys: ["→"], description: "Next" },
  { keys: ["?"], description: "Show shortcuts" },
];

interface KeyboardShortcutsProps {
  onAction: (action: string) => void;
}

export function KeyboardShortcuts({ onAction }: KeyboardShortcutsProps) {
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "n": onAction("new-event"); break;
        case "c": onAction("new-class"); break;
        case "t": onAction("today"); break;
        case "1": onAction("day"); break;
        case "3": onAction("3day"); break;
        case "5": onAction("5day"); break;
        case "w": onAction("week"); break;
        case "m": onAction("month"); break;
        case "arrowleft": onAction("prev"); break;
        case "arrowright": onAction("next"); break;
        case "?": setShowPanel((p) => !p); break;
        case "escape": setShowPanel(false); break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAction]);

  return (
    <>
      {/* Floating shortcut hint button */}
      <motion.button
        onClick={() => setShowPanel(true)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/80 text-white text-xs font-medium shadow-lg backdrop-blur-sm border border-white/10 hover:bg-black/90 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <Keyboard className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Shortcuts</span>
        <kbd className="ml-1 px-1 py-0.5 rounded bg-white/20 text-[9px]">?</kbd>
      </motion.button>

      {/* Shortcuts panel overlay */}
      <AnimatePresence>
        {showPanel && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPanel(false)}
            />
            <motion.div
              className="fixed top-1/2 left-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-black">Keyboard Shortcuts</h3>
                </div>
                <button onClick={() => setShowPanel(false)} className="p-1 rounded-md hover:bg-black/5 text-black/40">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 space-y-1 max-h-80 overflow-y-auto">
                {SHORTCUTS.map((shortcut) => (
                  <div key={shortcut.description} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-black/[0.02]">
                    <span className="text-xs text-black/70">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="min-w-[24px] h-6 flex items-center justify-center px-1.5 rounded-md bg-black/5 border border-black/10 text-[10px] font-mono font-bold text-black/60"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 bg-black/[0.02] border-t border-black/5">
                <p className="text-[10px] text-black/40 text-center">Press <kbd className="px-1 py-0.5 rounded bg-black/5 text-[9px] font-mono">?</kbd> to toggle • <kbd className="px-1 py-0.5 rounded bg-black/5 text-[9px] font-mono">Esc</kbd> to close</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
