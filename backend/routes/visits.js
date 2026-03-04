const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');

router.get('/patient/:patientId', authenticate, (req, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.patientId);
  if (!patient) return res.status(404).json({ error: 'Pacient negăsit' });
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }
  const visits = db.prepare(`
    SELECT v.*, u.name as angajat_name
    FROM visits v
    LEFT JOIN users u ON v.angajat_id = u.id
    WHERE v.patient_id = ?
    ORDER BY v.data DESC, v.ora DESC
  `).all(req.params.patientId);
  res.json(visits);
});

router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const visit = db.prepare(`
    SELECT v.*, u.name as angajat_name, p.nume as patient_name
    FROM visits v
    LEFT JOIN users u ON v.angajat_id = u.id
    LEFT JOIN patients p ON v.patient_id = p.id
    WHERE v.id = ?
  `).get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Vizita negăsită' });
  const patient = db.prepare('SELECT utilizator_creator_id FROM patients WHERE id = ?').get(visit.patient_id);
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }
  res.json(visit);
});

router.post('/', authenticate, (req, res) => {
  const {
    patient_id, diagnostic, tratament, cass, perioada_tratament_inceput,
    perioada_tratament_sfarsit, zile_cass, servicii_efectuate, stare_pacient,
    medicamente, tensiune, temperatura, observatii, suma_de_plata, suma_incasata,
    poze
  } = req.body;

  if (!patient_id) return res.status(400).json({ error: 'ID pacient obligatoriu' });

  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patient_id);
  if (!patient) return res.status(404).json({ error: 'Pacient negăsit' });
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }

  const now = new Date();
  const data = now.toISOString().split('T')[0];
  const ora = now.toTimeString().split(' ')[0].substring(0, 5);

  const result = db.prepare(`
    INSERT INTO visits (
      patient_id, data, ora, angajat_id, diagnostic, tratament, cass,
      perioada_tratament_inceput, perioada_tratament_sfarsit, zile_cass,
      servicii_efectuate, stare_pacient, medicamente, tensiune, temperatura,
      observatii, suma_de_plata, suma_incasata, poze
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patient_id, data, ora, req.user.id,
    diagnostic || '', tratament || '', cass || '',
    perioada_tratament_inceput || null, perioada_tratament_sfarsit || null,
    zile_cass || 0, servicii_efectuate || '', stare_pacient || '',
    medicamente || '', tensiune || '', temperatura || null,
    observatii || '', suma_de_plata || 0, suma_incasata || 0,
    poze || '[]'
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Vizita negăsită' });
  const patient = db.prepare('SELECT utilizator_creator_id FROM patients WHERE id = ?').get(visit.patient_id);
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }
  const {
    diagnostic, tratament, cass, perioada_tratament_inceput, perioada_tratament_sfarsit,
    zile_cass, servicii_efectuate, stare_pacient, medicamente, tensiune, temperatura,
    observatii, suma_de_plata, suma_incasata, poze
  } = req.body;

  db.prepare(`
    UPDATE visits SET diagnostic=?, tratament=?, cass=?, perioada_tratament_inceput=?,
    perioada_tratament_sfarsit=?, zile_cass=?, servicii_efectuate=?, stare_pacient=?,
    medicamente=?, tensiune=?, temperatura=?, observatii=?, suma_de_plata=?, suma_incasata=?,
    poze=?
    WHERE id=?
  `).run(
    diagnostic, tratament, cass, perioada_tratament_inceput, perioada_tratament_sfarsit,
    zile_cass, servicii_efectuate, stare_pacient, medicamente, tensiune, temperatura,
    observatii, suma_de_plata, suma_incasata,
    poze !== undefined ? poze : (visit.poze || '[]'),
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/:id', authenticate, (req, res) => {
  const db = getDb();
  const visit = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  if (!visit) return res.status(404).json({ error: 'Vizita negăsită' });
  const patient = db.prepare('SELECT utilizator_creator_id FROM patients WHERE id = ?').get(visit.patient_id);
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }
  db.prepare('DELETE FROM visits WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
