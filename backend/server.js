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

// ===== Middleware =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS: în development permite localhost:3000, în producție same origin
if (!IS_PROD) {
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }));
} else {
  app.use(cors({ credentials: true }));
}

// ===== Health check (fără dependență de DB, Railway îl bate primul) =====
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// ===== API Routes =====
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/reports', reportRoutes);

// ===== Servire frontend în producție =====
if (IS_PROD) {
  const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');

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
// initDatabase() este async (sql.js încarcă WebAssembly)
// Serverul pornește doar după ce DB este gata
initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server pornit pe portul ${PORT}`);
      console.log(`✓ Mediu: ${process.env.NODE_ENV || 'development'}`);
      if (!IS_PROD) {
        console.log(`✓ API: http://localhost:${PORT}/api`);
        console.log(`✓ Health: http://localhost:${PORT}/api/health`);
      }
    });
  })
  .catch(err => {
    console.error('[FATAL] Nu s-a putut inițializa baza de date:', err.message);
    process.exit(1);
  });
