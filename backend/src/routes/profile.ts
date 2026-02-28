// profile routes - user data

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getLevelInfo } from '../services/gamificationService.js';

const router = Router();

// Get profile
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      res.status(404).json({ success: false, error: 'Profil non trouvé' });
      return;
    }

    const levelInfo = getLevelInfo(profile.xp);

    res.json({
      success: true,
      data: {
        ...profile,
        levelInfo,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Update profile (onboarding or settings)
router.put('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      goals,
      obstacles,
      disciplineLevel,
      energyLevel,
      chronotype,
      wakeTime,
      sleepTime,
      availableHours,
      workStyle,
      avatarUrl,
    } = req.body;

    const profile = await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: {
        ...(name !== undefined && { name }),
        ...(goals !== undefined && { goals }),
        ...(obstacles !== undefined && { obstacles }),
        ...(disciplineLevel !== undefined && { disciplineLevel }),
        ...(energyLevel !== undefined && { energyLevel }),
        ...(chronotype !== undefined && { chronotype }),
        ...(wakeTime !== undefined && { wakeTime }),
        ...(sleepTime !== undefined && { sleepTime }),
        ...(availableHours !== undefined && { availableHours }),
        ...(workStyle !== undefined && { workStyle }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      create: {
        userId: req.user!.id,
        email: req.user!.email,
        name: name || null,
        goals: goals || [],
        obstacles: obstacles || [],
        badges: [],
        disciplineLevel: disciplineLevel || 5,
        energyLevel: energyLevel || 3,
        chronotype: chronotype || 'neutral',
        wakeTime: wakeTime || '07:00',
        sleepTime: sleepTime || '23:00',
        availableHours: availableHours || 8,
        workStyle: workStyle || 'pomodoro',
      },
    });

    const levelInfo = getLevelInfo(profile.xp);

    res.json({
      success: true,
      profile: { ...profile, levelInfo },
      data: { ...profile, levelInfo },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour' });
  }
});

// Complete onboarding
router.post('/onboarding', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // accept both camelCase and snake_case from frontend
    const {
      name,
      goals,
      obstacles,
      disciplineLevel, discipline_level,
      energyLevel, energy_level,
      chronotype,
      wakeTime, wake_time,
      sleepTime, sleep_time,
      availableHours, available_hours,
      workStyle, work_style,
    } = req.body;

    const finalDisciplineLevel = disciplineLevel ?? discipline_level ?? 5;
    const finalEnergyLevel = energyLevel ?? energy_level ?? 3;
    const finalWakeTime = wakeTime ?? wake_time ?? '07:00';
    const finalSleepTime = sleepTime ?? sleep_time ?? '23:00';
    const finalAvailableHours = availableHours ?? available_hours ?? 8;
    const finalWorkStyle = workStyle ?? work_style ?? 'pomodoro';

    // Validation
    if (!name || !goals?.length) {
      res.status(400).json({ success: false, error: 'Nom et objectifs requis' });
      return;
    }

    const profile = await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: {
        name,
        goals,
        obstacles: obstacles || [],
        disciplineLevel: finalDisciplineLevel,
        energyLevel: finalEnergyLevel,
        chronotype: chronotype || 'neutral',
        wakeTime: finalWakeTime,
        sleepTime: finalSleepTime,
        availableHours: finalAvailableHours,
        workStyle: finalWorkStyle,
      },
      create: {
        userId: req.user!.id,
        email: req.user!.email,
        name,
        goals,
        obstacles: obstacles || [],
        badges: [],
        disciplineLevel: finalDisciplineLevel,
        energyLevel: finalEnergyLevel,
        chronotype: chronotype || 'neutral',
        wakeTime: finalWakeTime,
        sleepTime: finalSleepTime,
        availableHours: finalAvailableHours,
        workStyle: finalWorkStyle,
      },
    });

    // Create default goals from the goals list
    for (const goalName of goals) {
      await prisma.goal.create({
        data: {
          userId: req.user!.id,
          name: goalName,
          category: 'principal',
          color: '#f97316',
          icon: '🎯',
        },
      });
    }

    res.json({
      success: true,
      profile,
      data: profile,
      message: 'Onboarding complété ! Bienvenue dans DISCIPLINE AI 🔥',
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'onboarding' });
  }
});

export default router;
