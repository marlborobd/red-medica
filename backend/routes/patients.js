const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendToUser, sendToAdmins } = require('./push');

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { search } = req.query;

  const baseWhere = "p.status_preluare != 'PENDING'";
  const query = `
    SELECT p.*, u.name as creator_name, ur.name as redirectionat_catre_name
    FROM patients p
    LEFT JOIN users u ON p.utilizator_creator_id = u.id
    LEFT JOIN users ur ON p.redirectionat_catre_id = ur.id
    WHERE ${baseWhere} ${search ? 'AND (p.nume LIKE ? OR p.telefon LIKE ?)' : ''}
    ORDER BY p.data_inregistrare DESC
  `;
  const patients = search
    ? db.prepare(query).all(`%${search}%`, `%${search}%`)
    : db.prepare(query).all();

  res.json(patients);
});

// GET /pending — pacienți în așteptare
router.get('/pending', authenticate, (req, res) => {
  const db = getDb();
  let patients;
  if (req.user.role === 'admin') {
    patients = db.prepare(`
      SELECT p.*, u.name as creator_name, ur.name as redirectionat_catre_name
      FROM patients p
      LEFT JOIN users u ON p.utilizator_creator_id = u.id
      LEFT JOIN users ur ON p.redirectionat_catre_id = ur.id
      WHERE p.status_preluare IN ('PENDING', 'REFUZAT')
      ORDER BY p.data_inregistrare DESC
    `).all();
  } else {
    patients = db.prepare(`
      SELECT p.*, u.name as creator_name, ur.name as redirectionat_catre_name
      FROM patients p
      LEFT JOIN users u ON p.utilizator_creator_id = u.id
      LEFT JOIN users ur ON p.redirectionat_catre_id = ur.id
      WHERE p.status_preluare = 'PENDING' AND p.redirectionat_catre_id = ?
      ORDER BY p.data_inregistrare DESC
    `).all(req.user.id);
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
  const { nume, data_nasterii, varsta, adresa, telefon, acord_gdpr, redirectionat_catre_id } = req.body;
  if (!nume || !nume.trim()) {
    return res.status(400).json({ error: 'Numele pacientului este obligatoriu' });
  }
  const db = getDb();

  const redirectId = redirectionat_catre_id ? parseInt(redirectionat_catre_id) : null;
  const status = redirectId ? 'PENDING' : 'ACTIV';

  const result = db.prepare(`
    INSERT INTO patients (nume, data_nasterii, varsta, adresa, telefon, acord_gdpr, utilizator_creator_id, status_preluare, redirectionat_catre_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nume.trim(),
    data_nasterii || null,
    varsta ? parseInt(varsta) : null,
    adresa || '',
    telefon || '',
    acord_gdpr ? 1 : 0,
    req.user.id,
    status,
    redirectId
  );

  const patientId = result.lastInsertRowid;
  const patientName = nume.trim();
  const creatorName = req.user.name;

  // Notificari push (async, nu blocam raspunsul)
  if (redirectId) {
    sendToUser(redirectId, {
      title: 'Pacient nou redirectionat catre tine',
      body: `Pacient: ${patientName}. Te rog sa accepti sau sa refuzi.`,
      url: '/',
      tag: 'pending-' + patientId
    });
  }
  sendToAdmins({
    title: 'Pacient nou adaugat',
    body: `Pacient: ${patientName} de catre ${creatorName}.`,
    url: '/pacienti/' + patientId,
    tag: 'new-patient-' + patientId
  });

  res.status(201).json({ id: patientId });
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

// PUT /:id/status — accepta sau refuza pacient
router.put('/:id/status', authenticate, (req, res) => {
  const { status } = req.body;
  if (!['ACCEPTAT', 'REFUZAT'].includes(status)) {
    return res.status(400).json({ error: 'Status invalid. Valori acceptate: ACCEPTAT, REFUZAT' });
  }
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Pacient negasit' });

  if (req.user.role !== 'admin' && patient.redirectionat_catre_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }

  db.prepare('UPDATE patients SET status_preluare = ? WHERE id = ?').run(status, req.params.id);

  if (status === 'REFUZAT') {
    sendToAdmins({
      title: 'Pacient refuzat',
      body: `Angajatul ${req.user.name} a refuzat pacientul ${patient.nume}. Te rugam sa redistribui pacientul.`,
      url: '/',
      tag: 'refused-' + patient.id
    });
  }

  res.json({ success: true });
});

// PUT /:id/redistribuie — admin redistribuie pacient REFUZAT
router.put('/:id/redistribuie', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acces interzis' });
  const { redirectionat_catre_id } = req.body;
  if (!redirectionat_catre_id) return res.status(400).json({ error: 'redirectionat_catre_id obligatoriu' });

  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Pacient negasit' });

  const redirectId = parseInt(redirectionat_catre_id);
  db.prepare('UPDATE patients SET status_preluare = ?, redirectionat_catre_id = ? WHERE id = ?')
    .run('PENDING', redirectId, req.params.id);

  sendToUser(redirectId, {
    title: 'Pacient redistribut catre tine',
    body: `Pacient: ${patient.nume}. Te rog sa accepti sau sa refuzi.`,
    url: '/',
    tag: 'pending-' + patient.id
  });

  res.json({ success: true });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM visits WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
