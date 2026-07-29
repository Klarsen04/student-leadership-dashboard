"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  GlassPanel                                                                 */
/* -------------------------------------------------------------------------- */

interface GlassPanelProps {
  className?: string;
  children: React.ReactNode;
  /** Enable a subtle purple glow shadow around the panel */
  glow?: boolean;
  /** Custom glow color (CSS color value). Defaults to purple. */
  glowColor?: string;
}

/**
 * A ClickUp-inspired glassmorphism container with frosted backdrop blur,
 * a subtle semi-transparent border, and an optional purple glow shadow.
 */
export function GlassPanel({
  className,
  children,
  glow = false,
  glowColor = "rgba(139, 92, 246, 0.25)",
}: GlassPanelProps) {
  return (
    <div
      className={cn("relative rounded-[18px] overflow-hidden", className)}
      style={{
        background: "rgba(26, 26, 46, 0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: glow ? `0 0 40px ${glowColor}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  GradientBorder                                                             */
/* -------------------------------------------------------------------------- */

interface GradientBorderProps {
  className?: string;
  children: React.ReactNode;
  /** Animation cycle duration in seconds. Defaults to 4. */
  speed?: number;
  /** Gradient color stops. Defaults to purple-to-pink. */
  colors?: string[];
}

/**
 * A card wrapper with an animated cycling gradient border (purple to pink).
 * Uses a rotating conic-gradient behind a slightly inset inner panel.
 */
export function GradientBorder({
  className,
  children,
  speed = 4,
  colors = ["#7C3AED", "#EC4899", "#7C3AED"],
}: GradientBorderProps) {
  const gradientStops = colors.join(", ");

  return (
    <div
      className={cn("relative rounded-[20px] p-[1px] overflow-hidden", className)}
    >
      {/* Animated gradient border layer */}
      <div
        className="absolute inset-0 rounded-[20px]"
        style={{
          background: `linear-gradient(var(--gradient-angle, 0deg), ${gradientStops})`,
          animation: `glassmorphism-gradient-rotate ${speed}s linear infinite`,
        }}
      />
      {/* Inner content panel */}
      <div
        className="relative rounded-[19px] h-full w-full overflow-hidden"
        style={{
          background: "rgba(26, 26, 46, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        {children}
      </div>

      {/* CSS keyframes injected via style tag */}
      <style jsx>{`
        @property --gradient-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes glassmorphism-gradient-rotate {
          from {
            --gradient-angle: 0deg;
          }
          to {
            --gradient-angle: 360deg;
          }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AmbientGlow                                                                */
/* -------------------------------------------------------------------------- */

interface AmbientGlowProps {
  className?: string;
  /** Glow color. Defaults to purple. */
  color?: string;
  /** Diameter of the glow in pixels or CSS units. Defaults to "400px". */
  size?: string;
  /** Opacity/intensity of the glow (0 to 1). Defaults to 0.25. */
  intensity?: number;
}

/**
 * A decorative background element that creates a radial purple glow spot.
 * Position it with className (e.g. absolute top-0 left-1/2).
 */
export function AmbientGlow({
  className,
  color = "rgba(139, 92, 246, 1)",
  size = "400px",
  intensity = 0.25,
}: AmbientGlowProps) {
  return (
    <div
      className={cn("pointer-events-none", className)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
        opacity: intensity,
        filter: "blur(60px)",
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  FloatingElement                                                             */
/* -------------------------------------------------------------------------- */

interface FloatingElementProps {
  className?: string;
  children: React.ReactNode;
  /** Peak displacement in pixels. Defaults to 5. */
  amplitude?: number;
  /** Full oscillation cycle duration in seconds. Defaults to 3. */
  duration?: number;
}

/**
 * Wraps children with a gentle Y-axis oscillation (floating animation)
 * powered by framer-motion.
 */
export function FloatingElement({
  className,
  children,
  amplitude = 5,
  duration = 3,
}: FloatingElementProps) {
  return (
    <motion.div
      className={className}
      animate={{ y: [-amplitude, amplitude, -amplitude] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}
