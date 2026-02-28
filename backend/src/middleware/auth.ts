// auth middleware - jwt verification and rate limits

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../lib/supabase.js';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

interface JwtPayload {
  sub: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Token manquant' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Try JWT first (for our own tokens)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      req.user = { id: decoded.sub, email: decoded.email };
      next();
      return;
    } catch {
      // Not our JWT, try Supabase
    }

    // Try Supabase token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      res.status(401).json({ success: false, error: 'Token invalide' });
      return;
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ success: false, error: 'Authentification échouée' });
  }
}

/**
 * Optional auth - doesn't fail if no token, just doesn't set user
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      req.user = { id: decoded.sub, email: decoded.email };
    } catch {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        req.user = { id: user.id, email: user.email };
      }
    }
  } catch {
    // Ignore errors for optional auth
  }
  next();
}

/**
 * Rate limiter with plan-based limits
 */
const LIMITS = {
  free: {
    tasks_per_day: 50,
    chat_messages_per_day: 100,
    focus_sessions_per_day: 50,
    goals_count: 5,
  },
  premium: {
    tasks_per_day: Infinity,
    chat_messages_per_day: Infinity,
    focus_sessions_per_day: Infinity,
    goals_count: 20,
  },
} as const;

type LimitType = 'tasks' | 'chat' | 'focus' | 'goals';

export async function checkLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  type: LimitType
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Non authentifié' });
    return;
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
      select: { plan: true },
    });

    const plan = (profile?.plan as 'free' | 'premium') || 'free';
    const limits = LIMITS[plan];
    const today = new Date().toISOString().split('T')[0];

    let count = 0;
    let limit = 0;
    let limitMessage = '';

    switch (type) {
      case 'tasks':
        count = await prisma.task.count({
          where: { userId: req.user.id, date: today },
        });
        limit = limits.tasks_per_day;
        limitMessage = `Plan ${plan} limité à ${limit} tâches/jour`;
        break;
        
      case 'chat':
        count = await prisma.chatMessage.count({
          where: {
            userId: req.user.id,
            role: 'user',
            createdAt: { gte: new Date(today) },
          },
        });
        limit = limits.chat_messages_per_day;
        limitMessage = `Plan ${plan} limité à ${limit} messages/jour`;
        break;
        
      case 'focus':
        count = await prisma.focusSession.count({
          where: {
            userId: req.user.id,
            startedAt: { gte: new Date(today) },
          },
        });
        limit = limits.focus_sessions_per_day;
        limitMessage = `Plan ${plan} limité à ${limit} sessions focus/jour`;
        break;
        
      case 'goals':
        count = await prisma.goal.count({
          where: { userId: req.user.id, isActive: true },
        });
        limit = limits.goals_count;
        limitMessage = `Plan ${plan} limité à ${limit} objectifs actifs`;
        break;
    }

    if (count >= limit) {
      res.status(429).json({
        success: false,
        error: limitMessage,
        upgrade: plan === 'free',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Limit check error:', error);
    next(); // Don't block on errors
  }
}

// Convenience middleware functions
export const checkTaskLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  checkLimit(req, res, next, 'tasks');

export const checkChatLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  checkLimit(req, res, next, 'chat');

export const checkFocusLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  checkLimit(req, res, next, 'focus');

export const checkGoalLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  checkLimit(req, res, next, 'goals');
