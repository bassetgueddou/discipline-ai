// gamification service - all the xp/level/badge shit
// this is what makes the app addictive lol

import prisma from '../lib/prisma.js';
import { XP_REWARDS, LEVELS, BADGES, Level, BadgeDefinition } from '../types/index.js';

// XP functions

/**
 * Add XP to a user and handle level ups
 */
export async function addXp(
  userId: string,
  amount: number,
  reason: string,
  source: string,
  referenceId?: string,
  referenceType?: string
): Promise<{ newXp: number; newLevel: number; leveledUp: boolean; newBadges: string[] }> {
  // Get current profile
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { xp: true, level: true, badges: true },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  const oldLevel = profile.level;
  const newXp = profile.xp + amount;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > oldLevel;

  // Log XP transaction
  await prisma.xpTransaction.create({
    data: {
      userId,
      amount,
      reason,
      source,
      referenceId,
      referenceType,
    },
  });

  // Update profile
  await prisma.profile.update({
    where: { userId },
    data: {
      xp: newXp,
      level: newLevel,
    },
  });

  // Check for new badges
  const newBadges = await checkAndAwardBadges(userId, profile.badges);

  return { newXp, newLevel, leveledUp, newBadges };
}

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) {
      return LEVELS[i].level;
    }
  }
  return 1;
}

/**
 * Get level info from XP
 */
export function getLevelInfo(xp: number): Level & { progress: number; xpToNext: number } {
  const level = calculateLevel(xp);
  const levelData = LEVELS.find(l => l.level === level) || LEVELS[0];
  const nextLevel = LEVELS.find(l => l.level === level + 1);
  
  const xpInLevel = xp - levelData.minXp;
  const xpForLevel = (nextLevel?.minXp || levelData.maxXp) - levelData.minXp;
  const progress = Math.min(xpInLevel / xpForLevel, 1);
  const xpToNext = Math.max(0, (nextLevel?.minXp || 0) - xp);

  return {
    ...levelData,
    progress,
    xpToNext,
  };
}

// streak system - keeps users coming back

/**
 * Update user's streak (called on task completion)
 */
export async function updateUserStreak(userId: string): Promise<{ streakDays: number; streakBroken: boolean }> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { streakDays: true, longestStreak: true, lastActiveAt: true },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  const now = new Date();
  const lastActive = new Date(profile.lastActiveAt);
  const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
  
  let newStreak = profile.streakDays;
  let streakBroken = false;

  if (daysSinceActive === 0) {
    // Same day, no change
  } else if (daysSinceActive === 1) {
    // Consecutive day, increase streak
    newStreak += 1;
  } else {
    // Streak broken
    newStreak = 1;
    streakBroken = true;
  }

  const newLongestStreak = Math.max(profile.longestStreak, newStreak);

  await prisma.profile.update({
    where: { userId },
    data: {
      streakDays: newStreak,
      longestStreak: newLongestStreak,
      lastActiveAt: now,
    },
  });

  // Award streak bonus XP
  if (!streakBroken && newStreak > 1) {
    const bonusXp = XP_REWARDS.STREAK_BONUS * Math.min(newStreak, 30); // Cap at 30x
    await addXp(userId, bonusXp, `Streak bonus (${newStreak} jours)`, 'streak');
  }

  return { streakDays: newStreak, streakBroken };
}

/**
 * Global streak update (run at midnight)
 */
export async function updateStreaks(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Find users who were active yesterday but haven't completed any tasks today
  const profiles = await prisma.profile.findMany({
    where: {
      streakDays: { gt: 0 },
      lastActiveAt: { lt: yesterday },
    },
    select: { userId: true },
  });

  // Reset their streaks
  for (const profile of profiles) {
    await prisma.profile.update({
      where: { userId: profile.userId },
      data: { streakDays: 0 },
    });
  }

  console.log(`Reset ${profiles.length} broken streaks`);
}

// badge system - dopamine hits

/**
 * Check and award badges based on user's achievements
 */
export async function checkAndAwardBadges(userId: string, currentBadges: string[]): Promise<string[]> {
  const newBadges: string[] = [];

  // Get user stats
  const [profile, taskCount, focusMinutes] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: { streakDays: true, totalTasksCompleted: true, totalFocusMinutes: true },
    }),
    prisma.task.count({ where: { userId, done: true } }),
    prisma.focusSession.aggregate({
      where: { userId },
      _sum: { durationSec: true },
    }),
  ]);

  if (!profile) return [];

  const totalFocusMin = Math.floor((focusMinutes._sum.durationSec || 0) / 60);

  // Check each badge
  for (const badge of BADGES) {
    if (currentBadges.includes(badge.id)) continue;

    let earned = false;

    switch (badge.requirement) {
      case 'complete_1_task':
        earned = taskCount >= 1;
        break;
      case 'streak_3':
        earned = profile.streakDays >= 3;
        break;
      case 'streak_7':
        earned = profile.streakDays >= 7;
        break;
      case 'streak_30':
        earned = profile.streakDays >= 30;
        break;
      case 'complete_100_tasks':
        earned = taskCount >= 100;
        break;
      case 'focus_1000_min':
        earned = totalFocusMin >= 1000;
        break;
      // Other badges checked elsewhere (time-based, etc.)
    }

    if (earned) {
      newBadges.push(badge.id);
      
      // Award badge
      await prisma.profile.update({
        where: { userId },
        data: {
          badges: { push: badge.id },
        },
      });

      // Award badge XP
      await addXp(userId, badge.xpReward, `Badge débloqué: ${badge.name}`, 'badge', badge.id, 'badge');
    }
  }

  return newBadges;
}

