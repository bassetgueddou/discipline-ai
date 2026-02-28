const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { supabase } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { checkTaskLimit } = require('../middleware/rateLimiter');
const { upsertDailyScore } = require('../services/scoreService');
const { generateDailyPlan } = require('../services/claudeService');

// ─── GET /api/tasks ───
// Récupérer les tâches (par date ou toutes)
router.get('/', verifyToken, async (req, res) => {
  const { date, all } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    let queryBuilder = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', req.user.id)
      .order('scheduled_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (!all) {
      queryBuilder = queryBuilder.eq('scheduled_date', targetDate);
    }

    const { data, error } = await queryBuilder;
    if (error) return res.status(400).json({ error: error.message });

    res.json({ tasks: data || [], date: targetDate });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/tasks ───
router.post('/',
  verifyToken,
  checkTaskLimit,
  [
    body('name').trim().notEmpty().withMessage('Nom de la tâche requis'),
    body('priority').optional().isIn(['high', 'med', 'low']),
    body('duration_min').optional().isInt({ min: 1, max: 480 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const {
      name, description, priority = 'med',
      scheduled_time, scheduled_date, duration_min = 60,
      goal_category
    } = req.body;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: req.user.id,
          name,
          description,
          priority,
          scheduled_time,
          scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
          duration_min,
          goal_category,
          ai_generated: false
        })
        .select()
        .single();

      if (error) return res.status(400).json({ error: error.message });
      res.status(201).json({ task: data, message: 'Tâche créée !' });
    } catch (err) {
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
);

// ─── PATCH /api/tasks/:id ───
router.patch('/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const allowed = ['name', 'description', 'priority', 'scheduled_time', 'duration_min', 'done', 'goal_category'];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  // Si on marque comme terminé, ajouter done_at
  if (updates.done === true) updates.done_at = new Date().toISOString();
  if (updates.done === false) updates.done_at = null;

  try {
    // Vérifier que la tâche appartient à l'utilisateur
    const { data: existing } = await supabase
      .from('tasks')
      .select('id, user_id, done')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Tâche non trouvée.' });
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Recalculer le score si on a changé le statut
    if (updates.done !== undefined) {
      await refreshDailyScore(req.user.id);
    }

    res.json({ task: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── DELETE /api/tasks/:id ───
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Tâche supprimée.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/tasks/generate ───
// Générer un plan IA pour aujourd'hui
router.post('/generate', verifyToken, async (req, res) => {
  const isPremium = req.user.plan === 'premium';

  try {
    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (!profile) return res.status(404).json({ error: 'Profil non trouvé.' });

    const date = req.body.date || new Date().toISOString().split('T')[0];

    // Supprimer les anciennes tâches IA du jour (si régénération)
    if (req.body.regenerate) {
      await supabase
        .from('tasks')
        .delete()
        .eq('user_id', req.user.id)
        .eq('scheduled_date', date)
        .eq('ai_generated', true)
        .eq('done', false);
    }

    const plan = await generateDailyPlan(profile, date);

    // Insérer les tâches dans la BDD
    const maxTasks = isPremium ? plan.tasks.length : Math.min(plan.tasks.length, 5);
    const tasksToInsert = plan.tasks.slice(0, maxTasks).map(t => ({
      user_id: req.user.id,
      name: t.name,
      scheduled_time: t.time,
      duration_min: t.duration_min || 60,
      priority: t.priority || 'med',
      goal_category: t.goal_category,
      ai_generated: true,
      scheduled_date: date
    }));

    const { data: insertedTasks } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();

    res.json({
      message: 'Plan généré !',
      tasks: insertedTasks,
      plan: {
        daily_intention: plan.daily_intention,
        coaching_message: plan.coaching_message,
        recommended_breaks: plan.recommended_breaks
      }
    });
  } catch (err) {
    console.error('Generate tasks error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du plan.' });
  }
});

// ─── Helper: recalculer score du jour ───
async function refreshDailyScore(userId) {
  const today = new Date().toISOString().split('T')[0];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('done')
    .eq('user_id', userId)
    .eq('scheduled_date', today);

  const { data: sessions } = await supabase
    .from('focus_sessions')
    .select('duration_min, completed')
    .eq('user_id', userId)
    .gte('started_at', `${today}T00:00:00`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak')
    .eq('id', userId)
    .single();

  const tasksCompleted = tasks?.filter(t => t.done).length || 0;
  const tasksTotal = tasks?.length || 0;
  const focusMinutes = sessions?.filter(s => s.completed).reduce((sum, s) => sum + s.duration_min, 0) || 0;
  const pomodorosCompleted = sessions?.filter(s => s.completed).length || 0;

  await upsertDailyScore(userId, {
    tasksCompleted,
    tasksTotal,
    focusMinutes,
    pomodorosCompleted,
    streakDay: profile?.streak || 0
  });

  // Mettre à jour le total
  await supabase
    .from('profiles')
    .update({ total_tasks_completed: supabase.rpc('increment', { x: 1 }) })
    .eq('id', userId);
}

module.exports = router;
