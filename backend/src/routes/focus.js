const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { supabase } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { upsertDailyScore } = require('../services/scoreService');

// ─── POST /api/focus/start ───
router.post('/start',
  verifyToken,
  [
    body('duration_min').isInt({ min: 1, max: 120 }).withMessage('Durée entre 1 et 120 minutes'),
    body('session_type').optional().isIn(['pomodoro', 'deep', 'sprint'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { duration_min, task_id, session_type = 'pomodoro' } = req.body;

    try {
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: req.user.id,
          task_id: task_id || null,
          duration_min,
          session_type,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      res.status(201).json({ session: data });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
);

// ─── PATCH /api/focus/:id/complete ───
router.patch('/:id/complete', verifyToken, async (req, res) => {
  const { interrupted_at_sec } = req.body;
  const completed = !interrupted_at_sec;

  try {
    // Vérifier propriété
    const { data: session } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!session) return res.status(404).json({ error: 'Session non trouvée.' });

    const { data, error } = await supabase
      .from('focus_sessions')
      .update({
        completed,
        ended_at: new Date().toISOString(),
        interrupted_at_sec: interrupted_at_sec || null
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Mettre à jour les stats
    if (completed) {
      await supabase.rpc('increment_focus_time', {
        p_user_id: req.user.id,
        p_minutes: session.duration_min
      }).catch(() => {}); // Ignore si RPC non définie
    }

    // Recalculer score du jour
    await refreshScore(req.user.id);

    res.json({
      session: data,
      message: completed ? '🎉 Session complétée ! +points' : 'Session interrompue.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/focus/today ───
router.get('/today', verifyToken, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', req.user.id)
      .gte('started_at', `${today}T00:00:00`)
      .order('started_at', { ascending: true });

    if (error) return res.status(400).json({ error: error.message });

    const completedSessions = data?.filter(s => s.completed) || [];
    const totalFocusMinutes = completedSessions.reduce((sum, s) => sum + s.duration_min, 0);

    res.json({
      sessions: data || [],
      stats: {
        totalSessions: data?.length || 0,
        completedSessions: completedSessions.length,
        totalFocusMinutes,
        pomodorosCompleted: completedSessions.filter(s => s.session_type === 'pomodoro').length
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── Helper ───
async function refreshScore(userId) {
  const today = new Date().toISOString().split('T')[0];

  const [{ data: tasks }, { data: sessions }, { data: profile }] = await Promise.all([
    supabase.from('tasks').select('done').eq('user_id', userId).eq('scheduled_date', today),
    supabase.from('focus_sessions').select('duration_min, completed').eq('user_id', userId).gte('started_at', `${today}T00:00:00`),
    supabase.from('profiles').select('streak').eq('id', userId).single()
  ]);

  await upsertDailyScore(userId, {
    tasksCompleted: tasks?.filter(t => t.done).length || 0,
    tasksTotal: tasks?.length || 0,
    focusMinutes: sessions?.filter(s => s.completed).reduce((s, r) => s + r.duration_min, 0) || 0,
    pomodorosCompleted: sessions?.filter(s => s.completed).length || 0,
    streakDay: profile?.streak || 0
  });
}

module.exports = router;
