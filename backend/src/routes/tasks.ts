// tasks routes - crud + xp rewards

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAuth, checkTaskLimit } from '../middleware/auth.js';
import { awardTaskXp, calculateTaskXp } from '../services/gamificationService.js';
import { generateDailyPlan, suggestTasks } from '../services/aiService.js';

const router = Router();

// Get tasks for a date
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const tasks = await prisma.task.findMany({
      where: { userId: req.user!.id, date },
      orderBy: [
        { scheduledTime: 'asc' },
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    res.json({ success: true, tasks, data: { tasks } });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Create task
router.post('/', requireAuth, checkTaskLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, date, scheduledTime, durationMin, priority, goalId, goalCategory, tags } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Nom de tâche requis' });
      return;
    }

    const xpReward = calculateTaskXp(priority || 'med');

    const task = await prisma.task.create({
      data: {
        userId: req.user!.id,
        name,
        description,
        date: date || new Date().toISOString().split('T')[0],
        scheduledTime,
        durationMin: durationMin || 30,
        priority: priority || 'med',
        goalId,
        goalCategory,
        tags: tags || [],
        xpReward,
      },
    });

    res.status(201).json({ success: true, task, data: { task } });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création' });
  }
});

// Update task handler (shared by PUT and PATCH)
const handleUpdateTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check ownership
    const existing = await prisma.task.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Tâche non trouvée' });
      return;
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...updates,
        ...(updates.priority && { xpReward: calculateTaskXp(updates.priority) }),
      },
    });

    res.json({ success: true, task, data: { task } });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour' });
  }
};

router.put('/:id', requireAuth, handleUpdateTask);
router.patch('/:id', requireAuth, handleUpdateTask);

// Complete task (with XP reward)
router.post('/:id/complete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Tâche non trouvée' });
      return;
    }

    if (task.done) {
      res.status(400).json({ success: false, error: 'Tâche déjà complétée' });
      return;
    }

    // Mark as done
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        done: true,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    // Award XP and check badges
    const xpResult = await awardTaskXp(req.user!.id, id, task.priority);

    res.json({
      success: true,
      data: {
        task: updatedTask,
        xp: {
          earned: xpResult.xpEarned,
          total: xpResult.newLevel,
          leveledUp: xpResult.leveledUp,
          newBadges: xpResult.newBadges,
        },
      },
      message: `+${xpResult.xpEarned} XP ! ${xpResult.leveledUp ? '🎉 Level up !' : ''}`,
    });
  } catch (error) {
    console.error('Complete task error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Uncomplete task
router.post('/:id/uncomplete', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.update({
      where: { id },
      data: {
        done: false,
        status: 'pending',
        completedAt: null,
      },
    });

    res.json({ success: true, data: { task } });
  } catch (error) {
    console.error('Uncomplete task error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Delete task
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.task.deleteMany({
      where: { id, userId: req.user!.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Generate AI plan
router.post('/generate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, regenerate } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      res.status(404).json({ success: false, error: 'Profil non trouvé' });
      return;
    }

    // Delete existing AI tasks if regenerating
    if (regenerate) {
      await prisma.task.deleteMany({
        where: { userId: req.user!.id, date: targetDate, aiGenerated: true },
      });
    }

    // Generate plan
    const plan = await generateDailyPlan(profile, targetDate);

    // Create tasks
    const createdTasks = [];
    for (const taskData of plan.tasks) {
      const task = await prisma.task.create({
        data: {
          userId: req.user!.id,
          name: taskData.name,
          date: targetDate,
          scheduledTime: taskData.time,
          durationMin: taskData.duration_min,
          priority: taskData.priority,
          goalCategory: taskData.goal_category,
          aiGenerated: true,
          aiReason: plan.coaching_message,
          xpReward: calculateTaskXp(taskData.priority),
          tags: [],
        },
      });
      createdTasks.push(task);
    }

    res.json({
      success: true,
      tasks: createdTasks,
      plan: {
        intention: plan.daily_intention,
        message: plan.coaching_message,
        energyPeak: plan.energy_peak,
        breaks: plan.recommended_breaks,
      },
      data: {
        tasks: createdTasks,
        plan: {
          intention: plan.daily_intention,
          message: plan.coaching_message,
          energyPeak: plan.energy_peak,
          breaks: plan.recommended_breaks,
        },
      },
    });
  } catch (error) {
    console.error('Generate plan error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la génération' });
  }
});

// Get task suggestions
router.get('/suggestions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    const recentTasks = await prisma.task.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { name: true, done: true, priority: true },
    });

    const currentTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const suggestions = await suggestTasks(profile || {}, recentTasks, currentTime);

    res.json({ success: true, data: { suggestions } });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
