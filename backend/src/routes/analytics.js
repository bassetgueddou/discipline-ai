const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { getWeeklyStats, calculateScore } = require('../services/scoreService');

// ─── GET /api/analytics/dashboard ───
// Données complètes pour le dashboard
router.get('/dashboard', verifyToken, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const [
      { data: profile },
      { data: todayScore },
      { data: todayTasks },
      { data: todaySessions }
    ] = await Promise.all([
      supabase.from('profiles').select('name, streak, longest_streak, plan, goals').eq('id', userId).single(),
      supabase.from('daily_scores').select('*').eq('user_id', userId).eq('date', today).single(),
      supabase.from('tasks').select('id, name, done, priority, scheduled_time').eq('user_id', userId).eq('scheduled_date', today).order('scheduled_time'),
      supabase.from('focus_sessions').select('duration_min, completed, session_type').eq('user_id', userId).gte('started_at', `${today}T00:00:00`)
    ]);

    const completedSessions = todaySessions?.filter(s => s.completed) || [];
    const tasksCompleted = todayTasks?.filter(t => t.done).length || 0;
    const tasksTotal = todayTasks?.length || 0;
    const focusMinutes = completedSessions.reduce((sum, s) => sum + s.duration_min, 0);

    res.json({
      user: {
        name: profile?.name || '',
        plan: profile?.plan || 'free',
        streak: profile?.streak || 0,
        longestStreak: profile?.longest_streak || 0,
        goals: profile?.goals || []
      },
      today: {
        score: todayScore?.discipline_score || 0,
        date: today,
        tasks: todayTasks || [],
        tasksCompleted,
        tasksTotal,
        completionRate: tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0,
        focusMinutes,
        pomodorosCompleted: completedSessions.filter(s => s.session_type === 'pomodoro').length
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/analytics/weekly ───
router.get('/weekly', verifyToken, async (req, res) => {
  try {
    const stats = await getWeeklyStats(req.user.id);
    const avgScore = Math.round(stats.reduce((s, d) => s + d.score, 0) / stats.filter(d => d.score > 0).length) || 0;
    const maxScore = Math.max(...stats.map(d => d.score));
    const totalFocus = stats.reduce((s, d) => s + d.focusMinutes, 0);

    res.json({
      days: stats,
      summary: {
        avgScore,
        maxScore,
        totalFocusMinutes: totalFocus,
        totalFocusHours: Math.round(totalFocus / 60 * 10) / 10,
        activeDays: stats.filter(d => d.score > 0).length
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/analytics/habits ───
router.get('/habits', verifyToken, async (req, res) => {
  try {
    const { data: habits } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('active', true);

    // Récupérer les 7 derniers jours de completions
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);

    const { data: completions } = await supabase
      .from('habit_completions')
      .select('habit_id, completed_date')
      .eq('user_id', req.user.id)
      .gte('completed_date', startDate.toISOString().split('T')[0]);

    // Calculer les streaks et semaine
    const habitsWithStats = (habits || []).map(habit => {
      const habitCompletions = completions?.filter(c => c.habit_id === habit.id) || [];
      const completedDates = habitCompletions.map(c => c.completed_date);

      // Semaine (7 derniers jours)
      const week = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        week.push(completedDates.includes(d.toISOString().split('T')[0]));
      }

      // Streak actuel
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (completedDates.includes(d.toISOString().split('T')[0])) streak++;
        else break;
      }

      return { ...habit, week, streak };
    });

    res.json({ habits: habitsWithStats });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/analytics/habits/:id/complete ───
router.post('/habits/:id/complete', verifyToken, async (req, res) => {
  const date = req.body.date || new Date().toISOString().split('T')[0];

  try {
    // Vérifier propriété
    const { data: habit } = await supabase
      .from('habits')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!habit) return res.status(404).json({ error: 'Habitude non trouvée.' });

    const { data, error } = await supabase
      .from('habit_completions')
      .upsert({ habit_id: req.params.id, user_id: req.user.id, completed_date: date }, { onConflict: 'habit_id,completed_date' })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ completion: data, message: 'Habitude validée ! 🎉' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
