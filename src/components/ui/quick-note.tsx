"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StickyNote, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickNoteProps {
  className?: string;
  onSave?: (note: string) => void;
}

export function QuickNote({ className, onSave }: QuickNoteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = () => {
    if (note.trim()) {
      onSave?.(note.trim());
      setSaved(true);
      setTimeout(() => { setSaved(false); setNote(""); setIsOpen(false); }, 1000);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200/50 hover:bg-amber-100 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <StickyNote className="w-3 h-3" />
        <span>Note</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -5 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="absolute top-full right-0 mt-2 w-64 bg-amber-50 rounded-xl shadow-xl border border-amber-200 overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200/50">
              <span className="text-xs font-semibold text-amber-800">Quick Note</span>
              <button onClick={() => setIsOpen(false)} className="p-0.5 rounded hover:bg-amber-200/50 text-amber-600">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="p-2">
              <textarea
                ref={textareaRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Jot something down..."
                className="w-full h-20 px-2 py-1.5 text-xs bg-white/80 rounded-lg border border-amber-200/50 resize-none focus:outline-none focus:ring-1 focus:ring-amber-300 text-amber-900 placeholder:text-amber-400"
                onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleSave(); }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[9px] text-amber-500">⌘+Enter to save</span>
                <motion.button
                  onClick={handleSave}
                  disabled={!note.trim()}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-600 text-white text-[10px] font-medium disabled:opacity-40 hover:bg-amber-700 transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  {saved ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}>✓</motion.span> : <Save className="w-3 h-3" />}
                  <span>{saved ? "Saved!" : "Save"}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
