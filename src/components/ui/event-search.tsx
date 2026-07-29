"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Filter, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventSearchProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: { categories: string[] }) => void;
  categories: string[];
  resultCount: number;
  className?: string;
}

export function EventSearch({
  onSearch,
  onFilterChange,
  categories,
  resultCount,
  className,
}: EventSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: "/" to focus the search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(
          (e.target as HTMLElement)?.tagName || ""
        )
      ) {
        e.preventDefault();
        setIsExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Live filtering as you type
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      onSearch(value);
    },
    [onSearch]
  );

  const toggleCategory = useCallback(
    (category: string) => {
      setActiveCategories((prev) => {
        const next = prev.includes(category)
          ? prev.filter((c) => c !== category)
          : [...prev, category];
        onFilterChange({ categories: next });
        return next;
      });
    },
    [onFilterChange]
  );

  const clearAll = useCallback(() => {
    setQuery("");
    setActiveCategories([]);
    onSearch("");
    onFilterChange({ categories: [] });
  }, [onSearch, onFilterChange]);

  const collapse = useCallback(() => {
    if (!query && activeCategories.length === 0) {
      setIsExpanded(false);
    }
  }, [query, activeCategories]);

  const hasActiveFilters = query.length > 0 || activeCategories.length > 0;

  return (
    <div className={cn("relative", className)}>
      <motion.div
        className="flex items-center gap-2 rounded-full border border-black/10 bg-white shadow-sm overflow-hidden"
        animate={{ width: isExpanded ? 280 : 36 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Search icon / trigger */}
        <button
          type="button"
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 text-black/50 hover:text-black/80 transition-colors"
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          aria-label="Search events"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Input field */}
        <AnimatePresence>
          {isExpanded && (
            <motion.input
              ref={inputRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onBlur={collapse}
              placeholder="Search events..."
              className="flex-1 min-w-0 bg-transparent text-sm text-black placeholder:text-black/40 outline-none pr-2"
            />
          )}
        </AnimatePresence>

        {/* Clear / close button */}
        <AnimatePresence>
          {isExpanded && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              type="button"
              className="flex-shrink-0 flex items-center justify-center w-7 h-7 mr-1 rounded-full text-black/40 hover:text-black/70 hover:bg-black/5 transition-colors"
              onClick={() => {
                clearAll();
                setIsExpanded(false);
              }}
              aria-label="Close search"
            >
              <X className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Filter chips area */}
      <AnimatePresence>
        {isExpanded && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="absolute top-full left-0 mt-2 flex flex-wrap items-center gap-1.5 w-[280px]"
          >
            {/* Filter icon */}
            <div className="flex items-center gap-1 text-black/40 mr-1">
              <Filter className="w-3 h-3" />
            </div>

            {/* Category chips */}
            {categories.map((category) => {
              const isActive = activeCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors",
                    isActive
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-black/5 text-black/60 border border-transparent hover:bg-black/10"
                  )}
                >
                  <Hash className="w-2.5 h-2.5" />
                  {category}
                </button>
              );
            })}

            {/* Clear all + result count */}
            <div className="flex items-center gap-2 ml-auto">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-black/40 hover:text-black/70 transition-colors underline"
                >
                  Clear all
                </button>
              )}

              {/* Results badge */}
              <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-semibold">
                {resultCount}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
