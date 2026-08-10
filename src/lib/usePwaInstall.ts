"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Shared PWA install state, used by both the floating InstallPrompt and the
 * dedicated /download page.
 *
 * Platforms differ:
 *  - Android / desktop Chromium fire `beforeinstallprompt`; we capture it and
 *    can trigger the native install dialog on demand (`promptInstall`).
 *  - iOS Safari has NO install API — install is a manual Share → Add to Home
 *    Screen, so `platform` reports "ios" and the UI shows instructions.
 */

export type InstallPlatform = "android" | "ios" | "desktop" | "unknown";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "unknown";
  const ua = window.navigator.userAgent.toLowerCase();
  const iDevice = /iphone|ipad|ipod/.test(ua);
  const iPadOs = ua.includes("macintosh") && navigator.maxTouchPoints > 1;
  if (iDevice || iPadOs) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function computeStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePwaInstall() {
  const [platform, setPlatform] = useState<InstallPlatform>("unknown");
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsStandalone(computeStandalone());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferred) return "unavailable";
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return {
    platform,
    isStandalone: isStandalone || installed,
    /** true when the native install dialog can be triggered (Android/desktop Chromium) */
    canPromptInstall: deferred !== null,
    promptInstall,
  };
}
