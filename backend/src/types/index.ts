// backend types - all the interface shit goes here

import { Request } from 'express';

// auth request extension
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

// profile
export interface UserProfile {
  id: string;
  userId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  
  // Onboarding
  goals: string[];
  obstacles: string[];
  disciplineLevel: number;
  energyLevel: number;
  chronotype: string; // early_bird, night_owl, neutral
  wakeTime: string;
  sleepTime: string;
  availableHours: number;
  workStyle: string; // pomodoro, deep_work, flexible
  
  // Gamification
  xp: number;
  level: number;
  streakDays: number;
  longestStreak: number;
  badges: string[];
  
  // Subscription
  plan: string; // free, premium
  
  // Calendar
  googleCalendarConnected: boolean;
  appleCalendarConnected: boolean;
  
  // Stats
  totalTasksCompleted: number;
  totalFocusMinutes: number;
}

// task type
export type TaskPriority = 'high' | 'med' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Task {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  
  date: string;
  scheduledTime?: string | null;
  durationMin: number;
  
  priority: TaskPriority;
  goalId?: string | null;
  goalCategory?: string | null;
  tags: string[];
  
  status: TaskStatus;
  done: boolean;
  completedAt?: Date | null;
  
  aiGenerated: boolean;
  aiReason?: string | null;
  
  xpReward: number;
  
  createdAt: Date;
  updatedAt: Date;
}

// goal
export interface Goal {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  category: string;
  
  targetValue?: number | null;
  currentValue: number;
  unit?: string | null;
  
  deadline?: Date | null;
  
  isActive: boolean;
  isCompleted: boolean;
  
  color: string;
  icon: string;
}

// focus session
export type FocusPhase = 'focus' | 'break' | 'long-break';

export interface FocusSession {
  id: string;
  userId: string;
  taskId?: string | null;
  
  durationSec: number;
  phase: FocusPhase;
  pomodorosCompleted: number;
  
  startedAt: Date;
  endedAt?: Date | null;
  
  interruptions: number;
  qualityRating?: number | null;
}

// chat messages
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  userId: string;
  role: MessageRole;
  content: string;
  tokensUsed?: number | null;
  model?: string | null;
  createdAt: Date;
}

// daily challenge
export type ChallengeType = 'tasks' | 'focus' | 'streak' | 'special';

export interface DailyChallenge {
  id: string;
  userId: string;
  date: string;
  type: ChallengeType;
  description: string;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
  expiresAt: Date;
}

// xp rewards and levels - tweak these to balance the game
export const XP_REWARDS = {
  TASK_HIGH: 50,
  TASK_MED: 30,
  TASK_LOW: 15,
  POMODORO: 25,
  STREAK_BONUS: 10,
  CHALLENGE_COMPLETE: 100,
  BADGE_UNLOCK: 200,
} as const;

export interface Level {
  level: number;
  name: string;
  minXp: number;
  maxXp: number;
}

export const LEVELS: Level[] = [
  { level: 1, name: 'Débutant', minXp: 0, maxXp: 100 },
  { level: 2, name: 'Apprenti', minXp: 100, maxXp: 300 },
  { level: 3, name: 'Initié', minXp: 300, maxXp: 600 },
  { level: 4, name: 'Discipliné', minXp: 600, maxXp: 1000 },
  { level: 5, name: 'Focalisé', minXp: 1000, maxXp: 1500 },
  { level: 6, name: 'Productif', minXp: 1500, maxXp: 2200 },
  { level: 7, name: 'Efficace', minXp: 2200, maxXp: 3000 },
  { level: 8, name: 'Expert', minXp: 3000, maxXp: 4000 },
  { level: 9, name: 'Maître', minXp: 4000, maxXp: 5500 },
  { level: 10, name: 'Légende', minXp: 5500, maxXp: Infinity },
];

// badges - make users feel special
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'tasks' | 'focus' | 'special';
  requirement: string;
  xpReward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const BADGES: BadgeDefinition[] = [
  { id: 'first_task', name: 'Premier Pas', description: 'Complète ta première tâche', icon: '🎯', category: 'tasks', requirement: 'complete_1_task', xpReward: 50, rarity: 'common' },
  { id: 'streak_3', name: 'Momentum', description: '3 jours consécutifs', icon: '🔥', category: 'streak', requirement: 'streak_3', xpReward: 100, rarity: 'common' },
  { id: 'streak_7', name: 'Semaine Parfaite', description: '7 jours consécutifs', icon: '⚡', category: 'streak', requirement: 'streak_7', xpReward: 200, rarity: 'rare' },
  { id: 'streak_30', name: 'Habit Master', description: '30 jours consécutifs', icon: '💎', category: 'streak', requirement: 'streak_30', xpReward: 500, rarity: 'epic' },
  { id: 'focus_60', name: 'Deep Focus', description: '60 min de focus sans interruption', icon: '🧘', category: 'focus', requirement: 'focus_60_min', xpReward: 150, rarity: 'rare' },
  { id: 'early_bird', name: 'Lève-tôt', description: 'Complète une tâche avant 7h', icon: '🌅', category: 'special', requirement: 'task_before_7am', xpReward: 100, rarity: 'rare' },
  { id: 'night_owl', name: 'Hibou', description: 'Complète une tâche après 23h', icon: '🦉', category: 'special', requirement: 'task_after_11pm', xpReward: 100, rarity: 'rare' },
  { id: 'tasks_100', name: 'Centurion', description: '100 tâches complétées', icon: '💯', category: 'tasks', requirement: 'complete_100_tasks', xpReward: 300, rarity: 'epic' },
  { id: 'focus_1000', name: 'Marathonien', description: '1000 minutes de focus', icon: '🏃', category: 'focus', requirement: 'focus_1000_min', xpReward: 400, rarity: 'epic' },
  { id: 'perfectionist', name: 'Perfectionniste', description: '100% de completion sur 7 jours', icon: '👑', category: 'special', requirement: 'perfect_week', xpReward: 500, rarity: 'legendary' },
];

// api response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ai service stuff
export interface ChatResponse {
  content: string;
  tokensUsed: number;
  fallback: boolean;
}

export interface DailyPlan {
  tasks: Array<{
    name: string;
    time: string;
    duration_min: number;
    priority: TaskPriority;
    goal_category: string;
  }>;
  daily_intention: string;
  coaching_message: string;
  energy_peak: string;
  recommended_breaks: Array<{
    time: string;
    duration_min: number;
    reason: string;
  }>;
}

// calendar events
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: 'google' | 'apple' | 'local';
  color?: string;
}

export interface FreeSlot {
  start: Date;
  end: Date;
  durationMin: number;
}
