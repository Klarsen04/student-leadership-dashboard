"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { InstallPrompt } from "@/components/InstallPrompt";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="min-h-screen flex bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 overflow-auto md:ml-0 ml-0 pt-16 md:pt-8">
        {children}
      </main>
      <InstallPrompt />
    </div>
  );
}
