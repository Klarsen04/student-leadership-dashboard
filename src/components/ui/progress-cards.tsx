"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressCardProps {
  title: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
  className?: string;
}

function AnimatedNumber({ value, suffix }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 40, stiffness: 120 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, isInView, value]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent =
            Math.round(latest).toString() + (suffix || "");
        }
      }),
    [springValue, suffix]
  );

  return (
    <span ref={ref} className="inline-block tabular-nums font-bold text-black">
      0
    </span>
  );
}

function CircularProgress({
  value,
  total,
  color,
  size = 32,
  strokeWidth = 3,
}: {
  value: number;
  total: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = total > 0 ? Math.min(value / total, 1) : 0;
  const offset = (1 - percentage) * circumference;

  return (
    <svg
      className="-rotate-90 transform"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(0,0,0,0.06)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
      />
    </svg>
  );
}

export function ProgressCard({
  title,
  value,
  total,
  icon,
  color,
  suffix,
  className,
}: ProgressCardProps) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm",
        "w-[150px] h-[80px] overflow-hidden",
        className
      )}
    >
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 rounded-xl opacity-[0.04]"
        style={{
          background: `linear-gradient(135deg, ${color}, transparent)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center gap-3 w-full">
        {/* Circular progress with icon overlay */}
        <div className="relative flex-shrink-0">
          <CircularProgress value={value} total={total} color={color} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs" style={{ color }}>
              {icon}
            </span>
          </div>
        </div>

        {/* Text content */}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate">
            {title}
          </span>
          <div className="flex items-baseline gap-0.5">
            <AnimatedNumber value={value} suffix={suffix} />
            <span className="text-xs text-gray-400 font-medium">
              /{total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProgressCardsRowProps {
  cards: Array<{
    title: string;
    value: number;
    total: number;
    icon: React.ReactNode;
    color: string;
    suffix?: string;
  }>;
  className?: string;
}

export function ProgressCardsRow({ cards, className }: ProgressCardsRowProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            ease: "easeOut",
            delay: index * 0.1,
          }}
        >
          <ProgressCard
            title={card.title}
            value={card.value}
            total={card.total}
            icon={card.icon}
            color={card.color}
            suffix={card.suffix}
          />
        </motion.div>
      ))}
    </div>
  );
}
