"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  subtitle?: string;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

const floatAnimation = (delay: number, duration: number, y: number) => ({
  y: [0, -y, 0],
  transition: {
    duration,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay,
  },
});

export function EmptyState({
  title = "No events scheduled",
  subtitle = "Click any time slot or press N to create one",
  onAction,
  actionLabel = "Create Event",
  className,
}: EmptyStateProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" as const },
    },
  };

  return (
    <motion.div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4",
        className
      )}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* SVG Illustration */}
      <motion.div variants={itemVariants} className="relative w-[120px] h-[120px] mb-6">
        <motion.svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Calendar body */}
          <rect
            x="24"
            y="32"
            width="72"
            height="64"
            rx="8"
            stroke="#a78bfa"
            strokeWidth="2"
            fill="#f5f3ff"
          />
          {/* Calendar header */}
          <rect
            x="24"
            y="32"
            width="72"
            height="18"
            rx="8"
            fill="#a78bfa"
          />
          {/* Header bottom cover (squared corners) */}
          <rect x="24" y="42" width="72" height="8" fill="#a78bfa" />
          {/* Calendar rings */}
          <rect x="42" y="26" width="3" height="12" rx="1.5" fill="#7c3aed" />
          <rect x="75" y="26" width="3" height="12" rx="1.5" fill="#7c3aed" />
          {/* Grid lines (subtle) */}
          <line x1="24" y1="62" x2="96" y2="62" stroke="#e9d5ff" strokeWidth="1" />
          <line x1="24" y1="74" x2="96" y2="74" stroke="#e9d5ff" strokeWidth="1" />
          <line x1="24" y1="86" x2="96" y2="86" stroke="#e9d5ff" strokeWidth="1" />
          <line x1="48" y1="50" x2="48" y2="96" stroke="#e9d5ff" strokeWidth="1" />
          <line x1="72" y1="50" x2="72" y2="96" stroke="#e9d5ff" strokeWidth="1" />
        </motion.svg>

        {/* Floating circle - purple */}
        <motion.div
          className="absolute top-1 right-1"
          animate={floatAnimation(0, 3, 6)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" fill="#c084fc" opacity="0.8" />
          </svg>
        </motion.div>

        {/* Floating star - pink */}
        <motion.div
          className="absolute bottom-4 left-0"
          animate={floatAnimation(0.5, 3.5, 8)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1l1.8 4.2L14 6.5l-3.2 2.8.9 4.7L8 11.5 4.3 14l.9-4.7L2 6.5l4.2-1.3L8 1z"
              fill="#f472b6"
              opacity="0.8"
            />
          </svg>
        </motion.div>

        {/* Floating diamond - blue */}
        <motion.div
          className="absolute top-6 left-2"
          animate={floatAnimation(1, 4, 5)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect
              x="6"
              y="0"
              width="6"
              height="6"
              rx="1"
              transform="rotate(45 6 0)"
              fill="#60a5fa"
              opacity="0.8"
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* Title */}
      <motion.h3
        variants={itemVariants}
        className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1"
      >
        {title}
      </motion.h3>

      {/* Subtitle */}
      <motion.p
        variants={itemVariants}
        className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-[260px]"
      >
        {subtitle}
      </motion.p>

      {/* CTA Button */}
      {onAction && (
        <motion.button
          variants={itemVariants}
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors shadow-md shadow-purple-500/20"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
