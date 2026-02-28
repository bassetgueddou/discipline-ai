require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const coachRoutes = require('./routes/coach');
const focusRoutes = require('./routes/focus');
const analyticsRoutes = require('./routes/analytics');
const profileRoutes = require('./routes/profile');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security Middleware ───
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// ─── CORS ───
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:4173',
  // Ajouter ici l'URL Vercel en prod
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqué pour: ${origin}`));
    }
  },
  credentials: true
}));

// ─── Body Parser ───
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logger ───
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health Check ───
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'DISCIPLINE AI API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/profile', profileRoutes);

// ─── 404 Handler ───
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée', path: req.path });
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV === 'development') console.error(err.stack);

  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: 'CORS non autorisé' });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur'
      : err.message
  });
});

// ─── Start ───
app.listen(PORT, () => {
  console.log(`
🔥 DISCIPLINE AI Backend
─────────────────────────
✅ Serveur: http://localhost:${PORT}
✅ Health:  http://localhost:${PORT}/health
✅ Env:     ${process.env.NODE_ENV || 'development'}
─────────────────────────
  `);
});

module.exports = app;
