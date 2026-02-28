// main entry point - this is where everything starts
// dont fuck with this file unless you know what youre doing

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cron from 'node-cron';

import prisma from './lib/prisma.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import tasksRoutes from './routes/tasks.js';
import coachRoutes from './routes/coach.js';
import focusRoutes from './routes/focus.js';
import goalsRoutes from './routes/goals.js';
import gamificationRoutes from './routes/gamification.js';
import calendarRoutes from './routes/calendar.js';
import analyticsRoutes from './routes/analytics.js';
import { updateStreaks, generateDailyChallenges } from './services/gamificationService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// ─── Health Check ───
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/analytics', analyticsRoutes);

// ─── Error Handler ───
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// ─── 404 Handler ───
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Cron Jobs ───
// Update streaks at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('🔄 Running daily streak update...');
  try {
    await updateStreaks();
    await generateDailyChallenges();
    console.log('✅ Daily jobs completed');
  } catch (error) {
    console.error('❌ Daily jobs failed:', error);
  }
}, { timezone: 'Europe/Paris' });

// ─── Start Server ───
async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║     🔥 DISCIPLINE AI — Backend v2.0 (TypeScript)         ║
║     📡 Running on http://localhost:${PORT}                  ║
║     🎮 Gamification: Active                              ║
║     🤖 AI Coach: OpenAI GPT-4o                           ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
