"use client";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

export function PriorityDot({ priority }: { priority: string }) {
  return (
    <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium}`} />
  );
}

export { PRIORITY_COLORS };
