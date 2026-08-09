"use client";

import { useEffect, useState } from "react";
import { X, Share, SquarePlus, Download } from "lucide-react";

/**
 * "Add to Home Screen" prompt for installing the app as a PWA.
 *
 * Two paths, because the platforms differ:
 *  - Android / desktop Chromium: the browser fires `beforeinstallprompt`; we
 *    capture it and drive the native install dialog from our own button.
 *  - iOS Safari: there is NO install API — installing is a manual Share →
 *    "Add to Home Screen". So we show a branded instructional card instead.
 *
 * The prompt is dismissable and remembers the choice (localStorage), and never
 * shows when the app is already installed (running in standalone display mode).
 */

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 30;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag when launched from home screen
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const iDevice = /iphone|ipad|ipod/.test(ua);
  // iPadOS 13+ reports as Mac; detect via touch points
  const iPadOs = ua.includes("macintosh") && navigator.maxTouchPoints > 1;
  return iDevice || iPadOs;
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    // Android / desktop: capture the install event and reveal our button.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // If the app gets installed, hide immediately.
    const onInstalled = () => {
      setVisible(false);
      dismiss(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS never fires beforeinstallprompt — show the manual hint after a beat
    // so it doesn't compete with first paint.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      iosTimer = setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss(remember = true) {
    setVisible(false);
    if (remember) {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* storage blocked — dismissal just won't persist */
      }
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Student Leadership"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl border border-black/5 bg-[#FFFAF5] p-4 shadow-[0_10px_40px_rgba(255,180,0,0.18)] md:inset-x-auto md:right-4 md:left-auto md:w-[24rem]"
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
      }}
    >
      <button
        type="button"
        onClick={() => dismiss(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full p-1 text-black/40 transition-colors hover:bg-black/5 hover:text-black/70"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-xl"
        />
        <div className="min-w-0">
          <p
            className="text-[15px] font-semibold text-black/90"
            style={{ fontFamily: "var(--font-fredoka), system-ui, sans-serif" }}
          >
            Add to your home screen
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-black/55">
            Get a full-screen app with a tap — no app store, no download.
          </p>
        </div>
      </div>

      {iosHint ? (
        <ol className="mt-3 space-y-1.5 text-[13px] text-black/70">
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFB400]/15 text-[#B87400]">
              <Share className="h-3.5 w-3.5" />
            </span>
            Tap the <span className="font-medium">Share</span> button in Safari
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7FB800]/15 text-[#5C8600]">
              <SquarePlus className="h-3.5 w-3.5" />
            </span>
            Choose <span className="font-medium">Add to Home Screen</span>
          </li>
        </ol>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={install}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FFB400] px-4 py-2.5 text-[14px] font-semibold text-black/85 transition-transform active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            Install
          </button>
          <button
            type="button"
            onClick={() => dismiss(true)}
            className="rounded-xl px-3 py-2.5 text-[14px] font-medium text-black/50 transition-colors hover:bg-black/5"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );
}
