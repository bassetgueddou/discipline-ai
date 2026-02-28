// goals routes - objectives tracking

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAuth, checkGoalLimit } from '../middleware/auth.js';

const router = Router();

// Get all goals
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user!.id },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        tasks: {
          where: { done: false },
          take: 3,
        },
      },
    });

    res.json({ success: true, data: { goals } });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Create goal
router.post('/', requireAuth, checkGoalLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, category, targetValue, unit, deadline, color, icon } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Nom requis' });
      return;
    }

    const goal = await prisma.goal.create({
      data: {
        userId: req.user!.id,
        name,
        description,
        category: category || 'général',
        targetValue,
        unit,
        deadline: deadline ? new Date(deadline) : null,
        color: color || '#f97316',
        icon: icon || '🎯',
      },
    });

    res.status(201).json({ success: true, data: { goal } });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création' });
  }
});

// Update goal
router.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.goal.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Objectif non trouvé' });
      return;
    }

    const goal = await prisma.goal.update({
      where: { id },
      data: req.body,
    });

    res.json({ success: true, data: { goal } });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour' });
  }
});

// Update goal progress
router.post('/:id/progress', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { value, increment } = req.body;

    const goal = await prisma.goal.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!goal) {
      res.status(404).json({ success: false, error: 'Objectif non trouvé' });
      return;
    }

    const newValue = increment ? goal.currentValue + (value || 1) : value;
    const isCompleted = goal.targetValue ? newValue >= goal.targetValue : false;

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        currentValue: newValue,
        isCompleted,
      },
    });

    res.json({
      success: true,
      data: { goal: updated },
      message: isCompleted ? '🎉 Objectif atteint !' : null,
    });
  } catch (error) {
    console.error('Progress error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Delete goal
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.goal.deleteMany({
      where: { id, userId: req.user!.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
