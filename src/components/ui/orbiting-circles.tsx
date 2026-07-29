"use client";

import { cn } from "@/lib/utils";

interface OrbitingCirclesProps {
  className?: string;
  children?: React.ReactNode;
  radius?: number;
  duration?: number;
  delay?: number;
  reverse?: boolean;
  path?: boolean;
}

export function OrbitingCircles({
  className,
  children,
  radius = 50,
  duration = 20,
  delay = 0,
  reverse = false,
  path = true,
}: OrbitingCirclesProps) {
  return (
    <>
      {path && (
        <svg className="pointer-events-none absolute inset-0 size-full">
          <circle
            className="stroke-black/[0.04]"
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>
      )}
      <div
        className={cn(
          "absolute flex size-full transform-gpu animate-orbit items-center justify-center rounded-full",
          reverse && "[animation-direction:reverse]",
          className
        )}
        style={{
          "--duration": `${duration}s`,
          "--radius": `${radius}px`,
          "--delay": `${-delay}s`,
          animationDelay: `${-delay}s`,
          animationDuration: `${duration}s`,
        } as React.CSSProperties}
      >
        {children}
      </div>
    </>
  );
}
