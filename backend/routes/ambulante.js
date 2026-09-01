const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { requireAmbAccess } = require('../middleware/ambAuth');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ─── Helpers ────────────────────────────────────────────────────────────────

const NR_REGEX = /^[A-Z]{1,2}[0-9]{2,3}[A-Z]{3}$/;

function validateNr(nr) {
  if (!nr || typeof nr !== 'string') return 'Numărul de înmatriculare este obligatoriu.';
  if (!NR_REGEX.test(nr.toUpperCase())) return `Numărul de înmatriculare „${nr}" este invalid (ex: AR92RED, B123ABC).`;
  return null;
}

function timeToSec(t) {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
}

// Recalculează lanțul de odometru pentru toate cursele din zi, pornind de la odometru_start al zilei.
function propagateOdometer(db, ziId) {
  const zi = db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(ziId);
  if (!zi) return;
  const curse = db.prepare('SELECT * FROM amb_curse WHERE zi_id = ? ORDER BY ordine').all(ziId);
  let current = zi.odometru_start;
  for (const c of curse) {
    const final = Math.round((current + c.distanta_km) * 100) / 100;
    db.prepare("UPDATE amb_curse SET odometru_start=?, odometru_final=?, updated_at=datetime('now') WHERE id=?")
      .run(current, final, c.id);
    current = final;
  }
}

// Recalculează stationare_oprit_sec pentru toate cursele din zi (NULL la ultima).
function recalcStationariOprit(db, ziId) {
  const curse = db.prepare('SELECT * FROM amb_curse WHERE zi_id = ? ORDER BY ordine').all(ziId);
  for (let i = 0; i < curse.length; i++) {
    const val = i < curse.length - 1
      ? timeToSec(curse[i + 1].ora_plecare) - timeToSec(curse[i].ora_sosire)
      : null;
    db.prepare("UPDATE amb_curse SET stationare_oprit_sec=?, updated_at=datetime('now') WHERE id=?")
      .run(val, curse[i].id);
  }
}

// Înregistrează/incrementează frecvența de utilizare a unei adrese (pentru autocomplete).
function inregistreazaAdresa(db, adresa) {
  if (!adresa || typeof adresa !== 'string' || !adresa.trim()) return;
  db.prepare(`
    INSERT INTO amb_adrese_frecvente (adresa, utilizari, ultima_utilizare)
    VALUES (?, 1, datetime('now'))
    ON CONFLICT(adresa) DO UPDATE SET
      utilizari = utilizari + 1,
      ultima_utilizare = datetime('now')
  `).run(adresa.trim());
}

function calcVitezaMedie(distanta_km, durata_condus_sec) {
  if (!durata_condus_sec || durata_condus_sec <= 0) return null;
  return Math.round(distanta_km / (durata_condus_sec / 3600));
}

// Rezolvă viteza_medie și sursa: manual dacă clientul trimite valoare validă, auto altfel.
function resolveViteza(clientVal, distanta_km, durata_condus_sec) {
  if (clientVal !== undefined && clientVal !== null) {
    const v = parseInt(clientVal);
    if (Number.isInteger(v) && v >= 1 && v <= 200) {
      return { viteza_medie: v, viteza_medie_sursa: 'manual' };
    }
  }
  return { viteza_medie: calcVitezaMedie(distanta_km, durata_condus_sec), viteza_medie_sursa: 'auto' };
}

// ─── Ambulanțe CRUD ─────────────────────────────────────────────────────────

