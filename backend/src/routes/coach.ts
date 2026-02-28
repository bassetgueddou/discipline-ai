// coach routes - ai chat endpoint

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { requireAuth, checkChatLimit } from '../middleware/auth.js';
import { chatWithCoach, getDailyMotivation } from '../services/aiService.js';

const router = Router();

// Send message to coach (supports both /chat and /message)
const handleMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message } = req.body;

    if (!message?.trim()) {
      res.status(400).json({ success: false, error: 'Message requis' });
      return;
    }

    // Get profile
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!profile) {
      res.status(404).json({ success: false, error: 'Profil non trouvé' });
      return;
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        userId: req.user!.id,
        role: 'user',
        content: message.trim(),
      },
    });

    // Get recent chat history
    const history = await prisma.chatMessage.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { role: true, content: true },
    });

    // Reverse to get chronological order
    const messages = history.reverse();

    // Get AI response
    const response = await chatWithCoach(profile, messages);

    // Save assistant message
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        userId: req.user!.id,
        role: 'assistant',
        content: response.content,
        tokensUsed: response.tokensUsed,
        model: 'gpt-4o-mini',
      },
    });

    res.json({
      success: true,
      message: assistantMessage.content,
      data: {
        message: assistantMessage,
        fallback: response.fallback,
      },
    });
  } catch (error) {
    console.error('Coach chat error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

router.post('/chat', requireAuth, checkChatLimit, handleMessage);
router.post('/message', requireAuth, checkChatLimit, handleMessage);

// Get chat history
router.get('/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const messages = await prisma.chatMessage.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    res.json({ success: true, messages, data: { messages } });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get daily motivation (supports both /motivation and /daily-motivation)
const handleMotivation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
    });

    const motivation = await getDailyMotivation(profile || {});

    res.json({
      success: true,
      motivation,
      data: { motivation },
    });
  } catch (error) {
    console.error('Motivation error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

router.get('/motivation', requireAuth, handleMotivation);
router.get('/daily-motivation', requireAuth, handleMotivation);

// Clear chat history
router.delete('/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.chatMessage.deleteMany({
      where: { userId: req.user!.id },
    });

    res.json({ success: true, message: 'Historique effacé' });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
