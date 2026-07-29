"use client";

import { useEffect, useRef, useCallback } from "react";

interface ClickSparkProps {
  children: React.ReactNode;
  sparkColor?: string;
  sparkSize?: number;
  sparkCount?: number;
  duration?: number;
}

export function ClickSpark({
  children,
  sparkColor = "#a855f7",
  sparkSize = 10,
  sparkCount = 8,
  duration = 400,
}: ClickSparkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const createSpark = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const cx = x - rect.left;
    const cy = y - rect.top;

    const sparks: { x: number; y: number; vx: number; vy: number; life: number; size: number }[] = [];
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 3;
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: sparkSize * (0.5 + Math.random() * 0.5),
      });
    }

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparks.forEach((spark) => {
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.1;
        spark.life = 1 - progress;

        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size * spark.life, 0, Math.PI * 2);
        ctx.fillStyle = sparkColor + Math.round(spark.life * 255).toString(16).padStart(2, "0");
        ctx.fill();
      });

      if (progress < 1) requestAnimationFrame(animate);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    requestAnimationFrame(animate);
  }, [sparkColor, sparkSize, sparkCount, duration]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleClick = (e: MouseEvent) => createSpark(e.clientX, e.clientY);
    container.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("resize", resize);
      container.removeEventListener("click", handleClick);
    };
  }, [createSpark]);

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-50"
      />
      {children}
    </div>
  );
}
