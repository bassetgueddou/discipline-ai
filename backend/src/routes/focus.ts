// focus routes - pomodoro sessions

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAuth, checkFocusLimit } from '../middleware/auth.js';
import { addXp, updateChallengeProgress } from '../services/gamificationService.js';
import { XP_REWARDS } from '../types/index.js';

const router = Router();

// Start focus session
router.post('/start', requireAuth, checkFocusLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId, duration, phase } = req.body;

    const session = await prisma.focusSession.create({
      data: {
        userId: req.user!.id,
        taskId,
        durationSec: duration || 1500, // 25 min default
        phase: phase || 'focus',
        startedAt: new Date(),
      },
    });

    res.status(201).json({ success: true, data: { session } });
  } catch (error) {
    console.error('Start focus error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Complete focus session
router.post('/:id/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { interruptions, qualityRating, actualDuration } = req.body;

    const session = await prisma.focusSession.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      res.status(404).json({ success: false, error: 'Session non trouvée' });
      return;
    }

    const durationMin = Math.floor((actualDuration || session.durationSec) / 60);
    
    // Update session
    const updated = await prisma.focusSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
        interruptions: interruptions || 0,
        qualityRating,
        durationSec: actualDuration || session.durationSec,
        pomodorosCompleted: session.phase === 'focus' ? 1 : 0,
      },
    });

    // Award XP for focus phase
    let xpEarned = 0;
    if (session.phase === 'focus' && durationMin >= 20) {
      await addXp(
        req.user!.id,
        XP_REWARDS.POMODORO,
        `Pomodoro de ${durationMin} min`,
        'focus',
        id,
        'focus_session'
      );
      xpEarned = XP_REWARDS.POMODORO;

      // Update profile focus stats
      await prisma.profile.update({
        where: { userId: req.user!.id },
        data: { totalFocusMinutes: { increment: durationMin } },
      });

      // Update challenge progress
      await updateChallengeProgress(req.user!.id, 'focus', durationMin);
    }

    res.json({
      success: true,
      data: { session: updated, xpEarned },
      message: xpEarned > 0 ? `+${xpEarned} XP pour ta session focus ! 🧘` : null,
    });
  } catch (error) {
    console.error('Complete focus error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get today's focus stats
router.get('/today', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sessions = await prisma.focusSession.findMany({
      where: {
        userId: req.user!.id,
        startedAt: { gte: today },
        endedAt: { not: null },
      },
    });

    const stats = {
      totalFocusMinutes: sessions
        .filter(s => s.phase === 'focus')
        .reduce((sum, s) => sum + Math.floor(s.durationSec / 60), 0),
      pomodorosCompleted: sessions.filter(s => s.phase === 'focus' && s.pomodorosCompleted > 0).length,
      sessionsCount: sessions.length,
      avgQuality: sessions.filter(s => s.qualityRating).length > 0
        ? sessions.reduce((sum, s) => sum + (s.qualityRating || 0), 0) / sessions.filter(s => s.qualityRating).length
        : null,
    };

    res.json({ success: true, data: { stats, sessions } });
  } catch (error) {
    console.error('Today stats error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get focus history
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const sessions = await prisma.focusSession.findMany({
      where: {
        userId: req.user!.id,
        startedAt: { gte: startDate },
      },
      orderBy: { startedAt: 'desc' },
      include: {
        task: { select: { name: true } },
      },
    });

    res.json({ success: true, data: { sessions } });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
