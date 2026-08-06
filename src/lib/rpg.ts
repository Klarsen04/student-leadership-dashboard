// RPG stat engine for the gamified goals system (Habitica-inspired, original implementation).
// Pure functions so the rules are easy to reason about and test.

export type Difficulty = "trivial" | "easy" | "medium" | "hard";

// XP/gold/HP weights per difficulty.
const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  trivial: 0.5,
  easy: 1,
  medium: 1.5,
  hard: 2,
};

export const BASE_XP = 10; // xp for an easy completion
export const BASE_GOLD = 5;
export const BASE_HP_LOSS = 8; // hp lost for missing an easy daily

// XP needed to advance FROM the given level to the next. Grows each level.
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(1.15, level - 1));
}

export function maxHpForLevel(level: number): number {
  return 50 + (level - 1) * 5;
}

export interface Stats {
  xp: number;
  level: number;
  hp: number;
  maxHp: number;
  gold: number;
}

export interface StatDelta {
  xp?: number;
  gold?: number;
  hp?: number;
}

export interface ApplyResult {
  stats: Stats;
  leveledUp: boolean;
  levelsGained: number;
  died: boolean; // hp hit 0
}

// Apply a stat delta, handling level-ups (with rollover XP) and death (HP floor at 0).
export function applyDelta(current: Stats, delta: StatDelta): ApplyResult {
  let { xp, level, hp, maxHp, gold } = current;
  let leveledUp = false;
  let levelsGained = 0;
  let died = false;

  gold = Math.max(0, gold + (delta.gold ?? 0));

  if (delta.hp) {
    hp = hp + delta.hp;
    if (hp <= 0) {
      // Death: reset HP to full, lose a level (min 1) and some gold — a gentle penalty.
      died = true;
      hp = maxHpForLevel(Math.max(1, level));
      level = Math.max(1, level - 1);
      maxHp = maxHpForLevel(level);
      gold = Math.floor(gold * 0.9);
    }
    hp = Math.min(hp, maxHp);
  }

  if (delta.xp) {
    xp += delta.xp;
    if (xp < 0) xp = 0;
    // Level up while we have enough XP, rolling the remainder forward.
    while (xp >= xpForLevel(level)) {
      xp -= xpForLevel(level);
      level += 1;
      levelsGained += 1;
      leveledUp = true;
      maxHp = maxHpForLevel(level);
      hp = maxHp; // full heal on level up
    }
  }

  return { stats: { xp, level, hp, maxHp, gold }, leveledUp, levelsGained, died };
}

// Reward for completing a task/daily of the given difficulty. Streak gives a small XP bonus.
export function completionReward(difficulty: Difficulty, streak = 0): StatDelta {
  const w = DIFFICULTY_WEIGHT[difficulty] ?? 1;
  const streakBonus = Math.min(streak, 20) * 0.05; // up to +100% at 20-day streak
  return {
    xp: Math.round(BASE_XP * w * (1 + streakBonus)),
    gold: Math.round(BASE_GOLD * w),
  };
}

// Penalty for missing a daily (or tapping a negative habit).
export function missPenalty(difficulty: Difficulty): StatDelta {
  const w = DIFFICULTY_WEIGHT[difficulty] ?? 1;
  return { hp: -Math.round(BASE_HP_LOSS * w) };
}

// Local YYYY-MM-DD string for daily rollover comparisons.
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
