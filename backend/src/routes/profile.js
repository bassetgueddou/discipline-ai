const express = require('express');
const router = express.Router();
const { supabase } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { generateDailyPlan } = require('../services/claudeService');

// ─── GET /api/profile ───
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Profil non trouvé.' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── PUT /api/profile ───
router.put('/', verifyToken, async (req, res) => {
  const allowed = ['name', 'goals', 'discipline_level', 'obstacles', 'energy_level', 'wake_time', 'sleep_time', 'available_hours', 'timezone'];
  const updates = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Profil non trouvé.' });
    res.json({ message: 'Profil mis à jour.', profile: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/profile/onboarding ───
// Finaliser l'onboarding et générer le premier plan
router.post('/onboarding', verifyToken, async (req, res) => {
  const { name, goals, discipline_level, obstacles, energy_level, wake_time, available_hours } = req.body;

  if (!name || !goals || goals.length === 0) {
    return res.status(400).json({ error: 'Nom et objectifs requis.' });
  }

  try {
    // D'abord vérifier si le profil existe
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    let profile;
    let error;

    if (existingProfile) {
      // UPDATE si le profil existe
      const result = await supabase
        .from('profiles')
        .update({
          name,
          goals,
          discipline_level: discipline_level || 5,
          obstacles: obstacles || [],
          energy_level: energy_level || 3,
          wake_time: wake_time || '07:00',
          available_hours: available_hours || 8,
          onboarded: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', req.user.id)
        .select()
        .single();
      profile = result.data;
      error = result.error;
    } else {
      // INSERT si le profil n'existe pas
      const result = await supabase
        .from('profiles')
        .insert({
          user_id: req.user.id,
          email: req.user.email,
          name,
          goals,
          discipline_level: discipline_level || 5,
          obstacles: obstacles || [],
          energy_level: energy_level || 3,
          wake_time: wake_time || '07:00',
          available_hours: available_hours || 8,
          onboarded: true,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      profile = result.data;
      error = result.error;
    }

    if (error) return res.status(400).json({ error: error.message });

    // Créer les habitudes par défaut
    const defaultHabits = [
      { user_id: req.user.id, name: 'Sport / Exercice', icon: '💪' },
      { user_id: req.user.id, name: 'Lecture', icon: '📚' },
      { user_id: req.user.id, name: 'Méditation', icon: '🧘' },
      { user_id: req.user.id, name: 'Hydratation (2L)', icon: '💧' }
    ];

    await supabase.from('habits').insert(defaultHabits);

    // Générer le plan du premier jour
    const plan = await generateDailyPlan(profile);

    // Insérer les tâches générées
    if (plan.tasks && plan.tasks.length > 0) {
      const tasksToInsert = plan.tasks.map(t => ({
        user_id: req.user.id,
        name: t.name,
        scheduled_time: t.time,
        duration_min: t.duration_min || 60,
        priority: t.priority || 'med',
        goal_category: t.goal_category,
        ai_generated: true,
        scheduled_date: new Date().toISOString().split('T')[0]
      }));

      await supabase.from('tasks').insert(tasksToInsert);
    }

    res.json({
      message: 'Onboarding terminé ! Ton plan est prêt.',
      profile,
      plan
    });
  } catch (err) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Erreur lors de la finalisation de l\'onboarding.' });
  }
});

// ─── GET /api/profile/stats ───
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak, longest_streak, total_focus_minutes, total_tasks_completed')
      .eq('user_id', req.user.id)
      .maybeSingle();

    // Score du jour
    const today = new Date().toISOString().split('T')[0];
    const { data: todayScore } = await supabase
      .from('daily_scores')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('date', today)
      .maybeSingle();

    res.json({
      streak: profile?.streak || 0,
      longestStreak: profile?.longest_streak || 0,
      totalFocusMinutes: profile?.total_focus_minutes || 0,
      totalTasksCompleted: profile?.total_tasks_completed || 0,
      todayScore: todayScore?.discipline_score || 0,
      todayFocusMinutes: todayScore?.focus_minutes || 0,
      todayTasksCompleted: todayScore?.tasks_completed || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
