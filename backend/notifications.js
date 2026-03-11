const { getDb } = require('./database');

const ONESIGNAL_URL = 'https://onesignal.com/api/v1/notifications';

async function sendNotification(body) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    console.log('[OneSignal] ONESIGNAL_APP_ID sau ONESIGNAL_API_KEY lipsesc. Notificare omisă.');
    return;
  }

  try {
    const res = await fetch(ONESIGNAL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ app_id: appId, ...body })
    });

    const data = await res.json();

    if (data.errors && data.errors.length > 0) {
      // "All included players are not subscribed" e normal dacă user-ul nu e abonat
      const ignorabile = data.errors.every(e => typeof e === 'string' && e.includes('subscribed'));
      if (!ignorabile) {
        console.error('[OneSignal] Eroare notificare:', JSON.stringify(data.errors));
      }
    }
  } catch (err) {
    console.error('[OneSignal] Eroare fetch:', err.message);
  }
}

// Trimite notificare unui utilizator specific (după external_id = user.id din DB)
async function sendToUser(userId, { title, body, url, tag }) {
  await sendNotification({
    include_external_user_ids: [String(userId)],
    target_channel: 'push',
    headings: { en: title, ro: title },
    contents: { en: body, ro: body },
    url: url || '/',
    ...(tag ? { collapse_id: tag } : {})
  });
}

// Trimite notificare tuturor administratorilor activi
async function sendToAdmins({ title, body, url, tag }) {
  try {
    const db = getDb();
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1").all();
    for (const admin of admins) {
      await sendToUser(admin.id, { title, body, url, tag });
    }
  } catch (err) {
    console.error('[OneSignal] sendToAdmins eroare:', err.message);
  }
}

module.exports = { sendToUser, sendToAdmins };
