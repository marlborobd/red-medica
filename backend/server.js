const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const visitRoutes = require('./routes/visits');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ===== Inițializare bază de date =====
initDatabase();

// ===== Middleware =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS: în development permite localhost:3000, în producție nu e necesar (same origin)
if (!IS_PROD) {
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }));
} else {
  // În producție permitem orice origine (Railway poate redirecționa)
  app.use(cors({ credentials: true }));
}

// ===== API Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint (folosit de Railway pentru monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// ===== Servire frontend în producție =====
if (IS_PROD) {
  const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');

  // Servire fișiere statice React
  app.use(express.static(frontendBuildPath, {
    maxAge: '1y',
    etag: true
  }));

  // React Router — returnează index.html pentru toate rutele non-API
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });

  console.log(`✓ Frontend servit din: ${frontendBuildPath}`);
}

// ===== Error handler global =====
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: IS_PROD ? 'Eroare internă server' : err.message
  });
});

// ===== Start server =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server pornit pe portul ${PORT}`);
  console.log(`✓ Mediu: ${process.env.NODE_ENV || 'development'}`);
  if (!IS_PROD) {
    console.log(`✓ API: http://localhost:${PORT}/api`);
    console.log(`✓ Health: http://localhost:${PORT}/api/health`);
  }
});
