const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { search } = req.query;
  let query, patients;

  if (req.user.role === 'admin') {
    query = `
      SELECT p.*, u.name as creator_name
      FROM patients p
      LEFT JOIN users u ON p.utilizator_creator_id = u.id
      ${search ? 'WHERE p.nume LIKE ? OR p.telefon LIKE ?' : ''}
      ORDER BY p.data_inregistrare DESC
    `;
    patients = search
      ? db.prepare(query).all(`%${search}%`, `%${search}%`)
      : db.prepare(query).all();
  } else {
    query = `
      SELECT p.*, u.name as creator_name
      FROM patients p
      LEFT JOIN users u ON p.utilizator_creator_id = u.id
      WHERE p.utilizator_creator_id = ?
      ${search ? 'AND (p.nume LIKE ? OR p.telefon LIKE ?)' : ''}
      ORDER BY p.data_inregistrare DESC
    `;
    patients = search
      ? db.prepare(query).all(req.user.id, `%${search}%`, `%${search}%`)
      : db.prepare(query).all(req.user.id);
  }

  res.json(patients);
});

router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const patient = db.prepare(`
    SELECT p.*, u.name as creator_name
    FROM patients p
    LEFT JOIN users u ON p.utilizator_creator_id = u.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!patient) return res.status(404).json({ error: 'Pacient negăsit' });
  res.json(patient);
});

router.post('/', authenticate, (req, res) => {
  const { nume, data_nasterii, varsta, adresa, telefon, acord_gdpr } = req.body;
  if (!nume || !nume.trim()) {
    return res.status(400).json({ error: 'Numele pacientului este obligatoriu' });
  }
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO patients (nume, data_nasterii, varsta, adresa, telefon, acord_gdpr, utilizator_creator_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    nume.trim(),
    data_nasterii || null,
    varsta ? parseInt(varsta) : null,
    adresa || '',
    telefon || '',
    acord_gdpr ? 1 : 0,
    req.user.id
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Pacient negăsit' });
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }

  const { nume, data_nasterii, varsta, adresa, telefon, acord_gdpr } = req.body;

  db.prepare(`
    UPDATE patients SET nume=?, data_nasterii=?, varsta=?, adresa=?, telefon=?, acord_gdpr=?
    WHERE id=?
  `).run(
    nume || patient.nume,
    data_nasterii !== undefined ? (data_nasterii || null) : patient.data_nasterii,
    varsta !== undefined ? (varsta ? parseInt(varsta) : null) : patient.varsta,
    adresa !== undefined ? adresa : patient.adresa,
    telefon !== undefined ? telefon : patient.telefon,
    acord_gdpr !== undefined ? (acord_gdpr ? 1 : 0) : patient.acord_gdpr,
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM visits WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