// GET /api/amb/ambulante
router.get('/ambulante', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const toate = req.query.toate === 'true';
    const where = toate ? '' : 'WHERE a.activ = 1';
    const sql = `
      SELECT a.*,
        (SELECT MAX(data_activitate) FROM amb_zile WHERE ambulanta_id = a.id) AS ultima_activitate
      FROM amb_ambulante a
      ${where}
      ORDER BY a.numar_inmatriculare
    `;
    res.json(db.prepare(sql).all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/amb/ambulante
router.post('/ambulante', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const nr = (req.body.numar_inmatriculare || '').toUpperCase().trim();
    const err = validateNr(nr);
    if (err) return res.status(400).json({ error: err });

    const odometru = parseFloat(req.body.odometru_curent) || 0;
    if (odometru < 0) return res.status(400).json({ error: 'Odometrul nu poate fi negativ.' });

    let result;
    try {
      result = db.prepare(
        'INSERT INTO amb_ambulante (numar_inmatriculare, odometru_curent) VALUES (?, ?)'
      ).run(nr, odometru);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        return res.status(409).json({ error: `Ambulanța ${nr} există deja.` });
      }
      throw e;
    }

    res.status(201).json(db.prepare('SELECT * FROM amb_ambulante WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/amb/ambulante/:id
router.put('/ambulante/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM amb_ambulante WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ambulanța nu a fost găsită.' });

    const nr = req.body.numar_inmatriculare !== undefined
      ? (req.body.numar_inmatriculare || '').toUpperCase().trim()
      : existing.numar_inmatriculare;

    const err = validateNr(nr);
    if (err) return res.status(400).json({ error: err });

    const odometru = req.body.odometru_curent !== undefined
      ? parseFloat(req.body.odometru_curent)
      : existing.odometru_curent;
    if (odometru < 0) return res.status(400).json({ error: 'Odometrul nu poate fi negativ.' });

    try {
      db.prepare(
        "UPDATE amb_ambulante SET numar_inmatriculare=?, odometru_curent=?, updated_at=datetime('now') WHERE id=?"
      ).run(nr, odometru, req.params.id);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        return res.status(409).json({ error: `Numărul de înmatriculare ${nr} aparține altei ambulanțe.` });
      }
      throw e;
    }

    res.json(db.prepare('SELECT * FROM amb_ambulante WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/amb/ambulante/:id  (soft delete — refuză dacă are zi deschisă)
router.delete('/ambulante/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM amb_ambulante WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ambulanța nu a fost găsită.' });
    if (!existing.activ) return res.status(400).json({ error: 'Ambulanța este deja dezactivată.' });

    const ziDeschisa = db.prepare(
      "SELECT id FROM amb_zile WHERE ambulanta_id = ? AND status = 'deschisa' LIMIT 1"
    ).get(req.params.id);
    if (ziDeschisa) {
      return res.status(409).json({ error: 'Ambulanța are o zi de activitate deschisă. Finalizați ziua înainte de dezactivare.' });
    }

    db.prepare('DELETE FROM amb_ambulante WHERE id=?').run(req.params.id);
    res.json({ success: true, message: `Ambulanța ${existing.numar_inmatriculare} a fost ștearsă.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Zile ───────────────────────────────────────────────────────────────────

// GET /api/amb/zile
router.get('/zile', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const { ambulanta_id, de_la, pana_la } = req.query;
    let sql = `SELECT z.*, a.numar_inmatriculare
               FROM amb_zile z
               JOIN amb_ambulante a ON z.ambulanta_id = a.id
               WHERE 1=1`;
    const params = [];
    if (ambulanta_id) { sql += ' AND z.ambulanta_id = ?'; params.push(ambulanta_id); }
    if (de_la)        { sql += ' AND z.data_activitate >= ?'; params.push(de_la); }
    if (pana_la)      { sql += ' AND z.data_activitate <= ?'; params.push(pana_la); }
    sql += ' ORDER BY z.data_activitate DESC, z.id DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/amb/zile
router.post('/zile', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const { ambulanta_id, data_activitate, locatie_start, odometru_start } = req.body;

    if (!ambulanta_id || !data_activitate || !locatie_start) {
      return res.status(400).json({ error: 'ambulanta_id, data_activitate și locatie_start sunt obligatorii.' });
    }

    const ambulanta = db.prepare('SELECT * FROM amb_ambulante WHERE id = ? AND activ = 1').get(ambulanta_id);
    if (!ambulanta) return res.status(404).json({ error: 'Ambulanța nu a fost găsită sau este inactivă.' });

    const existing = db.prepare('SELECT * FROM amb_zile WHERE ambulanta_id = ? AND data_activitate = ?')
      .get(ambulanta_id, data_activitate);
    if (existing) {
      return res.status(409).json({
        error: `Există deja o zi de activitate pentru ${ambulanta.numar_inmatriculare} pe ${data_activitate}.`,
        zi_existenta_id: existing.id
      });
    }

    const odometruStart = odometru_start !== undefined
      ? parseFloat(odometru_start)
      : ambulanta.odometru_curent;

    const result = db.prepare(
      'INSERT INTO amb_zile (ambulanta_id, data_activitate, locatie_start, odometru_start, creat_de) VALUES (?, ?, ?, ?, ?)'
    ).run(ambulanta_id, data_activitate, locatie_start, odometruStart, req.user.id);

    inregistreazaAdresa(db, locatie_start);

    res.status(201).json(db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/amb/zile/:id  (zi + curse ordonate)
router.get('/zile/:id', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const zi = db.prepare(
      'SELECT z.*, a.numar_inmatriculare, a.odometru_curent FROM amb_zile z JOIN amb_ambulante a ON z.ambulanta_id = a.id WHERE z.id = ?'
    ).get(req.params.id);
    if (!zi) return res.status(404).json({ error: 'Ziua nu a fost găsită.' });
    const curse = db.prepare('SELECT * FROM amb_curse WHERE zi_id = ? ORDER BY ordine').all(req.params.id);
    res.json({ ...zi, curse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/amb/zile/:id
router.put('/zile/:id', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const zi = db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(req.params.id);
    if (!zi) return res.status(404).json({ error: 'Ziua nu a fost găsită.' });

    const newLocatieStart  = req.body.locatie_start  !== undefined ? req.body.locatie_start  : zi.locatie_start;
    const newLocatieFinala = req.body.locatie_final  !== undefined ? req.body.locatie_final  : zi.locatie_final;
    const newOdometruStart = req.body.odometru_start !== undefined ? parseFloat(req.body.odometru_start) : zi.odometru_start;
    const newOdometruFinal = req.body.odometru_final !== undefined ? parseFloat(req.body.odometru_final) : zi.odometru_final;

    db.prepare(
      "UPDATE amb_zile SET locatie_start=?, locatie_final=?, odometru_start=?, odometru_final=?, updated_at=datetime('now') WHERE id=?"
    ).run(newLocatieStart, newLocatieFinala, newOdometruStart, newOdometruFinal, req.params.id);

    if (req.body.locatie_start !== undefined) inregistreazaAdresa(db, newLocatieStart);
    if (req.body.locatie_final !== undefined) inregistreazaAdresa(db, newLocatieFinala);

    if (req.body.odometru_start !== undefined && parseFloat(req.body.odometru_start) !== zi.odometru_start) {
      propagateOdometer(db, req.params.id);
    }

    const curse = db.prepare('SELECT * FROM amb_curse WHERE zi_id = ? ORDER BY ordine').all(req.params.id);
    res.json({ ...db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(req.params.id), curse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/amb/zile/:id/finalizare
router.post('/zile/:id/finalizare', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const zi = db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(req.params.id);
    if (!zi) return res.status(404).json({ error: 'Ziua nu a fost găsită.' });
    if (zi.status === 'finalizata') return res.status(400).json({ error: 'Ziua este deja finalizată.' });

    const { locatie_final, odometru_final } = req.body;
    if (!locatie_final) return res.status(400).json({ error: 'locatie_final este obligatorie.' });

    const curse = db.prepare('SELECT * FROM amb_curse WHERE zi_id = ? ORDER BY ordine').all(req.params.id);
    const lastCursa = curse[curse.length - 1];
    const odometruFinal = odometru_final !== undefined
      ? parseFloat(odometru_final)
      : (lastCursa ? lastCursa.odometru_final : zi.odometru_start);

    if (odometruFinal < zi.odometru_start) {
      return res.status(400).json({ error: 'Odometrul final nu poate fi mai mic decât cel inițial.' });
    }

    const avertismente = [];
    const kmCurse    = Math.round(curse.reduce((s, c) => s + c.distanta_km, 0) * 100) / 100;
    const kmOdometru = Math.round((odometruFinal - zi.odometru_start) * 100) / 100;
    if (Math.abs(kmCurse - kmOdometru) > 1) {
      avertismente.push(`Discrepanță: suma curselor (${kmCurse} km) diferă de odometru (${kmOdometru} km) cu mai mult de 1 km.`);
    }

    db.prepare(
      "UPDATE amb_zile SET status='finalizata', locatie_final=?, odometru_final=?, updated_at=datetime('now') WHERE id=?"
    ).run(locatie_final, odometruFinal, req.params.id);

    inregistreazaAdresa(db, locatie_final);

    db.prepare(
      "UPDATE amb_ambulante SET odometru_curent=?, updated_at=datetime('now') WHERE id=?"
    ).run(odometruFinal, zi.ambulanta_id);

    res.json({ ...db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(req.params.id), avertismente });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/amb/zile/:id/redeschidere  (admin only)
router.post('/zile/:id/redeschidere', requireAmbAccess, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const zi = db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(req.params.id);
    if (!zi) return res.status(404).json({ error: 'Ziua nu a fost găsită.' });
    if (zi.status !== 'finalizata') {
      return res.status(400).json({ error: 'Ziua nu este finalizată.' });
    }

    db.prepare(
      "UPDATE amb_zile SET status='deschisa', updated_at=datetime('now') WHERE id=?"
    ).run(req.params.id);

    res.json(db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/amb/ambulante
router.post('/ambulante', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const nr = (req.body.numar_inmatriculare || '').toUpperCase().trim();
    const err = validateNr(nr);
    if (err) return res.status(400).json({ error: err });

    const odometru = parseFloat(req.body.odometru_curent) || 0;
    if (odometru < 0) return res.status(400).json({ error: 'Odometrul nu poate fi negativ.' });

    // Verifică dacă există deja o ambulanță inactivă cu același număr
    const existingInactiva = db.prepare(
      'SELECT * FROM amb_ambulante WHERE numar_inmatriculare = ? AND activ = 0'
    ).get(nr);

    if (existingInactiva) {
      // Reactivează în loc să insereze
      db.prepare(
        "UPDATE amb_ambulante SET activ=1, odometru_curent=?, updated_at=datetime('now') WHERE id=?"
      ).run(odometru, existingInactiva.id);
      return res.status(201).json(
        db.prepare('SELECT * FROM amb_ambulante WHERE id = ?').get(existingInactiva.id)
      );
    }

    // Verifică dacă există deja activă
    const existingActiva = db.prepare(
      'SELECT * FROM amb_ambulante WHERE numar_inmatriculare = ? AND activ = 1'
    ).get(nr);
    if (existingActiva) {
      return res.status(409).json({ error: `Ambulanța ${nr} există deja și este activă.` });
    }

    let result;
    try {
      result = db.prepare(
        'INSERT INTO amb_ambulante (numar_inmatriculare, odometru_curent) VALUES (?, ?)'
      ).run(nr, odometru);
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE')) {
        return res.status(409).json({ error: `Ambulanța ${nr} există deja.` });
      }
      throw e;
    }

    res.status(201).json(
      db.prepare('SELECT * FROM amb_ambulante WHERE id = ?').get(result.lastInsertRowid)
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/amb/zile/:id  (admin only, doar nefinalizate)
router.delete('/zile/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const zi = db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(req.params.id);
    if (!zi) return res.status(404).json({ error: 'Ziua nu a fost găsită.' });
    if (zi.status === 'finalizata') {
      return res.status(400).json({ error: 'Ziua finalizată nu poate fi ștearsă. Folosiți redeschiderea mai întâi.' });
    }

    db.prepare('DELETE FROM amb_curse WHERE zi_id = ?').run(req.params.id);
    db.prepare('DELETE FROM amb_zile WHERE id = ?').run(req.params.id);

    const ultimaZiFinalizata = db.prepare(
      "SELECT odometru_final FROM amb_zile WHERE ambulanta_id = ? AND status = 'finalizata' ORDER BY data_activitate DESC, id DESC LIMIT 1"
    ).get(zi.ambulanta_id);
    if (ultimaZiFinalizata) {
      db.prepare(
        "UPDATE amb_ambulante SET odometru_curent=?, updated_at=datetime('now') WHERE id=?"
      ).run(ultimaZiFinalizata.odometru_final, zi.ambulanta_id);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Adrese frecvente (autocomplete) ─────────────────────────────────────────

// GET /api/amb/adrese?q=text
router.get('/adrese', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const q = (req.query.q || '').trim();
    let sql = 'SELECT adresa, utilizari FROM amb_adrese_frecvente';
    const params = [];
    if (q) {
      sql += ' WHERE adresa LIKE ? COLLATE NOCASE';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY utilizari DESC, ultima_utilizare DESC LIMIT 10';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Curse ──────────────────────────────────────────────────────────────────

// POST /api/amb/zile/:id/curse
router.post('/zile/:id/curse', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const zi = db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(req.params.id);
    if (!zi) return res.status(404).json({ error: 'Ziua nu a fost găsită.' });
    if (zi.status === 'finalizata') {
      return res.status(400).json({ error: 'Nu se pot adăuga curse la o zi finalizată.' });
    }

    const {
      data_cursa, ora_plecare, ora_sosire,
      locatie_plecare, locatie_sosire,
      distanta_km, distanta_sursa,
      viteza_maxima, stationare_pornit_sec
    } = req.body;

    if (!ora_plecare || !ora_sosire || !locatie_plecare || !locatie_sosire || distanta_km === undefined) {
      return res.status(400).json({ error: 'Câmpuri obligatorii: ora_plecare, ora_sosire, locatie_plecare, locatie_sosire, distanta_km.' });
    }

    if (timeToSec(ora_sosire) <= timeToSec(ora_plecare)) {
      return res.status(400).json({
        error: 'ora_sosire trebuie să fie după ora_plecare. Cursele peste miezul nopții nu sunt suportate — creați o cursă separată pe ziua următoare.'
      });
    }

    const distKm = parseFloat(distanta_km);
    if (distKm < 0) return res.status(400).json({ error: 'distanta_km nu poate fi negativă.' });

    const curseExistente = db.prepare('SELECT * FROM amb_curse WHERE zi_id = ? ORDER BY ordine').all(req.params.id);
    const ordine = curseExistente.length + 1;
    const lastCursa = curseExistente[curseExistente.length - 1];

    const odometruStart = lastCursa ? lastCursa.odometru_final : zi.odometru_start;
    const odometruFinal = Math.round((odometruStart + distKm) * 100) / 100;

    if (odometruFinal < odometruStart) {
      return res.status(400).json({ error: 'Odometrul final nu poate fi mai mic decât cel inițial.' });
    }

    const durata_condus_sec = timeToSec(ora_sosire) - timeToSec(ora_plecare);
    const { viteza_medie, viteza_medie_sursa } = resolveViteza(req.body.viteza_medie, distKm, durata_condus_sec);

    const avertismente = [];
    const newStart = timeToSec(ora_plecare);
    const newEnd   = timeToSec(ora_sosire);
    for (const c of curseExistente) {
      if (newStart < timeToSec(c.ora_sosire) && newEnd > timeToSec(c.ora_plecare)) {
        avertismente.push(`Suprapunere temporală cu cursa #${c.ordine} (${c.ora_plecare}–${c.ora_sosire}).`);
      }
    }

    const result = db.prepare(`
      INSERT INTO amb_curse
        (zi_id, ordine, data_cursa, ora_plecare, ora_sosire,
         locatie_plecare, locatie_sosire,
         distanta_km, distanta_sursa,
         odometru_start, odometru_final,
         durata_condus_sec, stationare_pornit_sec,
         viteza_medie, viteza_medie_sursa, viteza_maxima)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      req.params.id, ordine,
      data_cursa || zi.data_activitate,
      ora_plecare, ora_sosire,
      locatie_plecare, locatie_sosire,
      distKm, distanta_sursa || 'manual',
      odometruStart, odometruFinal,
      durata_condus_sec,
      stationare_pornit_sec !== undefined ? parseInt(stationare_pornit_sec) : 0,
      viteza_medie, viteza_medie_sursa,
      viteza_maxima !== undefined ? parseInt(viteza_maxima) : null
    );

    recalcStationariOprit(db, req.params.id);

    inregistreazaAdresa(db, locatie_plecare);
    inregistreazaAdresa(db, locatie_sosire);

    const cursa = db.prepare('SELECT * FROM amb_curse WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...cursa, avertismente });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/amb/curse/:id
router.put('/curse/:id', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const cursa = db.prepare('SELECT * FROM amb_curse WHERE id = ?').get(req.params.id);
    if (!cursa) return res.status(404).json({ error: 'Cursa nu a fost găsită.' });

    const zi = db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(cursa.zi_id);
    if (zi.status === 'finalizata') {
      return res.status(400).json({ error: 'Nu se pot modifica curse dintr-o zi finalizată.' });
    }

    const newOraPlecare    = req.body.ora_plecare      !== undefined ? req.body.ora_plecare      : cursa.ora_plecare;
    const newOraSosire     = req.body.ora_sosire       !== undefined ? req.body.ora_sosire       : cursa.ora_sosire;
    const newLocPlecare    = req.body.locatie_plecare  !== undefined ? req.body.locatie_plecare  : cursa.locatie_plecare;
    const newLocSosire     = req.body.locatie_sosire   !== undefined ? req.body.locatie_sosire   : cursa.locatie_sosire;
    const newDistanta      = req.body.distanta_km      !== undefined ? parseFloat(req.body.distanta_km) : cursa.distanta_km;
    const newDistSursa     = req.body.distanta_sursa   !== undefined ? req.body.distanta_sursa   : cursa.distanta_sursa;
    const newVitezaMax     = req.body.viteza_maxima    !== undefined ? parseInt(req.body.viteza_maxima)  : cursa.viteza_maxima;
    const newStatPornit    = req.body.stationare_pornit_sec !== undefined ? parseInt(req.body.stationare_pornit_sec) : cursa.stationare_pornit_sec;

    if (timeToSec(newOraSosire) <= timeToSec(newOraPlecare)) {
      return res.status(400).json({ error: 'ora_sosire trebuie să fie după ora_plecare.' });
    }

    if (newDistanta < 0) return res.status(400).json({ error: 'distanta_km nu poate fi negativă.' });

    const newDurata = timeToSec(newOraSosire) - timeToSec(newOraPlecare);

    // Dacă distanța sau orele s-au schimbat → recalculare automată, ignorând valoarea clientului.
    // Altfel → acceptăm viteza_medie trimisă manual dacă e validă.
    const distancaChanged = req.body.distanta_km !== undefined &&
      parseFloat(req.body.distanta_km) !== cursa.distanta_km;
    const oreChanged = (req.body.ora_plecare !== undefined && req.body.ora_plecare !== cursa.ora_plecare) ||
      (req.body.ora_sosire !== undefined && req.body.ora_sosire !== cursa.ora_sosire);

    let newVitezaMed, newVitezaSursa;
    if (distancaChanged || oreChanged) {
      newVitezaMed   = calcVitezaMedie(newDistanta, newDurata);
      newVitezaSursa = 'auto';
    } else {
      const r = resolveViteza(req.body.viteza_medie, newDistanta, newDurata);
      newVitezaMed   = r.viteza_medie;
      newVitezaSursa = req.body.viteza_medie !== undefined ? r.viteza_medie_sursa : cursa.viteza_medie_sursa;
    }

    db.prepare(`
      UPDATE amb_curse
      SET ora_plecare=?, ora_sosire=?,
          locatie_plecare=?, locatie_sosire=?,
          distanta_km=?, distanta_sursa=?,
          durata_condus_sec=?, viteza_medie=?, viteza_medie_sursa=?, viteza_maxima=?,
          stationare_pornit_sec=?,
          updated_at=datetime('now')
      WHERE id=?
    `).run(
      newOraPlecare, newOraSosire,
      newLocPlecare, newLocSosire,
      newDistanta, newDistSursa,
      newDurata, newVitezaMed, newVitezaSursa, newVitezaMax,
      newStatPornit,
      req.params.id
    );

    propagateOdometer(db, cursa.zi_id);
    recalcStationariOprit(db, cursa.zi_id);

    if (req.body.locatie_plecare !== undefined) inregistreazaAdresa(db, newLocPlecare);
    if (req.body.locatie_sosire !== undefined) inregistreazaAdresa(db, newLocSosire);

    res.json(db.prepare('SELECT * FROM amb_curse WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/amb/curse/:id
router.delete('/curse/:id', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const cursa = db.prepare('SELECT * FROM amb_curse WHERE id = ?').get(req.params.id);
    if (!cursa) return res.status(404).json({ error: 'Cursa nu a fost găsită.' });

    const zi = db.prepare('SELECT * FROM amb_zile WHERE id = ?').get(cursa.zi_id);
    if (zi.status === 'finalizata') {
      return res.status(400).json({ error: 'Nu se pot șterge curse dintr-o zi finalizată.' });
    }

    const ziId = cursa.zi_id;
    db.prepare('DELETE FROM amb_curse WHERE id = ?').run(req.params.id);

    // Reordonare după ștergere
    const ramase = db.prepare('SELECT * FROM amb_curse WHERE zi_id = ? ORDER BY ordine').all(ziId);
    ramase.forEach((c, i) => {
      if (c.ordine !== i + 1) {
        db.prepare('UPDATE amb_curse SET ordine=? WHERE id=?').run(i + 1, c.id);
      }
    });

    propagateOdometer(db, ziId);
    recalcStationariOprit(db, ziId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Raport ─────────────────────────────────────────────────────────────────

const ZI_SAPTAMANA = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

function sumarCurse(curse) {
  const first = curse[0];
  const last  = curse[curse.length - 1];
  const total_km           = Math.round(curse.reduce((s, c) => s + c.distanta_km, 0) * 100) / 100;
  const condus_sec         = curse.reduce((s, c) => s + (c.durata_condus_sec    || 0), 0);
  const stationare_pornit  = curse.reduce((s, c) => s + (c.stationare_pornit_sec || 0), 0);
  const stationare_oprit   = curse.reduce((s, c) => s + (c.stationare_oprit_sec  || 0), 0);
  const viteza_medie       = condus_sec > 0 ? Math.round(total_km / (condus_sec / 3600)) : null;
  const viteza_maxima      = curse.reduce((mx, c) => {
    if (c.viteza_maxima === null || c.viteza_maxima === undefined) return mx;
    return mx === null || c.viteza_maxima > mx ? c.viteza_maxima : mx;
  }, null);
  return { first, last, total_km, condus_sec, stationare_pornit_sec: stationare_pornit, stationare_oprit_sec: stationare_oprit, viteza_medie, viteza_maxima };
}

// GET /api/amb/raport
router.get('/raport', requireAmbAccess, (req, res) => {
  try {
    const db = getDb();
    const { ambulanta_id, de_la, pana_la, include_deschise } = req.query;

    if (!ambulanta_id || !de_la || !pana_la) {
      return res.status(400).json({ error: 'ambulanta_id, de_la și pana_la sunt obligatorii.' });
    }

    const ambulanta = db.prepare('SELECT id, numar_inmatriculare FROM amb_ambulante WHERE id = ?').get(ambulanta_id);
    if (!ambulanta) return res.status(404).json({ error: 'Ambulanța nu a fost găsită.' });

    const includeDeschise = include_deschise === 'true';
    let sql = 'SELECT * FROM amb_zile WHERE ambulanta_id=? AND data_activitate>=? AND data_activitate<=?';
    if (!includeDeschise) sql += " AND status='finalizata'";
    sql += ' ORDER BY data_activitate ASC, id ASC';

    const zileRaw = db.prepare(sql).all(ambulanta_id, de_la, pana_la);

    const zile = zileRaw.map(zi => {
      const curse = db.prepare('SELECT * FROM amb_curse WHERE zi_id=? ORDER BY ordine ASC').all(zi.id);
      const [y, m, d] = zi.data_activitate.split('-').map(Number);
      const ziSapt = ZI_SAPTAMANA[new Date(y, m - 1, d).getDay()];

      const s = curse.length ? sumarCurse(curse) : null;
      const sumar_zi = s ? {
        data_start:           s.first.data_cursa,
        ora_start:            s.first.ora_plecare,
        locatie_start:        s.first.locatie_plecare,
        data_final:           s.last.data_cursa,
        ora_final:            s.last.ora_sosire,
        locatie_final:        s.last.locatie_sosire,
        total_km:             s.total_km,
        odometru_start:       zi.odometru_start,
        odometru_final:       zi.odometru_final,
        condus_sec:           s.condus_sec,
        stationare_pornit_sec: s.stationare_pornit_sec,
        stationare_oprit_sec:  s.stationare_oprit_sec,
        viteza_medie:         s.viteza_medie,
        viteza_maxima:        s.viteza_maxima
      } : null;

      return { id: zi.id, data: zi.data_activitate, zi_saptamana: ziSapt, status: zi.status, sumar_zi, curse };
    });

    // Sumar perioadă
    const toateCursele = zile.flatMap(z => z.curse);
    const firstZi = zileRaw[0];
    const lastZi  = zileRaw[zileRaw.length - 1];
    const sp = toateCursele.length ? sumarCurse(toateCursele) : null;
    const sumar_perioada = sp ? {
      data_start:            sp.first.data_cursa,
      locatie_start:         sp.first.locatie_plecare,
      data_final:            sp.last.data_cursa,
      locatie_final:         sp.last.locatie_sosire,
      total_km:              sp.total_km,
      odometru_start:        firstZi.odometru_start,
      odometru_final:        lastZi.odometru_final,
      condus_sec:            sp.condus_sec,
      stationare_pornit_sec: sp.stationare_pornit_sec,
      stationare_oprit_sec:  sp.stationare_oprit_sec,
      viteza_medie:          sp.viteza_medie,
      viteza_maxima:         sp.viteza_maxima
    } : null;

    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    const data_generare = `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`;

    res.json({ ambulanta, perioada: { de_la, pana_la }, data_generare, sumar_perioada, zile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Proxy Google Distance Matrix ────────────────────────────────────────────

// POST /api/amb/distanta
router.post('/distanta', requireAmbAccess, async (req, res) => {
  try {
    const { origine, destinatie } = req.body;
    if (!origine || !destinatie) {
      return res.status(400).json({ error: 'Câmpurile „origine" și „destinatie" sunt obligatorii.' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY nu este configurat pe server.' });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', origine);
    url.searchParams.set('destinations', destinatie);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('region', 'ro');
    url.searchParams.set('language', 'ro');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return res.status(502).json({ status: 'eroare', error: `Google API HTTP ${response.status}` });
    }

    const data = await response.json();
    if (data.status !== 'OK') {
      return res.json({ status: 'eroare', error: data.status, error_message: data.error_message });
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      return res.json({ status: 'negasit', error: element?.status || 'UNKNOWN' });
    }

    res.json({
      status: 'ok',
      distanta_km: Math.round((element.distance.value / 1000) * 100) / 100,
      durata_sec: element.duration.value
    });
  } catch (err) {
    res.status(500).json({ status: 'eroare', error: err.message });
  }
});

module.exports = router;
