const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const { sendToUser, sendToAdmins } = require('./push');

// GET / — toate vizitele programate
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  let visits;
  if (req.user.role === 'admin') {
    visits = db.prepare(`
      SELECT vp.*, p.nume as pacient_name, p.telefon as pacient_telefon, p.adresa as pacient_adresa,
             u.name as angajat_name
      FROM vizite_programate vp
      LEFT JOIN patients p ON vp.pacient_id = p.id
      LEFT JOIN users u ON vp.angajat_responsabil = u.id
      ORDER BY vp.data_programata ASC, vp.ora_programata ASC
    `).all();
  } else {
    visits = db.prepare(`
      SELECT vp.*, p.nume as pacient_name, p.telefon as pacient_telefon, p.adresa as pacient_adresa,
             u.name as angajat_name
      FROM vizite_programate vp
      LEFT JOIN patients p ON vp.pacient_id = p.id
      LEFT JOIN users u ON vp.angajat_responsabil = u.id
      WHERE vp.angajat_responsabil = ?
      ORDER BY vp.data_programata ASC, vp.ora_programata ASC
    `).all(req.user.id);
  }
  res.json(visits);
});

// POST / — creeaza vizita programata
router.post('/', authenticate, (req, res) => {
  const { pacient_id, data_programata, ora_programata, angajat_responsabil } = req.body;
  if (!pacient_id || !data_programata || !ora_programata) {
    return res.status(400).json({ error: 'pacient_id, data_programata si ora_programata sunt obligatorii' });
  }
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(pacient_id);
  if (!patient) return res.status(404).json({ error: 'Pacient negasit' });

  const responsabilId = angajat_responsabil ? parseInt(angajat_responsabil) : req.user.id;

  const result = db.prepare(`
    INSERT INTO vizite_programate (pacient_id, data_programata, ora_programata, angajat_responsabil, status)
    VALUES (?, ?, ?, ?, 'PROGRAMAT')
  `).run(pacient_id, data_programata, ora_programata, responsabilId);

  // Notifica angajatul responsabil
  sendToUser(responsabilId, {
    title: 'Vizita programata',
    body: `Vizita pentru pacientul ${patient.nume} pe ${data_programata} la ${ora_programata}.`,
    url: `/pacienti/${pacient_id}`,
    tag: 'scheduled-' + result.lastInsertRowid
  });

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /:id/efectuat — marcheaza ca efectuata + creeaza vizita reala
router.put('/:id/efectuat', authenticate, (req, res) => {
  const db = getDb();
  const scheduled = db.prepare('SELECT * FROM vizite_programate WHERE id = ?').get(req.params.id);
  if (!scheduled) return res.status(404).json({ error: 'Vizita programata negasita' });

  if (req.user.role !== 'admin' && scheduled.angajat_responsabil !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }

  db.prepare("UPDATE vizite_programate SET status = 'EFECTUAT' WHERE id = ?").run(req.params.id);

  // Creeaza vizita reala in tabela visits
  const visitResult = db.prepare(`
    INSERT INTO visits (patient_id, data, ora, angajat_id, diagnostic, tratament, observatii,
                        suma_de_plata, suma_incasata, poze)
    VALUES (?, ?, ?, ?, '', '', 'Vizita programata efectuata.', 0, 0, '[]')
  `).run(
    scheduled.pacient_id,
    scheduled.data_programata,
    scheduled.ora_programata,
    scheduled.angajat_responsabil
  );

  const patient = db.prepare('SELECT nume FROM patients WHERE id = ?').get(scheduled.pacient_id);
  sendToAdmins({
    title: 'Vizita efectuata',
    body: `Vizita programata pentru ${patient ? patient.nume : 'pacient'} a fost efectuata.`,
    url: `/pacienti/${scheduled.pacient_id}`,
    tag: 'done-' + scheduled.id
  });

  res.json({ success: true, visit_id: visitResult.lastInsertRowid });
});

// DELETE /:id — sterge vizita programata
router.delete('/:id', authenticate, (req, res) => {
  const db = getDb();
  const scheduled = db.prepare('SELECT * FROM vizite_programate WHERE id = ?').get(req.params.id);
  if (!scheduled) return res.status(404).json({ error: 'Vizita programata negasita' });
  if (req.user.role !== 'admin' && scheduled.angajat_responsabil !== req.user.id) {
    return res.status(403).json({ error: 'Acces interzis' });
  }
  db.prepare('DELETE FROM vizite_programate WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Notificari dimineata: trimite notificari catre fiecare angajat cu vizitele din ziua respectiva
async function sendMorningNotifications() {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const todayVisits = db.prepare(`
      SELECT vp.*, p.nume as pacient_name, u.id as user_id
      FROM vizite_programate vp
      LEFT JOIN patients p ON vp.pacient_id = p.id
      LEFT JOIN users u ON vp.angajat_responsabil = u.id
      WHERE vp.data_programata = ? AND vp.status = 'PROGRAMAT'
      ORDER BY vp.ora_programata ASC
    `).all(today);

    // Grupeaza dupa angajat
    const byEmployee = {};
    for (const v of todayVisits) {
      if (!byEmployee[v.angajat_responsabil]) byEmployee[v.angajat_responsabil] = [];
      byEmployee[v.angajat_responsabil].push(v);
    }

    for (const [userId, visits] of Object.entries(byEmployee)) {
      const names = visits.map(v => `${v.pacient_name} (${v.ora_programata})`).join(', ');
      await sendToUser(parseInt(userId), {
        title: `Ai ${visits.length} vizite programate azi`,
        body: `Pacienti: ${names}`,
        url: '/',
        tag: 'morning-' + today
      });
    }
    console.log(`✓ [Notificari] Trimise pentru ${Object.keys(byEmployee).length} angajati`);
  } catch (err) {
    console.error('[Notificari dimineata] Eroare:', err.message);
  }
}

function scheduleMorningNotifications() {
  function getNext8AM() {
    const now = new Date();
    const next = new Date();
    next.setHours(8, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  function scheduleNext() {
    const next = getNext8AM();
    const ms = next - Date.now();
    const ore = Math.floor(ms / 3600000);
    const min = Math.floor((ms % 3600000) / 60000);
    console.log(`✓ [Notificari] Programate pentru: ${next.toLocaleString('ro-RO')} (in ${ore}h ${min}m)`);
    setTimeout(async () => {
      await sendMorningNotifications();
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}

module.exports = router;
module.exports.scheduleMorningNotifications = scheduleMorningNotifications;
