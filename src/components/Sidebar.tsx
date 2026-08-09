"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useMicro, SOFT_SPRING, SPRING } from "@/components/micro-motion";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  BookOpen,
  BarChart3,
  LogOut,
  Menu,
  X,
  Settings,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/Notifications";
import { ThemeToggle } from "@/components/ThemeToggle";

const nav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/reflections", label: "Reflections", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const micro = useMicro();

  return (
    <>
      {/* Mobile toggle - hidden, replaced by BottomNav */}
      <button
        onClick={() => setMobileOpen(true)}
        className="hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay - hidden on mobile, BottomNav replaces mobile navigation */}
      {mobileOpen && (
        <div
          className="hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed md:sticky top-0 left-0 h-screen w-[260px] flex flex-col z-50 transition-transform md:translate-x-0",
          "bg-background border-r border-border",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight">Leadership OS</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <motion.div
                key={item.href}
                whileHover={micro.reduce ? undefined : { x: 3 }}
                whileTap={micro.reduce ? undefined : { scale: 0.98 }}
                transition={SPRING}
                className="relative"
              >
                {active && !micro.reduce && (
                  <motion.span
                    layoutId="sidebar-active-indicator"
                    transition={SOFT_SPRING}
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-purple-400"
                  />
                )}
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "nav-item group",
                    active ? "nav-item-active" : "nav-item-inactive"
                  )}
                >
                  <motion.span
                    className="inline-flex"
                    whileHover={micro.reduce ? undefined : { scale: 1.15, rotate: -6 }}
                    transition={SPRING}
                  >
                    <Icon className={cn("w-[18px] h-[18px]", active && "text-purple-400")} />
                  </motion.span>
                  {item.label}
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/30 flex items-center justify-center text-purple-300 text-xs font-semibold">
              {session?.user?.name?.[0] || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">
                {session?.user?.name || "User"}
              </span>
              <span className="text-[11px] text-muted-foreground truncate block">
                {session?.user?.email || ""}
              </span>
            </div>
          </div>
          <motion.button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="nav-item nav-item-inactive w-full"
            whileHover={micro.reduce ? undefined : { x: 3 }}
            whileTap={micro.reduce ? undefined : { scale: 0.98 }}
            transition={SPRING}
          >
            <motion.span
              className="inline-flex"
              whileHover={micro.reduce ? undefined : { scale: 1.15, rotate: -6 }}
              transition={SPRING}
            >
              <LogOut className="w-[18px] h-[18px]" />
            </motion.span>
            Sign out
          </motion.button>
        </div>
      </aside>
    </>
  );
}
