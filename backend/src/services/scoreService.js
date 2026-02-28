const { supabase } = require('../db');

/**
 * Calcule le score de discipline (0-100)
 * Pondération : 40% complétion tâches, 30% focus, 20% streak, 10% pomodoros
 */
function calculateScore({ tasksCompleted, tasksTotal, focusMinutes, streakDay, pomodorosCompleted }) {
  const completionRate = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

  const breakdown = {
    completion: Math.min(completionRate, 100) * 0.40,
    focus: Math.min((focusMinutes / 120) * 100, 100) * 0.30, // objectif 2h
    streak: Math.min((streakDay / 7) * 100, 100) * 0.20,    // objectif 7 jours
    pomodoros: Math.min((pomodorosCompleted / 4) * 100, 100) * 0.10 // objectif 4 pom
  };

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return {
    score: Math.round(total),
    breakdown,
    label: getScoreLabel(Math.round(total))
  };
}

function getScoreLabel(score) {
  if (score >= 90) return { text: '🏆 Légendaire', color: '#fbbf24' };
  if (score >= 75) return { text: '🔥 Excellent', color: '#f97316' };
  if (score >= 60) return { text: '💪 Bon rythme', color: '#22c55e' };
  if (score >= 40) return { text: '📈 En progression', color: '#3b82f6' };
  return { text: '🌱 Débutant', color: '#94a3b8' };
}

/**
 * Mettre à jour ou créer le score du jour
 */
async function upsertDailyScore(userId, data) {
  const today = new Date().toISOString().split('T')[0];
  const { score } = calculateScore(data);

  const { data: result, error } = await supabase
    .from('daily_scores')
    .upsert({
      user_id: userId,
      date: today,
      discipline_score: score,
      tasks_completed: data.tasksCompleted || 0,
      tasks_total: data.tasksTotal || 0,
      focus_minutes: data.focusMinutes || 0,
      pomodoros: data.pomodorosCompleted || 0,
      streak_day: data.streakDay || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) console.error('Score upsert error:', error);
  return result;
}

/**
 * Calculer et mettre à jour le streak
 */
async function updateStreak(userId) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Vérifier si l'utilisateur était actif hier
  const { data: yesterdayScore } = await supabase
    .from('daily_scores')
    .select('discipline_score')
    .eq('user_id', userId)
    .eq('date', yesterdayStr)
    .single();

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak, longest_streak')
    .eq('id', userId)
    .single();

  let newStreak = profile?.streak || 0;

  if (yesterdayScore && yesterdayScore.discipline_score >= 20) {
    // Continuer le streak
    newStreak = newStreak + 1;
  } else {
    // Reset si pas actif hier (sauf premier jour)
    const today = new Date().toISOString().split('T')[0];
    const { data: todayScore } = await supabase
      .from('daily_scores')
      .select('discipline_score')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (!todayScore) newStreak = 1; // Premier jour
    // Si actif aujourd'hui mais pas hier → streak = 1
    else newStreak = 1;
  }

  const longestStreak = Math.max(profile?.longest_streak || 0, newStreak);

  await supabase
    .from('profiles')
    .update({ streak: newStreak, longest_streak: longestStreak })
    .eq('id', userId);

  return { streak: newStreak, longestStreak };
}

/**
 * Récupérer les stats des 7 derniers jours
 */
async function getWeeklyStats(userId) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);

  const { data: scores } = await supabase
    .from('daily_scores')
    .select('date, discipline_score, tasks_completed, focus_minutes, pomodoros')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  // Remplir les jours manquants avec 0
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayData = scores?.find(s => s.date === dateStr);
    result.push({
      date: dateStr,
      day: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
      score: dayData?.discipline_score || 0,
      tasksCompleted: dayData?.tasks_completed || 0,
      focusMinutes: dayData?.focus_minutes || 0,
      pomodoros: dayData?.pomodoros || 0
    });
  }

  return result;
}

module.exports = { calculateScore, upsertDailyScore, updateStreak, getWeeklyStats, getScoreLabel };
