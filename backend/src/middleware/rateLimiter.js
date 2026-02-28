const rateLimit = require('express-rate-limit');
const { supabase } = require('../db');

// ─── Limites par plan ───
const LIMITS = {
  free: {
    tasks_per_day: 50,           // Augmenté pour dev (était 5)
    chat_messages_per_day: 100,  // Augmenté pour dev (était 15)
    focus_sessions_per_day: 50,  // Augmenté pour dev (était 10)
    goals_count: 5
  },
  premium: {
    tasks_per_day: Infinity,
    chat_messages_per_day: Infinity,
    focus_sessions_per_day: Infinity,
    goals_count: 10
  }
};

// ─── Rate limit global API ───
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessaie dans une minute.' }
});

// ─── Vérifier limite tâches ───
async function checkTaskLimit(req, res, next) {
  if (req.user.plan === 'premium') return next();

  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('scheduled_date', today);

  if (count >= LIMITS.free.tasks_per_day) {
    return res.status(429).json({
      error: 'Limite atteinte',
      message: `Plan gratuit limité à ${LIMITS.free.tasks_per_day} tâches/jour.`,
      limit: LIMITS.free.tasks_per_day,
      upgrade: true,
      upgradeUrl: '/premium'
    });
  }
  next();
}

// ─── Vérifier limite messages chat ───
async function checkChatLimit(req, res, next) {
  if (req.user.plan === 'premium') return next();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id)
    .eq('role', 'user')
    .gte('created_at', today.toISOString());

  if (count >= LIMITS.free.chat_messages_per_day) {
    return res.status(429).json({
      error: 'Limite atteinte',
      message: `Plan gratuit limité à ${LIMITS.free.chat_messages_per_day} messages/jour.`,
      limit: LIMITS.free.chat_messages_per_day,
      upgrade: true,
      upgradeUrl: '/premium'
    });
  }
  next();
}

module.exports = { globalLimiter, checkTaskLimit, checkChatLimit, LIMITS };
