// Themed reflection "pods" — curated question packs modeled on PeacePod's pods.
// Each pod maps to a reflection `type` (daily/weekly/monthly) so the existing
// one-per-period logic and history grouping keep working unchanged.

export type ReflectionType = "daily" | "weekly" | "monthly";

export interface Pod {
  id: string;
  title: string;
  tagline: string;
  type: ReflectionType;
  emoji: string;
  /** tailwind gradient classes for the pod card */
  accent: string;
  questions: string[];
}

export const PODS: Pod[] = [
  {
    id: "essentials",
    title: "The Essentials",
    tagline: "Three gentle questions to start your day.",
    type: "daily",
    emoji: "🌱",
    accent: "from-amber-300 to-orange-300",
    questions: [
      "What went well today?",
      "What challenged you, and how did you respond?",
      "What is one thing you're grateful for right now?",
    ],
  },
  {
    id: "friends",
    title: "Friends",
    tagline: "Untangle how you connect with the people around you.",
    type: "daily",
    emoji: "💛",
    accent: "from-rose-300 to-amber-300",
    questions: [
      "Who did you invest in today, and how did it feel?",
      "Was there a moment you felt truly understood, or misunderstood?",
      "How can you show up for someone tomorrow?",
    ],
  },
  {
    id: "self-esteem",
    title: "Self-esteem & School",
    tagline: "Notice how you talk to yourself under pressure.",
    type: "daily",
    emoji: "⭐",
    accent: "from-sky-300 to-emerald-300",
    questions: [
      "What is something you did today that you're proud of?",
      "What did you say to yourself when things got hard?",
      "If a friend had your day, what would you tell them?",
    ],
  },
  {
    id: "getting-unstuck",
    title: "Getting Unstuck",
    tagline: "For the days that feel heavy or stuck.",
    type: "daily",
    emoji: "🧭",
    accent: "from-violet-300 to-sky-300",
    questions: [
      "What feels stuck or stagnant right now?",
      "What is one small step you could take, even a tiny one?",
      "What would 'unstuck' actually look like for you?",
    ],
  },
  {
    id: "week-review",
    title: "Weekly Review",
    tagline: "Zoom out and look back on your week.",
    type: "weekly",
    emoji: "📆",
    accent: "from-amber-300 to-lime-300",
    questions: [
      "Did your time this week reflect your priorities?",
      "What went well, and what could be better next week?",
      "What are your top priorities for next week?",
    ],
  },
  {
    id: "month-review",
    title: "Reflecting on the Month",
    tagline: "A monthly check-in on growth and direction.",
    type: "monthly",
    emoji: "🌙",
    accent: "from-indigo-300 to-purple-300",
    questions: [
      "What are your biggest accomplishments this month?",
      "Where did you grow, and where do you still want to grow?",
      "What do you most want to focus on next month?",
    ],
  },
];

export function getPod(id: string | null | undefined): Pod | undefined {
  if (!id) return undefined;
  return PODS.find((p) => p.id === id);
}
