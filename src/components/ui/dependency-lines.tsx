"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DependencyConnection {
  fromId: string;
  toId: string;
  fromPosition: { x: number; y: number };
  toPosition: { x: number; y: number };
}

interface DependencyLinesProps {
  connections: DependencyConnection[];
  className?: string;
}

export function DependencyLines({ connections, className }: DependencyLinesProps) {
  if (connections.length === 0) return null;

  return (
    <svg
      className={cn(
        "absolute inset-0 w-full h-full pointer-events-none z-10",
        className
      )}
      style={{ overflow: "visible" }}
    >
      <defs>
        <marker
          id="dependency-arrow"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,6 L8,3 Z"
            fill="rgba(168, 85, 247, 0.8)"
          />
        </marker>
        <filter id="dependency-glow">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation="3"
            floodColor="rgba(168, 85, 247, 0.5)"
          />
        </filter>
      </defs>

      {connections.map((connection) => {
        const { fromPosition, toPosition } = connection;
        const key = `${connection.fromId}-${connection.toId}`;

        const dx = toPosition.x - fromPosition.x;
        const dy = toPosition.y - fromPosition.y;

        // Control points for cubic bezier: exit right, then curve to target
        const cp1x = fromPosition.x + Math.min(Math.abs(dx) * 0.4, 30);
        const cp1y = fromPosition.y;
        const cp2x = toPosition.x - Math.min(Math.abs(dx) * 0.4, 30);
        const cp2y = toPosition.y;

        const d = `M ${fromPosition.x},${fromPosition.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${toPosition.x},${toPosition.y}`;

        return (
          <g key={key} filter="url(#dependency-glow)">
            <motion.path
              d={d}
              fill="none"
              stroke="rgba(168, 85, 247, 0.6)"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd="url(#dependency-arrow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                pathLength: { duration: 0.8, ease: "easeInOut" },
                opacity: { duration: 0.3 },
              }}
              style={{
                strokeDasharray: "6 4",
              }}
              className="animate-dependency-flow"
            />
          </g>
        );
      })}

      <style>{`
        @keyframes dependency-flow {
          from {
            stroke-dashoffset: 20;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .animate-dependency-flow {
          animation: dependency-flow 1s linear infinite;
        }
      `}</style>
    </svg>
  );
}
