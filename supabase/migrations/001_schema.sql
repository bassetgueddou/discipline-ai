-- ============================================
-- DISCIPLINE AI — Schéma de base de données
-- Coller dans Supabase SQL Editor et exécuter
-- ============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────
-- TABLE: profiles (extension de auth.users)
-- ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  goals TEXT[] DEFAULT '{}',
  discipline_level INT DEFAULT 5 CHECK (discipline_level BETWEEN 1 AND 10),
  obstacles TEXT[] DEFAULT '{}',
  energy_level INT DEFAULT 3 CHECK (energy_level BETWEEN 1 AND 5),
  wake_time TEXT DEFAULT '07:00',
  sleep_time TEXT DEFAULT '23:00',
  available_hours INT DEFAULT 8,
  timezone TEXT DEFAULT 'Europe/Paris',
  onboarded BOOLEAN DEFAULT FALSE,
  streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  total_focus_minutes INT DEFAULT 0,
  total_tasks_completed INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────
-- TABLE: tasks
-- ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'med' CHECK (priority IN ('high', 'med', 'low')),
  scheduled_time TEXT,
  scheduled_date DATE DEFAULT CURRENT_DATE,
  duration_min INT DEFAULT 60,
  done BOOLEAN DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  ai_generated BOOLEAN DEFAULT FALSE,
  goal_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON public.tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_done ON public.tasks(user_id, done);

-- ─────────────────────────────
-- TABLE: focus_sessions
-- ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_min INT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  interrupted_at_sec INT,
  session_type TEXT DEFAULT 'pomodoro' CHECK (session_type IN ('pomodoro', 'deep', 'sprint')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_focus_user_date ON public.focus_sessions(user_id, started_at);

-- ─────────────────────────────
-- TABLE: daily_scores
-- ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  discipline_score INT DEFAULT 0 CHECK (discipline_score BETWEEN 0 AND 100),
  tasks_completed INT DEFAULT 0,
  tasks_total INT DEFAULT 0,
  focus_minutes INT DEFAULT 0,
  pomodoros INT DEFAULT 0,
  streak_day INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_scores_user_date ON public.daily_scores(user_id, date);

-- ─────────────────────────────
-- TABLE: habits
-- ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '⭐',
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.habit_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(habit_id, completed_date)
);

-- ─────────────────────────────
-- TABLE: chat_messages
-- ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_user_created ON public.chat_messages(user_id, created_at);

-- ─────────────────────────────
-- RLS (Row Level Security)
-- ─────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies tasks
CREATE POLICY "Users can manage own tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id);

-- Policies focus_sessions
CREATE POLICY "Users can manage own sessions" ON public.focus_sessions FOR ALL USING (auth.uid() = user_id);

-- Policies daily_scores
CREATE POLICY "Users can manage own scores" ON public.daily_scores FOR ALL USING (auth.uid() = user_id);

-- Policies habits
CREATE POLICY "Users can manage own habits" ON public.habits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own habit completions" ON public.habit_completions FOR ALL USING (auth.uid() = user_id);

-- Policies chat
CREATE POLICY "Users can manage own messages" ON public.chat_messages FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────
-- TRIGGER: Auto-créer profil à l'inscription
-- ─────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────
-- TRIGGER: updated_at auto-update
-- ─────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_scores_updated_at BEFORE UPDATE ON public.daily_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────
-- Habits par défaut (optionnel)
-- ─────────────────────────────
-- Ces habits sont insérés pour les nouveaux utilisateurs via le trigger
-- ou manuellement après l'onboarding

-- ✅ Schema complet installé !
SELECT 'Schema DISCIPLINE AI installé avec succès !' as status;
