"use client";

import { useCallback } from "react";
import confetti from "canvas-confetti";

export function useConfetti() {
  const fire = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const colors = ["#8b5cf6", "#3b82f6", "#a855f7", "#6366f1", "#06b6d4"];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const burst = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#8b5cf6", "#3b82f6", "#a855f7", "#6366f1"],
    });
  }, []);

  return { fire, burst };
}
