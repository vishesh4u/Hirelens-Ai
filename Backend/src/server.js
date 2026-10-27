require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB, dbState } = require('./config/db');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render/Railway sit behind a proxy (needed for rate limiting)
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false })); // the single-file frontend uses inline scripts
  app.use(cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map((s) => s.trim()) : process.env.NODE_ENV === 'production' ? false : true,
    credentials: false
  }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    const database = dbState();
    res.status(database === 'connected' ? 200 : 503).json({ status: database === 'connected' ? 'ok' : 'degraded', database });
  });

  app.use('/api/auth', require('./routes/authRoutes'));
  // Everything below requires a valid JWT.
  app.use('/api/jobs', requireAuth, require('./routes/jobRoutes'));
  app.use('/api/candidates', requireAuth, require('./routes/candidateRoutes'));
  app.use('/api/screen', requireAuth, require('./routes/screeningRoutes'));
  app.use('/api/interview', requireAuth, require('./routes/interviewRoutes'));
  app.use('/api/reports', requireAuth, require('./routes/reportRoutes'));
  app.use('/api', requireAuth, require('./routes/analyticsRoutes')); // /analytics, /audit-logs

  // Serve the static frontend (../frontend: index.html + css/ + js/) from the same origin as the API, so the
  // browser needs no CORS and the frontend's relative "/api" base URL works. Registered AFTER the /api routes
  // above, and only the frontend folder is exposed (never Backend/ or .env).
  const frontendDir = path.join(__dirname, '..', '..', 'frontend');
  if (fs.existsSync(path.join(frontendDir, 'index.html'))) app.use(express.static(frontendDir));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function start() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  await connectDB();
  const port = process.env.PORT || 3000;
  createApp().listen(port, '0.0.0.0', () => console.log(`HireLens AI API listening on port ${port}`));
}

if (require.main === module) {
  start().catch((err) => { console.error('Startup failed:', err.message); process.exit(1); });
}

module.exports = { createApp };
