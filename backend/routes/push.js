const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const VAPID_FILE = process.env.DATABASE_PATH
  ? path.join(path.dirname(process.env.DATABASE_PATH), 'vapid_keys.json')
  : path.join(__dirname, '..', 'vapid_keys.json');

let vapidKeys = null;

function isValidVapidKey(key) {
  // Cheile VAPID sunt base64url de 65 bytes (public) sau 32 bytes (private)
  return typeof key === 'string' && key.length >= 40;
}

function initVapid() {
  // 1. Încearcă din variabile de mediu
  if (
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY &&
    isValidVapidKey(process.env.VAPID_PUBLIC_KEY) &&
    isValidVapidKey(process.env.VAPID_PRIVATE_KEY)
  ) {
    vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
    console.log('[PUSH] VAPID keys încărcate din environment variables');

  // 2. Încearcă din fișierul persistent
  } else if (fs.existsSync(VAPID_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
      if (isValidVapidKey(saved.publicKey) && isValidVapidKey(saved.privateKey)) {
        vapidKeys = saved;
        console.log('[PUSH] VAPID keys încărcate din', VAPID_FILE);
      }
    } catch (_) {}
  }

  // 3. Generează chei noi dacă nu există sau sunt invalide
  if (!vapidKeys) {
    vapidKeys = webpush.generateVAPIDKeys();
    try {
      const dir = path.dirname(VAPID_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
    } catch (err) {
      console.error('[PUSH] Nu s-au putut salva VAPID keys:', err.message);
    }
    console.log('\n=== VAPID KEYS GENERATE ===');
    console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
    console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
    console.log('=== ADAUGA IN RAILWAY VARIABLES ===\n');
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@redmedica.ro',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  console.log('\n=== VAPID KEYS DIN FISIER ===');
  console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
  console.log('REACT_APP_VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
  console.log('=== COPIAZA IN RAILWAY VARIABLES ===\n');
}

initVapid();

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// POST /api/push/subscribe
router.post('/subscribe', authenticate, (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription invalida' });
  }
  const db = getDb();
  const subJson = JSON.stringify(subscription);
  const existing = db.prepare(
    'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?'
  ).get(req.user.id, subscription.endpoint);

  if (!existing) {
    db.prepare(
      'INSERT INTO push_subscriptions (user_id, endpoint, subscription) VALUES (?, ?, ?)'
    ).run(req.user.id, subscription.endpoint, subJson);
  } else {
    db.prepare(
      'UPDATE push_subscriptions SET subscription = ? WHERE user_id = ? AND endpoint = ?'
    ).run(subJson, req.user.id, subscription.endpoint);
  }
  res.json({ success: true });
});

// Helper: trimite notificare unui user
async function sendToUser(userId, payload) {
  try {
    const db = getDb();
    const subs = db.prepare(
      'SELECT id, subscription FROM push_subscriptions WHERE user_id = ?'
    ).all(userId);
    for (const row of subs) {
      try {
        const sub = JSON.parse(row.subscription);
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id);
        } else {
          console.error('[Push] sendToUser err:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('[Push] sendToUser fatal:', err.message);
  }
}

// Helper: trimite notificare tuturor adminilor
async function sendToAdmins(payload) {
  try {
    const db = getDb();
    const admins = db.prepare(
      "SELECT id FROM users WHERE role = 'admin' AND active = 1"
    ).all();
    for (const admin of admins) {
      await sendToUser(admin.id, payload);
    }
  } catch (err) {
    console.error('[Push] sendToAdmins err:', err.message);
  }
}

// Trimite push unui utilizator specific după email
async function sendPushByEmail(email, payload) {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (user) await sendToUser(user.id, payload);
  } catch (err) {
    console.error('[Push] sendPushByEmail err:', err.message);
  }
}

// Trimite push tuturor administratorilor activi
async function sendPushToAdmins(payload) {
  try {
    const db = getDb();
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1").all();
    for (const admin of admins) await sendToUser(admin.id, payload);
  } catch (err) {
    console.error('[Push] sendPushToAdmins err:', err.message);
  }
}

module.exports = router;
module.exports.sendToUser = sendToUser;
module.exports.sendToAdmins = sendToAdmins;
module.exports.sendPushByEmail = sendPushByEmail;
module.exports.sendPushToAdmins = sendPushToAdmins;
