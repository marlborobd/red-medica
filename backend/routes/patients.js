const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');

function extractBirthDateFromCNP(cnp) {
  if (!cnp || cnp.length !== 13) return null;
  const s = parseInt(cnp[0]);
  const yearSuffix = parseInt(cnp.substring(1, 3));
  const month = cnp.substring(3, 5);
  const day = cnp.substring(5, 7);
  let year;
  if (s === 1 || s === 2) year = 1900 + yearSuffix;
  else if (s === 3 || s === 4) year = 1800 + yearSuffix;
  else if (s === 5 || s === 6) year = 2000 + yearSuffix;
  else return null;
  const date = new Date(`${year}-${month}-${day}`);
  if (isNaN(date.getTime())) return null;
  return `${year}-${month}-${day}`;
}

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { search } = req.query;
  let query, patients;

  if (req.user.role === 'admin') {
    query = `
      SELECT p.*, u.name as creator_name
      FROM patients p
      LEFT JOIN users u ON p.utilizator_creator_id = u.id
      ${search ? "WHERE p.nume LIKE ? OR p.cnp LIKE ? OR p.telefon LIKE ?" : ""}
      ORDER BY p.data_inregistrare DESC
    `;
    patients = search
      ? db.prepare(query).all(`%${search}%`, `%${search}%`, `%${search}%`)
      : db.prepare(query).all();
  } else {
    query = `
      SELECT p.*, u.name as creator_name
      FROM patients p
      LEFT JOIN users u ON p.utilizator_creator_id = u.id
      WHERE p.utilizator_creator_id = ?
      ${search ? "AND (p.nume LIKE ? OR p.cnp LIKE ? OR p.telefon LIKE ?)" : ""}
      ORDER BY p.data_inregistrare DESC
    `;
    patients = search
      ? db.prepare(query).all(req.user.id, `%${search}%`, `%${search}%`, `%${search}%`)
      : db.prepare(query).all(req.user.id);
  }

  // Recalculate age dynamically
  patients = patients.map(p => ({ ...p, varsta: calculateAge(p.data_nasterii) }));
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
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }
  patient.varsta = calculateAge(patient.data_nasterii);
  res.json(patient);
});

router.post('/', authenticate, (req, res) => {
  const { nume, cnp, adresa, telefon, acord_gdpr } = req.body;
  if (!nume || !cnp) return res.status(400).json({ error: 'Numele și CNP-ul sunt obligatorii' });
  if (cnp.length !== 13 || !/^\d{13}$/.test(cnp)) {
    return res.status(400).json({ error: 'CNP invalid (trebuie să aibă 13 cifre)' });
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM patients WHERE cnp = ?').get(cnp);
  if (existing) return res.status(400).json({ error: 'CNP-ul există deja în sistem' });

  const data_nasterii = extractBirthDateFromCNP(cnp);
  const varsta = calculateAge(data_nasterii);

  const result = db.prepare(`
    INSERT INTO patients (nume, cnp, data_nasterii, varsta, adresa, telefon, acord_gdpr, utilizator_creator_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nume, cnp, data_nasterii, varsta, adresa || '', telefon || '', acord_gdpr ? 1 : 0, req.user.id);

  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Pacient negăsit' });
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }
  const { nume, cnp, adresa, telefon, acord_gdpr } = req.body;
  const data_nasterii = cnp ? extractBirthDateFromCNP(cnp) : patient.data_nasterii;
  const varsta = calculateAge(data_nasterii);

  db.prepare(`
    UPDATE patients SET nume=?, cnp=?, data_nasterii=?, varsta=?, adresa=?, telefon=?, acord_gdpr=?
    WHERE id=?
  `).run(
    nume || patient.nume,
    cnp || patient.cnp,
    data_nasterii,
    varsta,
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
