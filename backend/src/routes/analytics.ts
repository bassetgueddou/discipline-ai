// analytics routes - stats and graphs data

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get dashboard stats
router.get('/dashboard', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date(today);
    
    const [profile, todayTasks, todayFocus, streak] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: req.user!.id },
        select: { xp: true, level: true, streakDays: true, totalTasksCompleted: true },
      }),
      prisma.task.findMany({
        where: { userId: req.user!.id, date: today },
      }),
      prisma.focusSession.aggregate({
        where: { 
          userId: req.user!.id, 
          startedAt: { gte: todayStart },
          endedAt: { not: null },
          phase: 'focus',
        },
        _sum: { durationSec: true },
        _count: true,
      }),
      prisma.profile.findUnique({
        where: { userId: req.user!.id },
        select: { streakDays: true, longestStreak: true },
      }),
    ]);

    const completedTasks = todayTasks.filter(t => t.done).length;
    const totalTasks = todayTasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const focusMinutes = Math.floor((todayFocus._sum.durationSec || 0) / 60);

    // Calculate discipline score (0-100)
    const disciplineScore = Math.min(100, Math.round(
      (completionRate * 0.4) +
      (Math.min(focusMinutes, 120) / 120 * 30) +
      (Math.min(streak?.streakDays || 0, 30) / 30 * 30)
    ));

    res.json({
      success: true,
      // top level for frontend compat
      today: {
        tasks: todayTasks,
        score: disciplineScore,
        completionRate,
        focusMinutes,
        pomodorosCompleted: todayFocus._count,
      },
      user: {
        xp: profile?.xp || 0,
        level: profile?.level || 1,
        streak: streak?.streakDays || 0,
        longestStreak: streak?.longestStreak || 0,
        tasksCompleted: profile?.totalTasksCompleted || 0,
      },
      data: {
        today: {
          tasks: { completed: completedTasks, total: totalTasks, rate: completionRate },
          focus: { minutes: focusMinutes, sessions: todayFocus._count },
          disciplineScore,
        },
        streak: {
          current: streak?.streakDays || 0,
          longest: streak?.longestStreak || 0,
        },
        totals: {
          xp: profile?.xp || 0,
          level: profile?.level || 1,
          tasksCompleted: profile?.totalTasksCompleted || 0,
        },
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get weekly stats
router.get('/weekly', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = 7;
    const stats = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [tasks, focus, xp] = await Promise.all([
        prisma.task.findMany({
          where: { userId: req.user!.id, date: dateStr },
          select: { done: true },
        }),
        prisma.focusSession.aggregate({
          where: {
            userId: req.user!.id,
            startedAt: { gte: dayStart, lt: dayEnd },
            endedAt: { not: null },
            phase: 'focus',
          },
          _sum: { durationSec: true },
        }),
        prisma.xpTransaction.aggregate({
          where: {
            userId: req.user!.id,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
          _sum: { amount: true },
        }),
      ]);

      const completed = tasks.filter(t => t.done).length;
      const total = tasks.length;

      stats.push({
        date: dateStr,
        dayName: date.toLocaleDateString('fr-FR', { weekday: 'short' }),
        tasks: { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 },
        focusMinutes: Math.floor((focus._sum.durationSec || 0) / 60),
        xpEarned: xp._sum.amount || 0,
      });
    }

    // Calculate totals
    const totals = {
      tasksCompleted: stats.reduce((sum, d) => sum + d.tasks.completed, 0),
      tasksTotal: stats.reduce((sum, d) => sum + d.tasks.total, 0),
      focusMinutes: stats.reduce((sum, d) => sum + d.focusMinutes, 0),
      xpEarned: stats.reduce((sum, d) => sum + d.xpEarned, 0),
    };

    const avgCompletionRate = totals.tasksTotal > 0
      ? Math.round((totals.tasksCompleted / totals.tasksTotal) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        days: stats,
        totals: { ...totals, avgCompletionRate },
      },
    });
  } catch (error) {
    console.error('Weekly stats error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get monthly heatmap data
router.get('/heatmap', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split('T')[0];

    const tasks = await prisma.task.groupBy({
      by: ['date'],
      where: {
        userId: req.user!.id,
        date: { gte: startStr },
        done: true,
      },
      _count: true,
    });

    const heatmap: Record<string, number> = {};
    for (const day of tasks) {
      heatmap[day.date] = day._count;
    }

    res.json({ success: true, data: { heatmap } });
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get productivity insights
router.get('/insights', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tasks = await prisma.task.findMany({
      where: {
        userId: req.user!.id,
        createdAt: { gte: thirtyDaysAgo },
        done: true,
        completedAt: { not: null },
      },
      select: { completedAt: true, scheduledTime: true, priority: true },
    });

    // Analyze best hours
    const hourCounts: Record<number, number> = {};
    for (const task of tasks) {
      if (task.completedAt) {
        const hour = task.completedAt.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }

    const bestHour = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])[0];

    // Priority distribution
    const priorityCounts = { high: 0, med: 0, low: 0 };
    for (const task of tasks) {
      const p = task.priority as 'high' | 'med' | 'low';
      if (priorityCounts[p] !== undefined) {
        priorityCounts[p]++;
      }
    }

    res.json({
      success: true,
      data: {
        insights: {
          bestHour: bestHour ? parseInt(bestHour[0]) : null,
          bestHourLabel: bestHour ? `${bestHour[0]}h - ${parseInt(bestHour[0]) + 1}h` : null,
          priorityDistribution: priorityCounts,
          totalCompleted: tasks.length,
        },
      },
    });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
