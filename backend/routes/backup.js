const { google } = require('googleapis');
const { Readable } = require('stream');
const { getDb } = require('../database');

// ===== Export date în format JSON =====
function exportDatabaseToJson() {
  const db = getDb();

  const users = db.prepare(
    'SELECT id, email, name, role, active, created_at FROM users'
  ).all();

  const patients = db.prepare('SELECT * FROM patients').all();
  const visits = db.prepare('SELECT * FROM visits').all();

  return {
    exportat_la: new Date().toISOString(),
    versiune: '1.0',
    statistici: {
      utilizatori: users.length,
      pacienti: patients.length,
      vizite: visits.length
    },
    utilizatori: users,
    pacienti: patients,
    vizite: visits
  };
}

// ===== Upload pe Google Drive =====
async function uploadToDrive(content, filename) {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!serviceAccountKey || !folderId) {
    console.log('[Backup] Variabilele GOOGLE_SERVICE_ACCOUNT_KEY sau GOOGLE_DRIVE_FOLDER_ID nu sunt setate. Backup omis.');
    return null;
  }

  let credentials;
  try {
    credentials = JSON.parse(serviceAccountKey);
  } catch (err) {
    console.error('[Backup] GOOGLE_SERVICE_ACCOUNT_KEY nu este JSON valid:', err.message);
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });

  const drive = google.drive({ version: 'v3', auth });

  const stream = Readable.from([content]);

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      mimeType: 'application/json',
      parents: [folderId]
    },
    media: {
      mimeType: 'application/json',
      body: stream
    }
  });

  return response.data.id;
}

// ===== Backup complet =====
async function performBackup() {
  console.log('[Backup] Pornire backup Google Drive...');
  try {
    const data = exportDatabaseToJson();
    const content = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `red-medica-backup-${dateStr}.json`;

    const fileId = await uploadToDrive(content, filename);
    if (fileId) {
      console.log(`✓ [Backup] Salvat pe Google Drive: ${filename} (ID: ${fileId})`);
    }
  } catch (err) {
    console.error('[Backup] Eroare:', err.message);
  }
}

// ===== Planificare zilnică la ora 02:00 =====
function scheduleBackup() {
  function getNextRun() {
    const now = new Date();
    const next = new Date();
    next.setHours(2, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  function scheduleNext() {
    const next = getNextRun();
    const ms = next - Date.now();
    const ore = Math.floor(ms / 3600000);
    const min = Math.floor((ms % 3600000) / 60000);
    console.log(`✓ [Backup] Programat pentru: ${next.toLocaleString('ro-RO')} (în ${ore}h ${min}m)`);

    setTimeout(async () => {
      await performBackup();
      scheduleNext(); // reprogramare pentru ziua următoare
    }, ms);
  }

  scheduleNext();
}

module.exports = { scheduleBackup, performBackup };
