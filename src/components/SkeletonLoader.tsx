"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-white/[0.06]",
        className
      )}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-center">
        <Skeleton className="h-10 w-80 rounded-full" />
      </div>
      <div className="text-center space-y-2">
        <Skeleton className="h-9 w-40 mx-auto" />
        <Skeleton className="h-5 w-24 mx-auto" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
