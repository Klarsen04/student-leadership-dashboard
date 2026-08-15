"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useMicro, SOFT_SPRING, SPRING } from "@/components/micro-motion";
import {
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  Menu,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
  NotebookPen,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const primaryNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/reflections", label: "Reflect", icon: BookOpen },
];

const moreNav = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/planner", label: "Planner", icon: NotebookPen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const micro = useMicro();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const moreActive = moreNav.some((item) => pathname === item.href);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around px-2 h-16">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <motion.div
              key={item.href}
              whileTap={micro.reduce ? undefined : { scale: 0.88 }}
              transition={SPRING}
              className="relative flex"
            >
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 py-1 rounded-xl transition-colors",
                  active ? "text-purple-500" : "text-muted-foreground active:text-foreground"
                )}
              >
                <motion.span
                  className="inline-flex"
                  animate={micro.reduce ? undefined : { scale: active ? 1.12 : 1 }}
                  transition={SPRING}
                >
                  <Icon className="w-5 h-5" />
                </motion.span>
                <span className="text-[10px] leading-tight">{item.label}</span>
                <AnimatePresence>
                  {active && (
                    <motion.span
                      initial={micro.reduce ? false : { scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={micro.reduce ? undefined : { scale: 0, opacity: 0 }}
                      transition={SOFT_SPRING}
                      className="absolute bottom-1.5 w-1 h-1 rounded-full bg-purple-400"
                    />
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}

        <div ref={moreRef} className="relative flex flex-col items-center">
          <motion.button
            onClick={() => setMoreOpen(!moreOpen)}
            whileTap={micro.reduce ? undefined : { scale: 0.88 }}
            transition={SPRING}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 py-1 rounded-xl transition-colors",
              moreActive || moreOpen ? "text-purple-500" : "text-muted-foreground active:text-foreground"
            )}
          >
            <motion.span
              className="inline-flex"
              animate={micro.reduce ? undefined : { rotate: moreOpen ? 90 : 0 }}
              transition={SPRING}
            >
              <Menu className="w-5 h-5" />
            </motion.span>
            <span className="text-[10px] leading-tight">More</span>
            <AnimatePresence>
              {moreActive && (
                <motion.span
                  initial={micro.reduce ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={micro.reduce ? undefined : { scale: 0, opacity: 0 }}
                  transition={SOFT_SPRING}
                  className="absolute bottom-1.5 w-1 h-1 rounded-full bg-purple-400"
                />
              )}
            </AnimatePresence>
          </motion.button>

          {moreOpen && (
            <motion.div
              initial={micro.reduce ? false : { opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={SOFT_SPRING}
              className="absolute bottom-full mb-2 right-0 w-48 py-2 rounded-xl bg-card/95 backdrop-blur-xl border border-border shadow-xl shadow-black/20 dark:shadow-black/40">
              {moreNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                      active
                        ? "text-purple-500 bg-purple-500/10"
                        : "text-muted-foreground active:bg-accent"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => {
                  setMoreOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground active:bg-accent w-full transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </nav>
  );
}
