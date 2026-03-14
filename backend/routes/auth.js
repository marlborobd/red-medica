const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database');
const { authenticate, requireAdmin, JWT_SECRET } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email și parola sunt obligatorii' });
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email sau parolă incorectă' });
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

// GET /employees — toti angajatii activi (accesibil oricui autentificat)
router.get('/employees', authenticate, (req, res) => {
  const db = getDb();
  const employees = db.prepare(
    "SELECT id, email, name, role FROM users WHERE active = 1 ORDER BY name"
  ).all();
  res.json(employees);
});

router.get('/users', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, email, name, role, active, created_at FROM users ORDER BY name').all();
  res.json(users);
});

router.post('/users', authenticate, requireAdmin, (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, parolă și nume sunt obligatorii' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'Email-ul există deja' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)'
  ).run(email, hashed, name, role || 'employee');
  res.status(201).json({ id: result.lastInsertRowid, email, name, role: role || 'employee' });
});

router.put('/users/:id', authenticate, requireAdmin, (req, res) => {
  const { name, role, active, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Utilizator negăsit' });

  if (password) {
    const hashed = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET name=?, role=?, active=?, password=? WHERE id=?')
      .run(name, role, active !== undefined ? active : 1, hashed, req.params.id);
  } else {
    db.prepare('UPDATE users SET name=?, role=?, active=? WHERE id=?')
      .run(name, role, active !== undefined ? active : 1, req.params.id);
  }
  res.json({ success: true });
});

router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Nu vă puteți șterge propriul cont' });
  }
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
