const { getDb } = require('./database');
const { sendPushByEmail, sendPushToAdmins } = require('./routes/push');

// Inserează notificare in-app ȘI trimite Web Push pentru un utilizator specific
async function sendNotification(userEmail, titlu, mesaj) {
  // In-app (clopoțel)
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO notificari (user_email, titlu, mesaj) VALUES (?, ?, ?)'
    ).run(userEmail, titlu, mesaj);
    console.log(`[Notificari] → ${userEmail}: ${titlu}`);
  } catch (err) {
    console.error('[Notificari] DB eroare:', err.message);
  }

  // Web Push
  sendPushByEmail(userEmail, { title: titlu, body: mesaj });
}

// Notifică toți administratorii activi (in-app + push)
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
