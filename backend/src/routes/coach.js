const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { supabase } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { checkChatLimit } = require('../middleware/rateLimiter');
const { chatWithCoach, getDailyMotivation } = require('../services/claudeService');

// ─── POST /api/coach/message ───
router.post('/message',
  verifyToken,
  checkChatLimit,
  [body('message').trim().notEmpty().isLength({ max: 1000 }).withMessage('Message requis (max 1000 chars)')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { message } = req.body;
    const userId = req.user.id;

    try {
      // Récupérer le profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, goals, discipline_level, obstacles, energy_level, wake_time')
        .eq('id', userId)
        .single();

      // Récupérer l'historique récent (12 derniers messages)
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(12);

      const messages = [
        ...(history || []).reverse(),
        { role: 'user', content: message }
      ];

      // Appel Claude
      const { content, tokensUsed, fallback } = await chatWithCoach(profile || {}, messages);

      // Sauvegarder en BDD
      await supabase.from('chat_messages').insert([
        { user_id: userId, role: 'user', content: message, tokens_used: 0 },
        { user_id: userId, role: 'assistant', content, tokens_used: tokensUsed }
      ]);

      res.json({
        message: content,
        fallback,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Coach message error:', err);
      res.status(500).json({ error: 'Erreur du service coach. Réessaie.' });
    }
  }
);

// ─── GET /api/coach/history ───
router.get('/history', verifyToken, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ messages: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── DELETE /api/coach/history ───
router.delete('/history', verifyToken, async (req, res) => {
  try {
    await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', req.user.id);

    res.json({ message: 'Historique effacé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── GET /api/coach/daily-motivation ───
router.get('/daily-motivation', verifyToken, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, goals')
      .eq('id', req.user.id)
      .single();

    const motivation = await getDailyMotivation(profile || {});
    res.json({ motivation });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
