# Homepage Motion Storyboard — "The life of an event"

A scroll-driven, cinematic rebuild of the Leadership OS marketing homepage.
The whole page tells ONE story: *how a scattered idea becomes a real campus
event, a community, a budget, and finally a living dashboard.* The user scrolls
**through** the story; scroll position drives every major timeline (no autoplay).

Aesthetic stays PeacePod-warm: cream `#FFFAF5`, marigold `#FFB400`, grass
`#7FB800`, sky `#5BC0EB`, coral `#FF6B4A`, Fredoka display type, hand-drawn SVG.

Tech: **GSAP + ScrollTrigger** (pin + `scrub`) for the Level-1 scenes, **Lenis**
driving ScrollTrigger for smooth scrub, **Motion** for Level-3 microinteractions.
All scenes respect `prefers-reduced-motion` (render final/static state, no pin).

Three levels of motion:
- **L1 — hero/scene:** 4 pinned cinematic scenes below (the WOW moments).
- **L2 — section:** scene-to-scene transforms, parallax, headline transitions.
- **L3 — micro:** button/press springs, kept minimal so L1 feels big.

---

## SCENE 0 — HERO  (not pinned; ~100vh)
1. **See:** giant sun mascot + "your leadership, a happy little home."
2. **Scroll:** headline scales/parallaxes up slightly; sun drifts; a single
   glowing "idea" spark detaches from the sun and falls — becoming the object
   that seeds Scene 1.
3. **Object:** the sun → the falling spark.
4. **Transform:** spark travels down and lands on the empty board of Scene 1.
5. **Text:** "hi! welcome to / your leadership, a happy little home." → fades.
6. **Learn:** this is warm, personal, and about to show me something.
7. **Transition:** spark hand-off into Scene 1's board.
8. **Tech:** Motion entrance + GSAP scrub for the spark hand-off.

## SCENE 1 — PLAN AN EVENT  (pinned; ~300vh)  ★ hero scene
1. **See:** one large empty rounded "event board" centered, faint.
2. **Scroll (scrubbed timeline):**
   - 0–10%: board scales in, "An empty idea." label.
   - 10–30%: title **"Spring Formal"** flies in from top, snaps into header.
   - 30–45%: a **date chip "Apr 18"** slides in from the left and clicks in.
   - 45–62%: a **location pin travels across the full viewport** from the right
     and drops onto the board → "Grand Hall".
   - 62–82%: **attendee avatars pop in** along the bottom, counter ticks
     **0 → 128 going**.
   - 82–95%: a green **"CONFIRMED" stamp** rotates in, board border → green,
     status **Draft → Live**.
   - 95–100%: finished card **scales down + tilts** and lifts away.
3. **Object:** the event board (fills most of the viewport).
4. **Transform:** empty → fully assembled, confirmed event → shrinks to a token.
5. **Text:** side captions swap: "An empty idea" → "Give it a name" → "Pick a
   time" → "Find a place" → "Gather your people" → "It's official."
6. **Learn:** planning an event in the app is guided and assembles piece by piece.
7. **Transition:** the confirmed event token flies up and bursts into avatars —
   becomes the first member of Scene 2.
8. **Tech:** GSAP timeline, `pin`, `scrub`, `onUpdate` counter.

## SCENE 2 — BUILD YOUR COMMUNITY  (pinned; ~250vh)  ★ hero scene
1. **See:** one avatar alone, center. Caption "It starts with one."
2. **Scroll:** 8+ avatars **fly in from all edges** to scattered seats; **SVG
   connection lines draw** between them (strokeDashoffset) forming a network;
   member counter **1 → 342**; the network gently rotates as a whole.
3. **Object:** the growing people-network (viewport-scale).
4. **Transform:** lone node → dense connected community graph → clusters into
   one warm "community" disc.
5. **Text:** "It starts with one." → "…then a few show up." → "…and a whole
   community grows."
6. **Learn:** the app turns individuals into a connected community.
7. **Transition:** community disc collapses into a coin/$600 that drops into Scene 3.
8. **Tech:** GSAP timeline pin+scrub; SVG line draw; staggered node tweens.

## SCENE 3 — EVERY DOLLAR HAS A HOME  (pinned; ~250vh)  ★ hero scene
1. **See:** a huge **"$600"** budget number, centered.
2. **Scroll:** the number lifts; **four category bars grow from 0** (Food,
   Decor, Vendors, Supplies) with per-category $ counting up; a **"remaining"**
   figure counts **$600 → $0** as bars fill; bars then **snap together into one
   stacked allocation bar**.
3. **Object:** the budget (number → bars → unified allocation bar).
4. **Transform:** a single scary number becomes a calm, fully-allocated plan.
5. **Text:** "$600 to work with." → "Split it with intention." → "Every dollar
   accounted for."
6. **Learn:** budgeting in the app is visual and reassuring.
7. **Transition:** the allocation bar tilts into 3D and becomes one panel of the
   assembling dashboard in Scene 4.
8. **Tech:** GSAP timeline pin+scrub; width tweens; `onUpdate` counters.

## SCENE 4 — IT ALL COMES TOGETHER  (pinned; ~250vh)  ★ hero scene — payoff
1. **See:** empty cream stage with a faint device frame outline.
2. **Scroll:** dashboard **panels fly in from off-screen edges** — calendar grid
   (top-left), task list (left), area chart (right), stat tiles (bottom) — and
   **assemble into a live dashboard** inside the frame; a cursor/among small
   details animate; finally the frame settles and glows.
3. **Object:** the whole dashboard UI assembling itself.
4. **Transform:** scattered panels → one coherent product screen.
5. **Text:** "Events. People. Budgets." → "All in one calm home."
6. **Learn:** everything from Scenes 1–3 lives together in the real product.
7. **Transition:** dashboard scales down and releases pin into the CTA.
8. **Tech:** GSAP timeline pin+scrub; edge-entry tweens; parallax depth.

## SCENE 5 — CTA  (not pinned)
1. **See:** warm CTA card + mascot.
2. **Scroll:** gentle reveal; button breathes.
3–7. Standard conversion close ("Ready to grow, one day at a time?").
8. **Tech:** Motion reveal + spring button.

---

### Mobile strategy
Pinned scenes keep the SAME narrative but simplify choreography: horizontal
travels become vertical/scale; fewer avatars/particles; shorter pin distances
(≈150–200vh). Never disabled — the story is preserved.

### Reduced motion
Each scene renders its FINAL composed state statically (no pin, no scrub) so the
message still lands without movement.
