import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-purple-500/30 bg-purple-500/10 text-purple-300",
        secondary: "border-white/[0.1] bg-white/[0.05] text-muted-foreground",
        destructive: "border-rose-500/30 bg-rose-500/10 text-rose-400",
        outline: "border-white/[0.12] text-foreground",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        info: "border-blue-500/30 bg-blue-500/10 text-blue-400",
        purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
        orange: "border-orange-500/30 bg-orange-500/10 text-orange-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
