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
  /** The default trio shown if no wider bank is set. */
  questions: string[];
  /** A wider pool the reflection flow rotates through so each entry feels fresh
   *  (reused once cycled). Falls back to `questions` when unset. */
  questionBank?: string[];
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
    questionBank: [
      "What went well today?",
      "What challenged you, and how did you respond?",
      "What is one thing you're grateful for right now?",
      "What is one small win you almost overlooked?",
      "What drained your energy today, and what restored it?",
      "What did today teach you about yourself?",
      "What are you looking forward to tomorrow?",
      "When did you feel most like yourself today?",
      "What would make tomorrow 1% better?",
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
    questionBank: [
      "Who did you invest in today, and how did it feel?",
      "Was there a moment you felt truly understood, or misunderstood?",
      "How can you show up for someone tomorrow?",
      "Who made your day a little brighter, and did you tell them?",
      "Is there a relationship that needs your attention right now?",
      "Where did you set (or wish you'd set) a boundary?",
      "Who do you want to reach out to that you've been putting off?",
      "When did you feel most connected to someone today?",
      "What kind of friend do you want to be this week?",
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
    questionBank: [
      "What is something you did today that you're proud of?",
      "What did you say to yourself when things got hard?",
      "If a friend had your day, what would you tell them?",
      "Where were you too hard on yourself today?",
      "What's a strength you used today, even briefly?",
      "What does 'good enough' look like for you right now?",
      "What pressure are you carrying that isn't really yours?",
      "How did you handle a mistake today?",
      "What would self-compassion sound like for you tonight?",
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
    questionBank: [
      "What feels stuck or stagnant right now?",
      "What is one small step you could take, even a tiny one?",
      "What would 'unstuck' actually look like for you?",
      "What are you avoiding, and what's underneath the avoidance?",
      "If you couldn't fail, what would you try first?",
      "What's one thing you can control here, and one you can't?",
      "Who could you ask for help, and what would you ask?",
      "What worked last time you felt this way?",
      "What's the smallest version of 'done' you'd accept today?",
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
    questionBank: [
      "Did your time this week reflect your priorities?",
      "What went well, and what could be better next week?",
      "What are your top priorities for next week?",
      "What are you most proud of from this week?",
      "What drained you this week that you can reduce next week?",
      "What did you learn this week that you want to carry forward?",
      "Where did you spend time that didn't matter much?",
      "What relationship or commitment needs more of you next week?",
      "What is one habit you want to protect next week?",
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
    questionBank: [
      "What are your biggest accomplishments this month?",
      "Where did you grow, and where do you still want to grow?",
      "What do you most want to focus on next month?",
      "What surprised you about yourself this month?",
      "What is a challenge that made you stronger?",
      "What did you say yes to that you're glad you did?",
      "What would you like to let go of heading into next month?",
      "How did you move toward your bigger goals this month?",
      "What does the next month need to look like to feel good?",
    ],
  },
];

export function getPod(id: string | null | undefined): Pod | undefined {
  if (!id) return undefined;
  return PODS.find((p) => p.id === id);
}

/**
 * Pick the next `count` questions for a pod, rotating through its wider
 * `questionBank` by `offset` (e.g. how many times the pod has been done) so
 * repeat visits get a fresh set, cycling back to reused ones once exhausted.
 */
export function pickQuestions(pod: Pod, offset: number, count = 3): string[] {
  const bank = pod.questionBank && pod.questionBank.length >= count ? pod.questionBank : pod.questions;
  if (bank.length <= count) return bank.slice(0, count);
  const start = ((offset % Math.ceil(bank.length / count)) * count) % bank.length;
  return Array.from({ length: count }, (_, i) => bank[(start + i) % bank.length]);
}
