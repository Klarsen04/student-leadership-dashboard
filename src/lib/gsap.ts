"use client";

// Central GSAP setup. Registers ScrollTrigger + useGSAP once, browser-only.
// Import { gsap, ScrollTrigger, useGSAP } from here so plugins are always
// registered before use. Per GSAP React guidance: register useGSAP, keep all
// calls client-side, always scope + auto-revert.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

export { gsap, ScrollTrigger, useGSAP };
