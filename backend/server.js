const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const visitRoutes = require('./routes/visits');
const reportRoutes = require('./routes/reports');
const uploadRoutes = require('./routes/upload');
const pushRoutes = require('./routes/push');
const { scheduleBackup } = require('./routes/backup');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ===== Middleware =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (!IS_PROD) {
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }));
} else {
  app.use(cors({ credentials: true }));
}

// ===== Health check =====
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
app.use('/api/upload', uploadRoutes);
app.use('/api/push', pushRoutes);

// ===== Frontend în producție =====
if (IS_PROD) {
  const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
  app.use(express.static(frontendBuildPath, { maxAge: '1y', etag: true }));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
  console.log(`✓ Frontend servit din: ${frontendBuildPath}`);
}

// ===== Error handler =====
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: IS_PROD ? 'Eroare internă server' : err.message
  });
});

// ===== Pornire =====
initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server pornit pe portul ${PORT}`);
      console.log(`✓ Mediu: ${process.env.NODE_ENV || 'development'}`);
      if (!IS_PROD) {
        console.log(`✓ API: http://localhost:${PORT}/api`);
      }
    });

    // Backup zilnic Google Drive la ora 02:00
    scheduleBackup();
  })
  .catch(err => {
    console.error('[FATAL] Nu s-a putut inițializa baza de date:', err.message);
    process.exit(1);
  });
