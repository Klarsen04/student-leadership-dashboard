const MORNING_PROMPTS = [
  "What's the one thing that would make today a success?",
  "What's been on your mind that you haven't addressed yet?",
  "Who could use your encouragement today?",
  "What's one leadership skill you want to practice today?",
];

const EVENING_PROMPTS = [
  "What moment today are you most proud of?",
  "What did you learn about yourself as a leader today?",
  "What conversation had the most impact today?",
  "If you could redo one decision from today, what would it be?",
];

const WEEKLY_PROMPTS = [
  "Did your time this week reflect your priorities?",
  "What relationship did you invest in most this week?",
  "What's one thing you'd do differently next week?",
  "What progress are you most proud of?",
];

const STREAK_PROMPTS = [
  "You're on a streak! What's keeping you consistent?",
  "Your consistency is building something. What patterns do you notice?",
  "Momentum matters. What small win can you celebrate right now?",
];

const LOW_ENERGY_PROMPTS = [
  "Your energy has been lower lately. What's draining you?",
  "What's one boundary you could set to protect your energy?",
  "When do you feel most alive? How can you get more of that?",
];


export interface PromptContext {
  hour: number;
  taskStreak: number;
  reflectionStreak: number;
  recentMood: number | null;
  recentEnergy: number | null;
  tasksCompleted: number;
  dayOfWeek: number;
}

export function generatePrompts(ctx: PromptContext): string[] {
  const prompts: string[] = [];

  if (ctx.dayOfWeek === 0 || ctx.dayOfWeek === 5) {
    prompts.push(...pickRandom(WEEKLY_PROMPTS, 2));
  } else if (ctx.hour < 12) {
    prompts.push(...pickRandom(MORNING_PROMPTS, 2));
  } else {
    prompts.push(...pickRandom(EVENING_PROMPTS, 2));
  }

  if (ctx.reflectionStreak >= 3 || ctx.taskStreak >= 3) {
    prompts.push(pickRandom(STREAK_PROMPTS, 1)[0]);
  }

  if (ctx.recentEnergy !== null && ctx.recentEnergy <= 4) {
    prompts.push(pickRandom(LOW_ENERGY_PROMPTS, 1)[0]);
  }

  return prompts.slice(0, 4);
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
