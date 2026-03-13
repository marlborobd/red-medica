const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

// GET /api/notificari — notificările necitite ale utilizatorului logat
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const notificari = db.prepare(`
    SELECT * FROM notificari
    WHERE user_email = ? AND citita = 0
    ORDER BY created_at DESC
  `).all(req.user.email);
  res.json(notificari);
});

// PUT /api/notificari/citeste-toate — marchează toate ca citite
router.put('/citeste-toate', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notificari SET citita = 1 WHERE user_email = ?').run(req.user.email);
  res.json({ success: true });
});

// PUT /api/notificari/:id/citita — marchează o notificare ca citită
router.put('/:id/citita', authenticate, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notificari SET citita = 1 WHERE id = ? AND user_email = ?').run(req.params.id, req.user.email);
  res.json({ success: true });
});

module.exports = router;
