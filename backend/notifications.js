const { getDb } = require('./database');

// Inserează o notificare în tabela notificari pentru un utilizator specific
async function sendNotification(userEmail, titlu, mesaj) {
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO notificari (user_email, titlu, mesaj) VALUES (?, ?, ?)'
    ).run(userEmail, titlu, mesaj);
    console.log(`[Notificari] → ${userEmail}: ${titlu}`);
  } catch (err) {
    console.error('[Notificari] Eroare sendNotification:', err.message);
  }
}

// Trimite notificare tuturor administratorilor activi
async function sendToAdmins(titlu, mesaj) {
  try {
    const db = getDb();
    const admins = db.prepare(
      "SELECT email FROM users WHERE role = 'admin' AND active = 1"
    ).all();
    for (const admin of admins) {
      await sendNotification(admin.email, titlu, mesaj);
    }
  } catch (err) {
    console.error('[Notificari] sendToAdmins eroare:', err.message);
  }
}

module.exports = { sendNotification, sendToAdmins };
