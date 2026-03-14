const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/foi-parcurs/raport - raport pentru angajatul logat (ÎNAINTE de /:id)
router.get('/raport', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { data_de, data_pana } = req.query;
    let sql = 'SELECT * FROM foi_parcurs WHERE angajat_email = ?';
    const params = [req.user.email];
    if (data_de) { sql += ' AND data >= ?'; params.push(data_de); }
    if (data_pana) { sql += ' AND data <= ?'; params.push(data_pana); }
    sql += ' ORDER BY data DESC, ora_inceput DESC';
    const foi = db.prepare(sql).all(...params);
    const total_km = foi.reduce((s, f) => s + (f.km_total || 0), 0);
    res.json({ foi, total_km });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/foi-parcurs/admin - toate foile (admin only)
router.get('/admin', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { data_de, data_pana, email } = req.query;
    let sql = 'SELECT fp.*, u.name as angajat_nume FROM foi_parcurs fp LEFT JOIN users u ON fp.angajat_email = u.email WHERE 1=1';
    const params = [];
    if (email) { sql += ' AND fp.angajat_email = ?'; params.push(email); }
    if (data_de) { sql += ' AND fp.data >= ?'; params.push(data_de); }
    if (data_pana) { sql += ' AND fp.data <= ?'; params.push(data_pana); }
    sql += ' ORDER BY fp.data DESC, fp.ora_inceput DESC';
    const foi = db.prepare(sql).all(...params);
    const total_km = foi.reduce((s, f) => s + (f.km_total || 0), 0);
    res.json({ foi, total_km });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/foi-parcurs/admin/:email - foile unui angajat specific (admin only)
router.get('/admin/:email', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { data_de, data_pana } = req.query;
    let sql = 'SELECT * FROM foi_parcurs WHERE angajat_email = ?';
    const params = [req.params.email];
    if (data_de) { sql += ' AND data >= ?'; params.push(data_de); }
    if (data_pana) { sql += ' AND data <= ?'; params.push(data_pana); }
    sql += ' ORDER BY data DESC, ora_inceput DESC';
    const foi = db.prepare(sql).all(...params);
    const total_km = foi.reduce((s, f) => s + (f.km_total || 0), 0);
    res.json({ foi, total_km });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/foi-parcurs - admin: toate foile; angajat: doar foile proprii
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { data_de, data_pana, email } = req.query;
    const isAdmin = req.user.role === 'admin';
    let sql, params;

    if (isAdmin) {
      sql = 'SELECT fp.*, u.name as angajat_nume FROM foi_parcurs fp LEFT JOIN users u ON fp.angajat_email = u.email WHERE 1=1';
      params = [];
      if (email) { sql += ' AND fp.angajat_email = ?'; params.push(email); }
      if (data_de) { sql += ' AND fp.data >= ?'; params.push(data_de); }
      if (data_pana) { sql += ' AND fp.data <= ?'; params.push(data_pana); }
      sql += ' ORDER BY fp.data DESC, fp.ora_inceput DESC';
    } else {
      sql = 'SELECT * FROM foi_parcurs WHERE angajat_email = ?';
      params = [req.user.email];
      if (data_de) { sql += ' AND data >= ?'; params.push(data_de); }
      if (data_pana) { sql += ' AND data <= ?'; params.push(data_pana); }
      sql += ' ORDER BY data DESC, ora_inceput DESC';
    }

    const foi = db.prepare(sql).all(...params);
    const total_km = foi.reduce((s, f) => s + (f.km_total || 0), 0);
    res.json({ foi, total_km });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/foi-parcurs - creare foaie nouă
router.post('/', authenticate, (req, res) => {
  try {
    const db = getDb();
    const { numar_inmatriculare, data, ora_inceput, ora_final, km_inceput, km_final, observatii } = req.body;
    const km_total = (parseInt(km_final) || 0) - (parseInt(km_inceput) || 0);
    const result = db.prepare(
      'INSERT INTO foi_parcurs (angajat_email, numar_inmatriculare, data, ora_inceput, ora_final, km_inceput, km_final, km_total, observatii) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.email, numar_inmatriculare, data, ora_inceput, ora_final, km_inceput, km_final, km_total, observatii || null);
    const foaie = db.prepare('SELECT * FROM foi_parcurs WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(foaie);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/foi-parcurs/:id - editare foaie
router.put('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM foi_parcurs WHERE id = ? AND angajat_email = ?').get(req.params.id, req.user.email);
    if (!existing && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acces interzis' });
    }
    const { numar_inmatriculare, data, ora_inceput, ora_final, km_inceput, km_final, observatii } = req.body;
    const km_total = (parseInt(km_final) || 0) - (parseInt(km_inceput) || 0);
    db.prepare(
      'UPDATE foi_parcurs SET numar_inmatriculare=?, data=?, ora_inceput=?, ora_final=?, km_inceput=?, km_final=?, km_total=?, observatii=? WHERE id=?'
    ).run(numar_inmatriculare, data, ora_inceput, ora_final, km_inceput, km_final, km_total, observatii || null, req.params.id);
    const foaie = db.prepare('SELECT * FROM foi_parcurs WHERE id = ?').get(req.params.id);
    res.json(foaie);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/foi-parcurs/:id - ștergere foaie
router.delete('/:id', authenticate, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM foi_parcurs WHERE id = ? AND angajat_email = ?').get(req.params.id, req.user.email);
    if (!existing && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acces interzis' });
    }
    db.prepare('DELETE FROM foi_parcurs WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
