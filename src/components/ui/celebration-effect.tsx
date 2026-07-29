"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CelebrationEffectProps {
  trigger: boolean;
  onComplete?: () => void;
  type?: "confetti" | "stars" | "sparkle";
}

export function CelebrationEffect({ trigger, onComplete, type = "confetti" }: CelebrationEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const runConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#a855f7", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
    const particles: {
      x: number; y: number; vx: number; vy: number;
      color: string; size: number; rotation: number; rotSpeed: number;
      life: number; shape: "rect" | "circle";
    }[] = [];

    const count = type === "confetti" ? 80 : type === "stars" ? 40 : 60;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 15 - 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        life: 1,
        shape: Math.random() > 0.5 ? "rect" : "circle",
      });
    }

    const startTime = performance.now();
    const duration = 2000;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = elapsed / duration;

      if (progress >= 1) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onComplete?.();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.vx *= 0.99;
        p.rotation += p.rotSpeed;
        p.life = 1 - progress;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
  }, [type, onComplete]);

  useEffect(() => {
    if (trigger) {
      runConfetti();
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [trigger, runConfetti]);

  return (
    <AnimatePresence>
      {trigger && (
        <motion.canvas
          ref={canvasRef}
          className="pointer-events-none fixed inset-0 z-[999]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
    </AnimatePresence>
  );
}
