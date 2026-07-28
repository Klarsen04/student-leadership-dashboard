"use client";

import { cn } from "@/lib/utils";

interface AnimatedGradientTextProps {
  children: React.ReactNode;
  className?: string;
  colorFrom?: string;
  colorTo?: string;
  speed?: number;
}

export function AnimatedGradientText({
  children,
  className,
  colorFrom = "#a855f7",
  colorTo = "#ec4899",
  speed = 3,
}: AnimatedGradientTextProps) {
  return (
    <span
      className={cn("inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: `linear-gradient(90deg, ${colorFrom}, ${colorTo}, ${colorFrom})`,
        backgroundSize: `${speed * 100}% 100%`,
        animation: `gradient-shift ${speed}s linear infinite`,
      }}
    >
      {children}
    </span>
  );
}
