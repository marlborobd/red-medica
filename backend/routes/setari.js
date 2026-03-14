const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

// GET /api/setari/numar-inmatriculare
router.get('/numar-inmatriculare', authenticate, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT numar_inmatriculare FROM setari_angajat WHERE angajat_email = ?').get(req.user.email);
    res.json({ numar_inmatriculare: row ? row.numar_inmatriculare : '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/setari/numar-inmatriculare
router.put('/numar-inmatriculare', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { numar_inmatriculare } = req.body;
    db.prepare(
      'INSERT INTO setari_angajat (angajat_email, numar_inmatriculare) VALUES (?, ?) ON CONFLICT(angajat_email) DO UPDATE SET numar_inmatriculare = excluded.numar_inmatriculare'
    ).run(req.user.email, numar_inmatriculare);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
