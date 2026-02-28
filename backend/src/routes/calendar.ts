// calendar routes - google and apple calendar sync

import { Router, Response } from 'express';
import { google } from 'googleapis';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest, FreeSlot } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Google OAuth2 config
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/google/callback'
);

// ─── Google Calendar ───

// Get Google auth URL
router.get('/google/auth-url', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      prompt: 'consent',
    });

    res.json({ success: true, data: { url } });
  } catch (error) {
    console.error('Google auth URL error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Google OAuth callback
router.get('/google/callback', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, state } = req.query;
    const userId = state as string; // Pass userId in state param

    if (!code || !userId) {
      res.status(400).json({ success: false, error: 'Code ou state manquant' });
      return;
    }

    const { tokens } = await oauth2Client.getToken(code as string);

    await prisma.profile.update({
      where: { userId },
      data: {
        googleCalendarConnected: true,
        googleRefreshToken: tokens.refresh_token,
      },
    });

    // Redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?calendar=success`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?calendar=error`);
  }
});

// Sync Google Calendar events
router.post('/google/sync', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { googleRefreshToken: true, googleCalendarConnected: true },
    });

    if (!profile?.googleCalendarConnected || !profile.googleRefreshToken) {
      res.status(400).json({ success: false, error: 'Google Calendar non connecté' });
      return;
    }

    oauth2Client.setCredentials({ refresh_token: profile.googleRefreshToken });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: nextWeek.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Clear old events
    await prisma.calendarEvent.deleteMany({
      where: { userId: req.user!.id, source: 'google' },
    });

    // Insert new events
    const imported = [];
    for (const event of events.data.items || []) {
      if (!event.start?.dateTime && !event.start?.date) continue;

      const calEvent = await prisma.calendarEvent.create({
        data: {
          userId: req.user!.id,
          eventId: event.id || '',
          source: 'google',
          title: event.summary || 'Sans titre',
          start: new Date(event.start.dateTime || event.start.date || ''),
          end: new Date(event.end?.dateTime || event.end?.date || event.start.dateTime || ''),
          allDay: !event.start.dateTime,
          color: event.colorId,
        },
      });
      imported.push(calEvent);
    }

    res.json({
      success: true,
      data: { imported: imported.length },
      message: `${imported.length} événements importés`,
    });
  } catch (error) {
    console.error('Google sync error:', error);
    res.status(500).json({ success: false, error: 'Erreur de synchronisation' });
  }
});

// Disconnect Google Calendar
router.delete('/google/disconnect', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.profile.update({
      where: { userId: req.user!.id },
      data: {
        googleCalendarConnected: false,
        googleRefreshToken: null,
      },
    });

    await prisma.calendarEvent.deleteMany({
      where: { userId: req.user!.id, source: 'google' },
    });

    res.json({ success: true, message: 'Google Calendar déconnecté' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ─── Get Events & Free Slots ───

// Get calendar events
router.get('/events', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(start as string) : new Date();
    const endDate = end ? new Date(end as string) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: req.user!.id,
        start: { gte: startDate, lte: endDate },
      },
      orderBy: { start: 'asc' },
    });

    res.json({ success: true, data: { events } });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get free time slots
router.get('/free-slots', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { wakeTime: true, sleepTime: true },
    });

    const dayStart = new Date(`${date}T${profile?.wakeTime || '07:00'}:00`);
    const dayEnd = new Date(`${date}T${profile?.sleepTime || '23:00'}:00`);

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: req.user!.id,
        start: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { start: 'asc' },
    });

    // Calculate free slots
    const freeSlots: FreeSlot[] = [];
    let currentTime = dayStart;

    for (const event of events) {
      if (event.start > currentTime) {
        const durationMin = Math.floor((event.start.getTime() - currentTime.getTime()) / 60000);
        if (durationMin >= 15) { // Min 15 min slot
          freeSlots.push({
            start: currentTime,
            end: event.start,
            durationMin,
          });
        }
      }
      currentTime = event.end > currentTime ? event.end : currentTime;
    }

    // Add remaining time until day end
    if (currentTime < dayEnd) {
      const durationMin = Math.floor((dayEnd.getTime() - currentTime.getTime()) / 60000);
      if (durationMin >= 15) {
        freeSlots.push({
          start: currentTime,
          end: dayEnd,
          durationMin,
        });
      }
    }

    res.json({ success: true, data: { freeSlots } });
  } catch (error) {
    console.error('Free slots error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Connection status
router.get('/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user!.id },
      select: { googleCalendarConnected: true, appleCalendarConnected: true },
    });

    res.json({
      success: true,
      data: {
        google: profile?.googleCalendarConnected || false,
        apple: profile?.appleCalendarConnected || false,
      },
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
