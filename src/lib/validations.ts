import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  role: z.string().max(50).default("Personal"),
  hours: z.number().min(0).max(168).nullable().optional(),
  goalId: z.string().optional(),
});

export const updateTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  role: z.string().max(50).optional(),
  hours: z.number().min(0).max(168).nullable().optional(),
  goalId: z.string().nullable().optional(),
});

export const createGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.string().min(1).max(50),
  targetDate: z.string().optional(),
});

export const updateGoalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(50).optional(),
  targetDate: z.string().nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "completed", "paused"]).optional(),
});

export const createPersonSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  dateMet: z.string().optional(),
  notes: z.string().max(5000).optional(),
  prayerRequests: z.string().max(2000).optional(),
  goals: z.string().max(2000).optional(),
  tags: z.string().max(500).optional(),
  followUpDate: z.string().optional(),
});

export const updatePersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(50).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  prayerRequests: z.string().max(2000).nullable().optional(),
  goals: z.string().max(2000).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  lastContactDate: z.string().optional(),
});

export const createEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  category: z.string().max(50).default("Personal"),
  role: z.string().max(50).default("Personal"),
  location: z.string().max(200).optional(),
  isLed: z.boolean().default(false),
});

export const createReflectionSchema = z.object({
  type: z.string().min(1).max(50),
  date: z.string().optional(),
  content: z.string().min(1).max(10000),
  mood: z.number().min(1).max(10).optional(),
  energy: z.number().min(1).max(10).optional(),
  gratitude: z.string().max(2000).optional(),
});

export const createCheckInSchema = z.object({
  energy: z.number().min(1).max(10),
  stress: z.number().min(1).max(10),
  mood: z.number().min(1).max(10),
  sleep: z.number().min(0).max(24).optional(),
  notes: z.string().max(2000).optional(),
});

export const createInteractionSchema = z.object({
  personId: z.string().min(1),
  type: z.string().min(1).max(50),
  notes: z.string().max(2000).nullable().optional(),
});
