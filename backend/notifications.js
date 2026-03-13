const { getDb } = require('./database');

const ONESIGNAL_URL = 'https://onesignal.com/api/v1/notifications';

async function sendNotification(body) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    console.log('[OneSignal] ONESIGNAL_APP_ID sau ONESIGNAL_API_KEY lipsesc. Notificare omisă.');
    return null;
  }

  const requestBody = JSON.stringify({ app_id: appId, ...body });
  console.log('[OneSignal] → URL:', ONESIGNAL_URL);
  console.log('[OneSignal] → Headers: Content-Type: application/json | Authorization: Basic ' + apiKey.substring(0, 10) + '...');
  console.log('[OneSignal] → Body:', requestBody);

  try {
    const res = await fetch(ONESIGNAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + apiKey
      },
      body: requestBody
    });

    const statusCode = res.status;
    const data = await res.json();
    console.log('[OneSignal] ← Status:', statusCode);
    console.log('[OneSignal] ← Răspuns complet:', JSON.stringify(data));
    return { statusCode, data };
  } catch (err) {
    console.error('[OneSignal] ← Eroare fetch:', err.message);
    return null;
  }
}

// Trimite notificare unui utilizator specific (după external_id = user.id din DB)
async function sendToUser(userId, { title, body, url, tag }) {
  return await sendNotification({
    include_aliases: { external_id: [String(userId)] },
    target_channel: 'push',
    headings: { en: 'Red Medica', ro: title },
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

// Trimite notificare tuturor utilizatorilor (folosit pentru test)
async function sendToAll({ title, body }) {
  return await sendNotification({
    included_segments: ['All'],
    headings: { en: 'Red Medica', ro: title },
    contents: { en: body, ro: body }
  });
}

module.exports = { sendToUser, sendToAdmins, sendToAll };
