const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { sendNotification, sendToAdmins } = require('../notifications');

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
  const {
    nume, data_nasterii, varsta, adresa, telefon, acord_gdpr, redirectionat_catre_id,
    tip_pacient, perioada_cass_inceput, perioada_cass_sfarsit, zile_cass,
    periodicitate, data_vizitei, ora_prima_vizita, ora_a_doua_vizita
  } = req.body;
  if (!nume || !nume.trim()) {
    return res.status(400).json({ error: 'Numele pacientului este obligatoriu' });
  }
  const db = getDb();

  const redirectId = redirectionat_catre_id ? parseInt(redirectionat_catre_id) : null;
  const status = redirectId ? 'PENDING' : 'ACTIV';
  const tipPacientVal = tip_pacient === 'CASS' ? 'CASS' : 'PRIVAT';

  const result = db.prepare(`
    INSERT INTO patients (
      nume, data_nasterii, varsta, adresa, telefon, acord_gdpr,
      utilizator_creator_id, status_preluare, redirectionat_catre_id,
      tip_pacient, perioada_cass_inceput, perioada_cass_sfarsit, zile_cass
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nume.trim(),
    data_nasterii || null,
    varsta ? parseInt(varsta) : null,
    adresa || '',
    telefon || '',
    acord_gdpr ? 1 : 0,
    req.user.id,
    status,
    redirectId,
    tipPacientVal,
    tipPacientVal === 'CASS' ? (perioada_cass_inceput || null) : null,
    tipPacientVal === 'CASS' ? (perioada_cass_sfarsit || null) : null,
    tipPacientVal === 'CASS' ? (zile_cass ? parseInt(zile_cass) : null) : null
  );

  const patientId = result.lastInsertRowid;
  const patientName = nume.trim();
  const creatorName = req.user.name;

  // Creare programări automate dacă s-a selectat periodicitate
  // Angajatul responsabil = cel către care a fost redirecționat pacientul, sau creatorul dacă nu e redirecționat
  const responsabilId = redirectId || req.user.id;
  let nrProgramari = 0;
  if (periodicitate && data_vizitei) {
    if (periodicitate === '1_vizita') {
      db.prepare(`
        INSERT INTO vizite_programate (pacient_id, data_programata, ora_programata, angajat_responsabil)
        VALUES (?, ?, ?, ?)
      `).run(patientId, data_vizitei, '08:00', responsabilId);
      nrProgramari = 1;
    } else if (periodicitate === '2_vizite') {
      const ora1 = ora_prima_vizita || '08:00';
      const ora2 = ora_a_doua_vizita || '16:00';
      db.prepare(`
        INSERT INTO vizite_programate (pacient_id, data_programata, ora_programata, angajat_responsabil)
        VALUES (?, ?, ?, ?)
      `).run(patientId, data_vizitei, ora1, responsabilId);
      db.prepare(`
        INSERT INTO vizite_programate (pacient_id, data_programata, ora_programata, angajat_responsabil)
        VALUES (?, ?, ?, ?)
      `).run(patientId, data_vizitei, ora2, responsabilId);
      nrProgramari = 2;
    }
  }

  // Notificari push (async, nu blocam raspunsul)
  if (redirectId) {
    const redirectUser = db.prepare('SELECT email FROM users WHERE id = ?').get(redirectId);
    if (redirectUser) {
      sendNotification(redirectUser.email, 'Pacient nou redirectionat catre tine', `Pacient: ${patientName}. Te rog sa accepti sau sa refuzi.`);
    }
  }
  sendToAdmins('Pacient nou adaugat', `Pacient: ${patientName} de catre ${creatorName}.`);

  const response = { id: patientId };
  if (nrProgramari > 0) response.programari = nrProgramari;
  res.status(201).json(response);
});

router.put('/:id', authenticate, (req, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Pacient negăsit' });
  if (req.user.role !== 'admin' && patient.utilizator_creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }

  const { nume, data_nasterii, varsta, adresa, telefon, acord_gdpr, redirectionat_catre_id } = req.body;

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

  // Schimbare angajat responsabil
  if (redirectionat_catre_id !== undefined) {
    const newRedirectId = redirectionat_catre_id ? parseInt(redirectionat_catre_id) : null;
    if (newRedirectId !== patient.redirectionat_catre_id) {
      db.prepare('UPDATE patients SET redirectionat_catre_id = ?, status_preluare = ? WHERE id = ?')
        .run(newRedirectId, 'PENDING', req.params.id);

      if (newRedirectId) {
        const newEmployee = db.prepare('SELECT email, name FROM users WHERE id = ?').get(newRedirectId);
        if (newEmployee) {
          sendNotification(newEmployee.email, 'Pacient redirecționat către tine',
            `Pacientul ${patient.nume} a fost redirecționat către tine. Te rugăm să accepți sau să refuzi.`);
        }
        sendToAdmins('Pacient redirecționat',
          `Pacientul ${patient.nume} a fost redirecționat către ${newEmployee ? newEmployee.name : '#' + newRedirectId}.`);
      }
    }
  }

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
    sendToAdmins('Pacient refuzat', `Angajatul ${req.user.name} a refuzat pacientul ${patient.nume}. Te rugam sa redistribui pacientul.`);
  } else if (status === 'ACCEPTAT') {
    sendToAdmins('Pacient acceptat', `Angajatul ${req.user.name} a acceptat pacientul ${patient.nume}.`);
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

  const redirectUser = db.prepare('SELECT email FROM users WHERE id = ?').get(redirectId);
  if (redirectUser) {
    sendNotification(redirectUser.email, 'Pacient redistribut catre tine', `Pacient: ${patient.nume}. Te rog sa accepti sau sa refuzi.`);
  }

  res.json({ success: true });
});

// PUT /:id/sold — setează suma inițială de plată pentru pacient
router.put('/:id/sold', authenticate, (req, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Pacient negăsit' });

  const { sold_initial } = req.body;
  if (sold_initial === undefined || sold_initial === null || sold_initial === '') {
    return res.status(400).json({ error: 'sold_initial este obligatoriu' });
  }

  const soldInitialNum = parseFloat(sold_initial) || 0;
  const row = db.prepare('SELECT COALESCE(SUM(suma_incasata), 0) as total FROM visits WHERE patient_id = ?').get(req.params.id);
  const totalIncasat = row ? (row.total || 0) : 0;
  const soldRamas = soldInitialNum - totalIncasat;

  db.prepare('UPDATE patients SET sold_initial = ?, sold_ramas = ? WHERE id = ?').run(soldInitialNum, soldRamas, req.params.id);
  res.json({ success: true, sold_ramas: soldRamas });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM visits WHERE patient_id = ?').run(req.params.id);
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
