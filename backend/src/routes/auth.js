const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { supabase } = require('../db');
const { verifyToken } = require('../middleware/auth');

// ─── Validation helpers ───
const emailVal = body('email').isEmail().normalizeEmail().withMessage('Email invalide');
const passVal = body('password').isLength({ min: 6 }).withMessage('Mot de passe minimum 6 caractères');

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg });
    return false;
  }
  return true;
}

// ─── POST /api/auth/signup ───
router.post('/signup',
  [emailVal, passVal, body('name').trim().notEmpty().withMessage('Nom requis')],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const { email, password, name } = req.body;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
        }
        return res.status(400).json({ error: error.message });
      }

      // Le trigger SQL crée automatiquement le profil
      // Créer ou mettre à jour le profil (upsert)
      if (data.user) {
        await supabase
          .from('profiles')
          .upsert({ 
            id: data.user.id,
            user_id: data.user.id,
            email: data.user.email,
            name,
            onboarded: false,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id', ignoreDuplicates: false });
      }

      res.status(201).json({
        message: 'Compte créé avec succès !',
        user: {
          id: data.user.id,
          email: data.user.email,
          name
        },
        session: data.session
      });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Erreur lors de la création du compte.' });
    }
  }
);

// ─── POST /api/auth/login ───
router.post('/login',
  [emailVal, passVal],
  async (req, res) => {
    if (!handleValidation(req, res)) return;

    const { email, password } = req.body;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login')) {
          return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
        }
        return res.status(401).json({ error: error.message });
      }

      // Récupérer le profil complet
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      res.json({
        message: 'Connexion réussie !',
        user: {
          id: data.user.id,
          email: data.user.email,
          name: profile?.name || '',
          plan: profile?.plan || 'free',
          onboarded: profile?.onboarded || false
        },
        session: data.session,
        profile
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Erreur lors de la connexion.' });
    }
  }
);

// ─── POST /api/auth/logout ───
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // Supabase gère l'invalidation côté client
    res.json({ message: 'Déconnecté avec succès.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
  }
});

// ─── GET /api/auth/me ───
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'Erreur base de données.' });
    if (!profile) return res.status(404).json({ error: 'Profil non trouvé.' });

    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        ...profile
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
