const { supabase } = require('../db');

/**
 * Middleware d'authentification.
 * Vérifie le JWT Supabase dans le header Authorization.
 * Attache req.user avec id, email, plan.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant. Connecte-toi.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Vérifier le token Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Token invalide ou expiré.' });
    }

    // Récupérer le profil avec le plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, name, onboarded')
      .eq('id', user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email,
      plan: profile?.plan || 'free',
      name: profile?.name || '',
      onboarded: profile?.onboarded || false
    };

    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Authentification échouée.' });
  }
}

/**
 * Middleware optionnel — ne bloque pas si pas connecté
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  return verifyToken(req, res, next);
}

module.exports = { verifyToken, optionalAuth };
