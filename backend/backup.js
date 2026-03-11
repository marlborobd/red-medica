const { google } = require('googleapis');
const { Readable } = require('stream');
const { getDb } = require('./database');

async function runBackup() {
  try {
    const db = getDb();

    const pacienti = db.prepare('SELECT * FROM patients').all();
    const vizite = db.prepare('SELECT * FROM visits').all();

    const data = { pacienti, vizite };
    const content = JSON.stringify(data, null, 2);

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const filename = `backup_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!serviceAccountKey || !folderId) {
      console.log('[Backup] GOOGLE_SERVICE_ACCOUNT_KEY sau GOOGLE_DRIVE_FOLDER_ID lipsesc. Backup omis.');
      return;
    }

    const credentials = JSON.parse(serviceAccountKey);

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

    console.log(`Backup reușit: ${filename} (ID: ${response.data.id})`);
  } catch (err) {
    console.error('[Backup] Eroare:', err);
  }
}

module.exports = { runBackup };
