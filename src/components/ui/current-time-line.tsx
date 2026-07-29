"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface CurrentTimeLineProps {
  startHour: number;
  hourHeight: number;
  dayCount: number;
  isToday: boolean;
}

export function CurrentTimeLine({ startHour, hourHeight, isToday, dayCount }: CurrentTimeLineProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!isToday) return null;

  const hours = now.getHours() + now.getMinutes() / 60;
  const top = (hours - startHour) * hourHeight;

  if (top < 0 || top > (23 - startHour) * hourHeight) return null;

  return (
    <motion.div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{ top }}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shadow-sm shadow-red-500/50" />
        <div className="flex-1 h-[2px] bg-red-500/70" style={{
          background: "linear-gradient(90deg, #ef4444 0%, #ef444480 50%, #ef444430 100%)"
        }} />
      </div>
    </motion.div>
  );
}
