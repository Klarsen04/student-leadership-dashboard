"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Share,
  SquarePlus,
  Check,
  Wifi,
  Bell,
  Sparkles,
  Monitor,
} from "lucide-react";
import { SeedMascot } from "@/components/reflections/PeaceDecor";
import { usePwaInstall } from "@/lib/usePwaInstall";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

const PERKS = [
  { icon: Sparkles, label: "Full-screen app", desc: "No browser bars — just your pod." },
  { icon: Wifi, label: "Loads instantly", desc: "One tap from your home screen." },
  { icon: Bell, label: "Stays with you", desc: "Right next to your other apps." },
];

export default function DownloadPage() {
  const { platform, isStandalone, canPromptInstall, promptInstall } = usePwaInstall();

  return (
    <div className="peace-surface font-marker relative min-h-screen overflow-x-hidden">
      {/* header */}
      <header className="relative z-10 px-5 md:px-8 py-4 max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-black/60 hover:text-black transition-colors"
          style={MARKER}
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>
      </header>

      <main className="relative z-10 px-5 md:px-8 pb-24 max-w-3xl mx-auto">
        {/* hero */}
        <div className="text-center pt-6 md:pt-10">
          <SeedMascot className="w-20 h-20 mx-auto mb-5 animate-soft-bob" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={MARKER}>
            Get the app
          </h1>
          <p className="mt-4 text-lg text-black/60 max-w-lg mx-auto leading-relaxed">
            Add Student Leadership to your home screen for a full-screen app —
            <span className="font-semibold text-black/75"> free, no app store, no download.</span>
          </p>
        </div>

        {/* perks */}
        <ul className="mt-10 grid gap-3 sm:grid-cols-3">
          {PERKS.map((p) => (
            <li
              key={p.label}
              className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 text-center"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#FFB400]/15 text-[#B87400] mb-2">
                <p.icon className="h-5 w-5" />
              </span>
              <p className="text-[15px] font-semibold text-black/85" style={MARKER}>
                {p.label}
              </p>
              <p className="mt-0.5 text-[13px] text-black/55 leading-snug">{p.desc}</p>
            </li>
          ))}
        </ul>

        {/* install card — platform aware */}
        <div className="mt-10 rounded-[1.75rem] bg-white border border-black/5 shadow-sm p-6 md:p-8">
          {isStandalone ? (
            <AlreadyInstalled />
          ) : platform === "ios" ? (
            <IosInstructions />
          ) : platform === "android" || platform === "desktop" ? (
            <PromptInstall
              platform={platform}
              canPrompt={canPromptInstall}
              onInstall={promptInstall}
            />
          ) : (
            // SSR / pre-hydration fallback: show iOS-style manual steps, the
            // most universal instruction, until platform is detected.
            <IosInstructions />
          )}
        </div>

        <p className="mt-6 text-center text-sm text-black/45">
          Prefer the browser?{" "}
          <Link href="/login" className="font-semibold text-black/70 underline underline-offset-2 hover:text-black">
            Just sign in here
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

function AlreadyInstalled() {
  return (
    <div className="text-center py-2">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#7FB800]/15 text-[#5C8600] mb-3">
        <Check className="h-7 w-7" />
      </span>
      <h2 className="text-2xl font-bold" style={MARKER}>
        You&apos;re all set 🌱
      </h2>
      <p className="mt-2 text-black/60 max-w-sm mx-auto">
        You&apos;re already running the installed app. Nothing more to do — enjoy!
      </p>
    </div>
  );
}

function PromptInstall({
  platform,
  canPrompt,
  onInstall,
}: {
  platform: "android" | "desktop";
  canPrompt: boolean;
  onInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}) {
  return (
    <div className="text-center">
      <h2 className="text-2xl font-bold" style={MARKER}>
        {platform === "android" ? "Install on Android" : "Install on your computer"}
      </h2>
      {canPrompt ? (
        <>
          <p className="mt-2 text-black/60 max-w-sm mx-auto">
            Tap install and confirm — it&apos;ll land right on your{" "}
            {platform === "android" ? "home screen" : "desktop / dock"}.
          </p>
          <button
            type="button"
            onClick={() => void onInstall()}
            className="mt-6 inline-flex items-center justify-center gap-2 min-h-[48px] px-8 py-3 rounded-full bg-[#FFB400] text-black font-semibold shadow-md transition-transform active:scale-[0.98] hover:brightness-105"
          >
            <Download className="h-5 w-5" /> Install app
          </button>
        </>
      ) : (
        // beforeinstallprompt hasn't fired (already dismissed, unsupported
        // browser, or criteria unmet) — give the manual menu path.
        <div className="mt-4 text-left max-w-sm mx-auto space-y-2.5 text-[14px] text-black/70">
          <p className="text-black/60">
            Open your browser menu and choose{" "}
            <span className="font-semibold text-black/80">
              {platform === "android" ? "“Install app” / “Add to Home screen”" : "“Install Student Leadership”"}
            </span>
            .
          </p>
          <p className="flex items-center gap-2 text-black/55">
            <Monitor className="h-4 w-4 shrink-0" />
            In Chrome / Edge, look for the install icon in the address bar.
          </p>
        </div>
      )}
    </div>
  );
}

function IosInstructions() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-center" style={MARKER}>
        Install on iPhone &amp; iPad
      </h2>
      <p className="mt-2 text-black/60 text-center max-w-sm mx-auto">
        In <span className="font-semibold text-black/80">Safari</span>, add it to your
        home screen in two taps:
      </p>
      <ol className="mt-6 space-y-3 max-w-sm mx-auto">
        <li className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFB400]/15 text-[#B87400]">
            <Share className="h-4 w-4" />
          </span>
          <span className="text-[15px] text-black/75">
            Tap the <span className="font-semibold">Share</span> button
            <span className="text-black/45"> (the square with an arrow)</span>
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7FB800]/15 text-[#5C8600]">
            <SquarePlus className="h-4 w-4" />
          </span>
          <span className="text-[15px] text-black/75">
            Choose <span className="font-semibold">Add to Home Screen</span>
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5BC0EB]/20 text-[#2792c0]">
            <Check className="h-4 w-4" />
          </span>
          <span className="text-[15px] text-black/75">
            Tap <span className="font-semibold">Add</span> — done! 🌱
          </span>
        </li>
      </ol>
    </div>
  );
}
