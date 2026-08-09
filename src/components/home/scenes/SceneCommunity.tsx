"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import { gsap, useGSAP } from "@/lib/gsap";

const MARKER = { fontFamily: "var(--font-fredoka), ui-rounded, system-ui, sans-serif" } as const;

// node layout in a 600x600 viewBox — first node is the "lone" center node
const NODES = [
  { x: 300, y: 300, c: "#7FB800", r: 26 }, // center (starts alone)
  { x: 150, y: 170, c: "#FFB400", r: 20 },
  { x: 470, y: 160, c: "#5BC0EB", r: 20 },
  { x: 110, y: 420, c: "#FF6B4A", r: 18 },
  { x: 500, y: 420, c: "#B084F5", r: 18 },
  { x: 300, y: 110, c: "#5BC0EB", r: 16 },
  { x: 300, y: 500, c: "#FFB400", r: 16 },
  { x: 180, y: 300, c: "#FF6B4A", r: 14 },
  { x: 430, y: 300, c: "#7FB800", r: 14 },
];
// connections (index pairs) forming the network
const LINKS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 7], [0, 8],
  [1, 5], [2, 5], [3, 6], [4, 6], [1, 7], [2, 8],
];

const CAPTIONS = ["It starts with one.", "…then a few show up.", "…and a whole community grows."];

/**
 * SCENE 2 — Build your community. Pinned, scrubbed. One node sits alone, then
 * eight members fly in from the edges, SVG links draw between them into a
 * network, a member counter climbs 1 -> 342, and the whole graph gently
 * rotates then clusters toward center.
 */
export function SceneCommunity() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const countRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (reduce) return;
      const q = gsap.utils.selector(root);

      // members (all but node 0) start flung outward
      NODES.forEach((n, i) => {
        if (i === 0) return;
        const dx = (n.x - 300) * 3;
        const dy = (n.y - 300) * 3;
        gsap.set(q(`.cm-node[data-i="${i}"]`), { x: dx, y: dy, scale: 0, opacity: 0 });
      });
      q(".cm-link").forEach((el) => {
        const line = el as unknown as SVGLineElement;
        const len = line.getTotalLength?.() ?? 700;
        gsap.set(el, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 });
      });
      gsap.set(q(".cm-caption"), { opacity: 0, y: 14 });

      const counter = { v: 1 };
      const setCount = () => {
        if (countRef.current) countRef.current.textContent = String(Math.round(counter.v));
      };

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: "top top",
          end: "+=2400",
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      });

      const cap = (i: number) => {
        tl.to(q(`.cm-caption[data-i="${i}"]`), { opacity: 1, y: 0, duration: 0.4 });
        tl.to({}, { duration: 0.3 });
        tl.to(q(`.cm-caption[data-i="${i}"]`), { opacity: 0, y: -12, duration: 0.3 });
      };

      // 0 — lone node pulses
      tl.from(q('.cm-node[data-i="0"]'), { scale: 0, opacity: 0, duration: 0.6, ease: "back.out(2)" });
      cap(0);

      // 1 — members fly in from edges
      tl.to(q(".cm-node:not([data-i='0'])"), {
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 1.1,
        ease: "power3.out",
        stagger: 0.09,
      });
      // links draw + counter climbs alongside
      tl.to(q(".cm-link"), { opacity: 1, strokeDashoffset: 0, duration: 1, ease: "power1.inOut", stagger: 0.05 }, "<0.2");
      tl.to(counter, { v: 342, duration: 1.4, ease: "power1.out", onUpdate: setCount }, "<");
      cap(1);

      // 2 — whole graph breathes/rotates, then clusters slightly inward
      tl.to(q(".cm-graph"), { rotate: 8, duration: 1, ease: "sine.inOut", transformOrigin: "50% 50%" });
      tl.to(q(".cm-node:not([data-i='0'])"), { scale: 0.82, duration: 0.7, ease: "power2.inOut" }, "<");
      cap(2);
    },
    { scope: root, dependencies: [reduce] }
  );

  return (
    <section
      ref={root}
      className="scene-community relative h-screen w-full flex items-center justify-center overflow-hidden"
      aria-label="Build your community"
    >
      <div className="pointer-events-none absolute top-[14%] left-0 right-0 text-center px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/40">Build your community</p>
        <div className="relative h-10 mt-2">
          {CAPTIONS.map((c, i) => (
            <p
              key={i}
              data-i={i}
              className="cm-caption absolute inset-x-0 text-2xl md:text-3xl font-bold text-black"
              style={MARKER}
            >
              {c}
            </p>
          ))}
        </div>
      </div>

      <div className="relative w-[92vw] max-w-[560px] aspect-square">
        <svg viewBox="0 0 600 600" className="cm-graph w-full h-full overflow-visible" aria-hidden="true">
          {LINKS.map(([a, b], i) => (
            <line
              key={i}
              className="cm-link"
              x1={NODES[a].x}
              y1={NODES[a].y}
              x2={NODES[b].x}
              y2={NODES[b].y}
              stroke="#7FB800"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.5"
            />
          ))}
          {NODES.map((n, i) => (
            <g key={i} className="cm-node" data-i={i}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} />
              <circle cx={n.x} cy={n.y - n.r * 0.28} r={n.r * 0.42} fill="rgba(255,255,255,0.85)" />
              <ellipse cx={n.x} cy={n.y + n.r * 0.55} rx={n.r * 0.72} ry={n.r * 0.5} fill="rgba(255,255,255,0.85)" />
            </g>
          ))}
        </svg>

        {/* member counter badge */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white rounded-full shadow-md border border-black/5 px-5 py-2">
          <span className="text-sm text-black/60">
            <span ref={countRef} className="text-xl font-bold text-black" style={MARKER}>
              342
            </span>{" "}
            members
          </span>
        </div>
      </div>
    </section>
  );
}
