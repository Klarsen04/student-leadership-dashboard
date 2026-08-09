"use client";

import { motion } from "motion/react";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.15 },
  },
};

const word = {
  hidden: { opacity: 0, y: "0.5em", filter: "blur(12px)" },
  show: {
    opacity: 1,
    y: "0em",
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Per-word blur-to-sharp + y-offset reveal for the hero headline.
 * `accentFrom` marks the index at which words switch to the accent gradient.
 */
export function AnimatedHeadline({
  lines,
  accentLine,
}: {
  lines: string[];
  accentLine: number;
}) {
  return (
    <motion.h1
      variants={container}
      initial="hidden"
      animate="show"
      className="font-semibold tracking-[-0.03em] leading-[0.95] text-[clamp(2.75rem,8vw,6rem)]"
    >
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.split(" ").map((w, wi) => (
            <motion.span
              key={`${li}-${wi}`}
              variants={word}
              className={
                "inline-block " +
                (li === accentLine
                  ? "bg-gradient-to-r from-violet-300 via-fuchsia-300 to-teal-200 bg-clip-text text-transparent"
                  : "text-white")
              }
              style={{ willChange: "transform, filter, opacity" }}
            >
              {w}
              {wi < line.split(" ").length - 1 ? " " : ""}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.h1>
  );
}
