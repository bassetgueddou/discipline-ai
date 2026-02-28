// gamification routes - xp, levels, badges, challenges

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';
import { 
  getLevelInfo, 
  getBadgesWithStatus, 
  getTodayChallenges,
} from '../services/gamificationService.js';

const router = Router();

// Get gamification stats
router.get('/stats', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: {
        xp: true,
        level: true,
        streakDays: true,
        longestStreak: true,
        badges: true,
        totalTasksCompleted: true,
        totalFocusMinutes: true,
      },
    });

    if (!profile) {
      res.status(404).json({ success: false, error: 'Profil non trouvé' });
      return;
    }

    const levelInfo = getLevelInfo(profile.xp);
    const badges = getBadgesWithStatus(profile.badges);
    const challenges = await getTodayChallenges(req.user!.id);

    res.json({
      success: true,
      data: {
        xp: profile.xp,
        level: profile.level,
        levelInfo,
        streak: {
          current: profile.streakDays,
          longest: profile.longestStreak,
        },
        badges,
        challenges,
        totals: {
          tasksCompleted: profile.totalTasksCompleted,
          focusMinutes: profile.totalFocusMinutes,
        },
      },
    });
  } catch (error) {
    console.error('Get gamification stats error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get XP history
router.get('/xp-history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await prisma.xpTransaction.findMany({
      where: {
        userId: req.user!.id,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Group by day
    const byDay: Record<string, number> = {};
    for (const tx of transactions) {
      const day = tx.createdAt.toISOString().split('T')[0];
      byDay[day] = (byDay[day] || 0) + tx.amount;
    }

    res.json({
      success: true,
      data: {
        transactions,
        byDay,
      },
    });
  } catch (error) {
    console.error('XP history error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get all badges
router.get('/badges', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { badges: true },
    });

    const badges = getBadgesWithStatus(profile?.badges || []);

    res.json({
      success: true,
      data: { badges },
    });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get today's challenges
router.get('/challenges', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const challenges = await getTodayChallenges(req.user!.id);

    res.json({
      success: true,
      data: { challenges },
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get leaderboard (weekly)
router.get('/leaderboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    // Get top users by XP earned this week
    const topUsers = await prisma.xpTransaction.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: weekStart },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    // Get profile info for top users
    const leaderboard = await Promise.all(
      topUsers.map(async (entry, index) => {
        const profile = await prisma.profile.findUnique({
          where: { userId: entry.userId },
          select: { name: true, avatarUrl: true, level: true },
        });
        return {
          rank: index + 1,
          userId: entry.userId,
          name: profile?.name || 'Anonyme',
          avatarUrl: profile?.avatarUrl,
          level: profile?.level || 1,
          xpThisWeek: entry._sum.amount || 0,
          isCurrentUser: entry.userId === req.user!.id,
        };
      })
    );

    res.json({
      success: true,
      data: { leaderboard },
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
