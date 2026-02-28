// ═══════════════════════════════════════════════════════════════════════════
// DISCIPLINE AI - Core Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

// ─── User & Profile ───
export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  
  // Onboarding data
  goals: string[];
  obstacles: string[];
  discipline_level: number; // 1-10
  energy_level: number; // 1-5
  chronotype: 'early_bird' | 'night_owl' | 'neutral';
  wake_time: string; // HH:mm
  sleep_time: string; // HH:mm
  available_hours: number;
  work_style: 'pomodoro' | 'deep_work' | 'flexible';
  
  // Gamification
  xp: number;
  level: number;
  streak_days: number;
  longest_streak: number;
  badges: string[];
  
  // Subscription
  plan: 'free' | 'premium';
  
  // Calendar integrations
  google_calendar_connected: boolean;
  apple_calendar_connected: boolean;
  
  // Stats
  total_tasks_completed: number;
  total_focus_minutes: number;
  
  created_at: string;
  updated_at: string;
}

// ─── Tasks ───
export type TaskPriority = 'high' | 'med' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Task {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  
  // Scheduling
  date: string; // YYYY-MM-DD
  scheduled_time?: string; // HH:mm
  duration_min: number;
  
  // Classification
  priority: TaskPriority;
  goal_category?: string;
  tags?: string[];
  
  // Status
  status: TaskStatus;
  done: boolean;
  completed_at?: string;
  
  // AI
  ai_generated: boolean;
  ai_reason?: string;
  
  // Gamification
  xp_reward: number;
  
  created_at: string;
  updated_at: string;
}

// ─── Goals ───
export interface Goal {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  category: string;
  
  // Progress
  target_value?: number;
  current_value: number;
  unit?: string;
  
  // Dates
  deadline?: string;
  
  // Status
  is_active: boolean;
  is_completed: boolean;
  
  // Color/Icon for UI
  color: string;
  icon: string;
  
  created_at: string;
  updated_at: string;
}

// ─── Focus Sessions ───
export type FocusPhase = 'focus' | 'break' | 'long-break';

export interface FocusSession {
  id: string;
  user_id: string;
  task_id?: string;
  
  // Session details
  duration_sec: number;
  phase: FocusPhase;
  pomodoros_completed: number;
  
  // Timestamps
  started_at: string;
  ended_at?: string;
  
  // Quality metrics
  interruptions: number;
  quality_rating?: number; // 1-5
  
  created_at: string;
}

// ─── Chat/Coach ───
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  
  // Metadata
  tokens_used?: number;
  model?: string;
  
  created_at: string;
}

// ─── Gamification ───
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'tasks' | 'focus' | 'special';
  requirement: string;
  xp_reward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked_at?: string;
}

export interface Level {
  level: number;
  name: string;
  min_xp: number;
  max_xp: number;
  perks?: string[];
}

export interface DailyChallenge {
  id: string;
  type: 'tasks' | 'focus' | 'streak' | 'special';
  description: string;
  target: number;
  current: number;
  xp_reward: number;
  expires_at: string;
  completed: boolean;
}

// ─── Calendar Integration ───
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  all_day: boolean;
  source: 'google' | 'apple' | 'local';
  color?: string;
}

export interface FreeSlot {
  start: string;
  end: string;
  duration_min: number;
}

// ─── AI Plan ───
export interface DailyPlan {
  date: string;
  tasks: Task[];
  daily_intention: string;
  coaching_message: string;
  energy_peak: string;
  recommended_breaks: {
    time: string;
    duration_min: number;
    reason: string;
  }[];
}

// ─── Analytics ───
export interface DailyStats {
  date: string;
  tasks_completed: number;
  tasks_total: number;
  completion_rate: number;
  focus_minutes: number;
  pomodoros: number;
  xp_earned: number;
  discipline_score: number;
}

export interface WeeklyStats {
  week_start: string;
  week_end: string;
  days: DailyStats[];
  totals: {
    tasks_completed: number;
    focus_minutes: number;
    xp_earned: number;
    avg_completion_rate: number;
  };
  best_day: string;
  worst_day: string;
  trend: 'up' | 'down' | 'stable';
}

