// auth routes - login/signup/logout

import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Sign up
router.post('/signup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, name } = req.body;

    console.log('Signup attempt:', email);

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      console.log('Supabase signup error:', error.message);
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    console.log('Supabase signup success, user:', data.user?.id);

    if (data.user) {
      // Create profile
      await prisma.profile.create({
        data: {
          userId: data.user.id,
          email: data.user.email,
          name: name || null,
          goals: [],
          obstacles: [],
          badges: [],
        },
      });
    }

    res.json({
      success: true,
      data: {
        user: data.user,
        session: data.session,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'inscription' });
  }
});

// Sign in
router.post('/signin', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ success: false, error: error.message });
      return;
    }

    // Generate our own JWT for convenience
    const token = jwt.sign(
      { sub: data.user.id, email: data.user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        user: data.user,
        token,
        supabaseToken: data.session?.access_token,
      },
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la connexion' });
  }
});

// Alias for login (some frontends call it /login instead of /signin)
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ success: false, error: error.message });
      return;
    }

    // get profile from db
    const profile = await prisma.profile.findUnique({
      where: { userId: data.user.id },
    });

    const token = jwt.sign(
      { sub: data.user.id, email: data.user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // return in format frontend expects
    res.json({
      success: true,
      user: {
        ...data.user,
        name: profile?.name,
        onboarded: profile?.goals?.length > 0,
      },
      session: data.session,
      profile,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la connexion' });
  }
});

// Sign out
router.post('/signout', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    await supabase.auth.signOut();
    res.json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la déconnexion' });
  }
});

// Verify token
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      res.status(404).json({ success: false, error: 'Profil non trouvé' });
      return;
    }

    res.json({
      success: true,
      data: {
        user: { id: req.user!.id, email: req.user!.email },
        profile,
      },
    });
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
