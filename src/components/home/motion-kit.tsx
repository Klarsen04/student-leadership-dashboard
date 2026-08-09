"use client";

// Shared PeacePod motion toolkit — gentle, springy, warm.
// All helpers respect prefers-reduced-motion (fall back to static/no-op).
import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const SPRING = { type: "spring", stiffness: 120, damping: 16 } as const;

/** Stagger container: children with `StaggerItem` reveal one after another. */
export function Stagger({
  children,
  className,
  gap = 0.08,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  const variants: Variants = {
    hidden: { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: SPRING },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

/** Bouncy tap/hover wrapper for buttons, pills, cards. */
export function Bounce({
  children,
  className,
  lift = -3,
  scale = 1.03,
  tap = 0.96,
}: {
  children: ReactNode;
  className?: string;
  lift?: number;
  scale?: number;
  tap?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      whileHover={{ y: lift, scale }}
      whileTap={{ scale: tap }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}

/** One-shot springy pop-in on mount (for hero elements / mascots). */
export function Pop({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay }}
    >
      {children}
    </motion.div>
  );
}