/**
 * Get all badges with unlock status for a user
 */
export function getBadgesWithStatus(unlockedBadges: string[]): Array<BadgeDefinition & { unlocked: boolean }> {
  return BADGES.map(badge => ({
    ...badge,
    unlocked: unlockedBadges.includes(badge.id),
  }));
}

// daily challenges - more reasons to open the app

const CHALLENGE_TEMPLATES = [
  { type: 'tasks', description: 'Complète {n} tâches', targets: [3, 5, 7], xpBase: 50 },
  { type: 'focus', description: 'Fais {n} minutes de focus', targets: [30, 60, 90], xpBase: 75 },
  { type: 'tasks', description: 'Complète toutes tes tâches prioritaires', targets: [1], xpBase: 100 },
  { type: 'streak', description: 'Maintiens ton streak', targets: [1], xpBase: 50 },
] as const;

/**
 * Generate daily challenges for all active users
 */
export async function generateDailyChallenges(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  // Get all active users (active in last 7 days)
  const activeProfiles = await prisma.profile.findMany({
    where: {
      lastActiveAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { userId: true, disciplineLevel: true },
  });

  for (const profile of activeProfiles) {
    // Check if challenges already exist for today
    const existing = await prisma.dailyChallenge.count({
      where: { userId: profile.userId, date: today },
    });

    if (existing > 0) continue;

    // Generate 2-3 challenges based on user's level
    const numChallenges = Math.min(3, Math.ceil(profile.disciplineLevel / 3));
    const shuffled = [...CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);

    for (let i = 0; i < numChallenges; i++) {
      const template = shuffled[i % shuffled.length];
      const targetIndex = Math.min(
        Math.floor(profile.disciplineLevel / 4),
        template.targets.length - 1
      );
      const target = template.targets[targetIndex];
      const xpReward = template.xpBase * (targetIndex + 1);

      await prisma.dailyChallenge.create({
        data: {
          userId: profile.userId,
          date: today,
          type: template.type,
          description: template.description.replace('{n}', String(target)),
          target,
          current: 0,
          xpReward,
          expiresAt: tomorrow,
        },
      });
    }
  }

  console.log(`Generated challenges for ${activeProfiles.length} users`);
}

/**
 * Update challenge progress
 */
export async function updateChallengeProgress(
  userId: string,
  type: string,
  increment: number = 1
): Promise<{ completed: boolean; xpEarned: number }[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const challenges = await prisma.dailyChallenge.findMany({
    where: {
      userId,
      date: today,
      type,
      completed: false,
    },
  });

  const results: { completed: boolean; xpEarned: number }[] = [];

  for (const challenge of challenges) {
    const newCurrent = challenge.current + increment;
    const completed = newCurrent >= challenge.target;

    await prisma.dailyChallenge.update({
      where: { id: challenge.id },
      data: {
        current: newCurrent,
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    if (completed) {
      await addXp(
        userId,
        challenge.xpReward,
        `Challenge complété: ${challenge.description}`,
        'challenge',
        challenge.id,
        'challenge'
      );
    }

    results.push({ completed, xpEarned: completed ? challenge.xpReward : 0 });
  }

  return results;
}

/**
 * Get today's challenges for a user
 */
export async function getTodayChallenges(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  return prisma.dailyChallenge.findMany({
    where: { userId, date: today },
    orderBy: { type: 'asc' },
  });
}

// task xp calc

/**
 * Calculate XP reward for a task based on priority
 */
export function calculateTaskXp(priority: string): number {
  switch (priority) {
    case 'high':
      return XP_REWARDS.TASK_HIGH;
    case 'med':
      return XP_REWARDS.TASK_MED;
    case 'low':
      return XP_REWARDS.TASK_LOW;
    default:
      return XP_REWARDS.TASK_MED;
  }
}

/**
 * Award XP for completing a task
 */
export async function awardTaskXp(
  userId: string,
  taskId: string,
  priority: string
): Promise<{ xpEarned: number; newLevel: number; leveledUp: boolean; newBadges: string[] }> {
  const xp = calculateTaskXp(priority);
  
  const result = await addXp(userId, xp, `Tâche complétée`, 'task', taskId, 'task');
  
  // Update task stats
  await prisma.profile.update({
    where: { userId },
    data: { totalTasksCompleted: { increment: 1 } },
  });

  // Update challenge progress
  await updateChallengeProgress(userId, 'tasks', 1);

  // Update streak
  await updateUserStreak(userId);

  return { xpEarned: xp, ...result };
}
