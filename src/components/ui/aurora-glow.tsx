"use client";

import { cn } from "@/lib/utils";

interface AuroraGlowProps {
  className?: string;
  color1?: string;
  color2?: string;
  color3?: string;
  opacity?: number;
}

export function AuroraGlow({
  className,
  color1 = "rgba(124, 58, 237, 0.12)",
  color2 = "rgba(236, 72, 153, 0.08)",
  color3 = "rgba(59, 130, 246, 0.06)",
  opacity = 1,
}: AuroraGlowProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} style={{ opacity }}>
      <div
        className="absolute -top-1/2 -left-1/4 w-[80%] h-[80%] rounded-full blur-[120px] animate-pulse"
        style={{ background: color1, animationDuration: "8s" }}
      />
      <div
        className="absolute -top-1/4 -right-1/4 w-[60%] h-[60%] rounded-full blur-[100px] animate-pulse"
        style={{ background: color2, animationDuration: "6s", animationDelay: "2s" }}
      />
      <div
        className="absolute top-1/3 left-1/3 w-[50%] h-[50%] rounded-full blur-[80px] animate-pulse"
        style={{ background: color3, animationDuration: "10s", animationDelay: "4s" }}
      />
    </div>
  );
}
