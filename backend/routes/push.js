const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

let vapidKeys = null;

function initVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
  } else {
    vapidKeys = webpush.generateVAPIDKeys();
    console.log('\n[PUSH] VAPID keys generate. Adauga in .env pentru persistenta:');
    console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
    console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey + '\n');
  }
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@redmedica.ro',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
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