// ─── API Responses ───
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Store Types ───
export interface AppState {
  // Auth
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Profile
  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;
  
  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  
  // Goals
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
  
  // Chat
  chatHistory: ChatMessage[];
  setChatHistory: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  
  // Focus
  todayFocusMinutes: number;
  setTodayFocusMinutes: (minutes: number) => void;
  
  // Gamification
  xp: number;
  level: number;
  streak: number;
  addXp: (amount: number) => void;
  
  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

// ─── XP System Constants ───
export const XP_CONFIG = {
  TASK_COMPLETE: {
    high: 50,
    med: 30,
    low: 15,
  },
  POMODORO: 25,
  STREAK_BONUS: 10, // per day
  DAILY_CHALLENGE: 100,
  BADGE_UNLOCK: 200,
} as const;

export const LEVELS: Level[] = [
  { level: 1, name: 'Débutant', min_xp: 0, max_xp: 100 },
  { level: 2, name: 'Apprenti', min_xp: 100, max_xp: 300 },
  { level: 3, name: 'Initié', min_xp: 300, max_xp: 600 },
  { level: 4, name: 'Discipliné', min_xp: 600, max_xp: 1000 },
  { level: 5, name: 'Focalisé', min_xp: 1000, max_xp: 1500 },
  { level: 6, name: 'Productif', min_xp: 1500, max_xp: 2200 },
  { level: 7, name: 'Efficace', min_xp: 2200, max_xp: 3000 },
  { level: 8, name: 'Expert', min_xp: 3000, max_xp: 4000 },
  { level: 9, name: 'Maître', min_xp: 4000, max_xp: 5500 },
  { level: 10, name: 'Légende', min_xp: 5500, max_xp: Infinity },
];

// ─── Badge Definitions ───
export const BADGES: Badge[] = [
  { id: 'first_task', name: 'Premier Pas', description: 'Complète ta première tâche', icon: '🎯', category: 'tasks', requirement: 'complete_1_task', xp_reward: 50, rarity: 'common' },
  { id: 'streak_3', name: 'Momentum', description: '3 jours consécutifs', icon: '🔥', category: 'streak', requirement: 'streak_3', xp_reward: 100, rarity: 'common' },
  { id: 'streak_7', name: 'Semaine Parfaite', description: '7 jours consécutifs', icon: '⚡', category: 'streak', requirement: 'streak_7', xp_reward: 200, rarity: 'rare' },
  { id: 'streak_30', name: 'Habit Master', description: '30 jours consécutifs', icon: '💎', category: 'streak', requirement: 'streak_30', xp_reward: 500, rarity: 'epic' },
  { id: 'focus_60', name: 'Deep Focus', description: '60 min de focus sans interruption', icon: '🧘', category: 'focus', requirement: 'focus_60_min', xp_reward: 150, rarity: 'rare' },
  { id: 'early_bird', name: 'Lève-tôt', description: 'Complète une tâche avant 7h', icon: '🌅', category: 'special', requirement: 'task_before_7am', xp_reward: 100, rarity: 'rare' },
  { id: 'night_owl', name: 'Hibou', description: 'Complète une tâche après 23h', icon: '🦉', category: 'special', requirement: 'task_after_11pm', xp_reward: 100, rarity: 'rare' },
  { id: 'tasks_100', name: 'Centurion', description: '100 tâches complétées', icon: '💯', category: 'tasks', requirement: 'complete_100_tasks', xp_reward: 300, rarity: 'epic' },
  { id: 'focus_1000', name: 'Marathonien', description: '1000 minutes de focus', icon: '🏃', category: 'focus', requirement: 'focus_1000_min', xp_reward: 400, rarity: 'epic' },
  { id: 'perfectionist', name: 'Perfectionniste', description: '100% de completion sur 7 jours', icon: '👑', category: 'special', requirement: 'perfect_week', xp_reward: 500, rarity: 'legendary' },
];
