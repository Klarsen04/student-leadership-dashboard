"use client";

import { useEffect, useRef } from "react";

/**
 * Hand-written Canvas 2D "aurora" field: a handful of large, soft radial-gradient
 * blobs that drift on independent sine paths and are composited additively over a
 * near-black base. No WebGL / three.js — just requestAnimationFrame + 2D gradients.
 *
 * - Caps devicePixelRatio for perf.
 * - Cleans up rAF + resize listener on unmount.
 * - When prefers-reduced-motion matches, renders a single static frame and stops.
 */
export function AuroraCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let animationId = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Aurora blobs — deep indigo / violet / teal, plus one accent lime kiss.
    type Blob = {
      hue: [number, number, number]; // rgb
      baseX: number; // 0..1
      baseY: number; // 0..1
      radius: number; // fraction of min(w,h)
      ampX: number;
      ampY: number;
      speed: number;
      phase: number;
      alpha: number;
    };

    const blobs: Blob[] = [
      { hue: [99, 102, 241], baseX: 0.22, baseY: 0.28, radius: 0.75, ampX: 0.08, ampY: 0.06, speed: 0.00013, phase: 0.0, alpha: 0.5 },
      { hue: [139, 92, 246], baseX: 0.78, baseY: 0.18, radius: 0.62, ampX: 0.07, ampY: 0.09, speed: 0.00017, phase: 1.7, alpha: 0.45 },
      { hue: [45, 212, 191], baseX: 0.68, baseY: 0.72, radius: 0.55, ampX: 0.09, ampY: 0.05, speed: 0.00011, phase: 3.1, alpha: 0.32 },
      { hue: [168, 85, 247], baseX: 0.3, baseY: 0.82, radius: 0.5, ampX: 0.06, ampY: 0.07, speed: 0.00019, phase: 4.4, alpha: 0.34 },
      { hue: [190, 242, 100], baseX: 0.52, baseY: 0.44, radius: 0.34, ampX: 0.05, ampY: 0.05, speed: 0.00021, phase: 2.2, alpha: 0.14 },
    ];

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (t: number) => {
      const minDim = Math.min(width, height);

      // Base wash — near black with a faint cool tint.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#05060c";
      ctx.fillRect(0, 0, width, height);

      // Additive aurora blobs.
      ctx.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        const x = (b.baseX + Math.sin(t * b.speed + b.phase) * b.ampX) * width;
        const y =
          (b.baseY + Math.cos(t * b.speed * 0.9 + b.phase) * b.ampY) * height;
        const r = b.radius * minDim;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const [rr, gg, bb] = b.hue;
        g.addColorStop(0, `rgba(${rr}, ${gg}, ${bb}, ${b.alpha})`);
        g.addColorStop(0.55, `rgba(${rr}, ${gg}, ${bb}, ${b.alpha * 0.28})`);
        g.addColorStop(1, `rgba(${rr}, ${gg}, ${bb}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle vignette to sink the edges.
      ctx.globalCompositeOperation = "source-over";
      const vig = ctx.createRadialGradient(
        width / 2,
        height * 0.42,
        minDim * 0.2,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75
      );
      vig.addColorStop(0, "rgba(5, 6, 12, 0)");
      vig.addColorStop(1, "rgba(3, 4, 9, 0.85)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    };

    resize();

    if (reduceMotion) {
      render(6000); // one representative static frame
      return () => {};
    }

    const loop = (t: number) => {
      render(t);
      animationId = requestAnimationFrame(loop);
    };
    animationId = requestAnimationFrame(loop);

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    />
  );
}
