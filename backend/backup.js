const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./database');

const BACKUP_DIR = process.env.DATABASE_PATH
  ? path.join(path.dirname(path.resolve(process.env.DATABASE_PATH)), 'backups')
  : path.join(__dirname, 'backups');

const BACKUP_FILE = path.join(BACKUP_DIR, 'RedMedica_Backup.xlsx');
const LAST_BACKUP_FILE = path.join(BACKUP_DIR, 'last_backup.json');

let lastBackupAt = null;
let lastBackupFile = null;

// Încarcă ultimul backup la pornire
function loadLastBackup() {
  try {
    if (fs.existsSync(LAST_BACKUP_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_BACKUP_FILE, 'utf8'));
      lastBackupAt = data.lastBackupAt || null;
      lastBackupFile = data.lastBackupFile || null;
      console.log(`✓ [Backup] Ultimul backup: ${lastBackupAt}`);
    }
  } catch (err) {
    console.error('[Backup] Eroare la încărcare last_backup.json:', err.message);
  }
}

function getLastBackup() {
  return { lastBackupAt, lastBackupFile };
}

function applyHeaderStyle(row) {
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF922B21' } }
    };
  });
  row.height = 22;
}

function applyRowStyle(row, rowIndex) {
  const bgColor = rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFFADBD8';
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    cell.alignment = { vertical: 'middle' };
  });
  row.height = 18;
}

function splitName(fullName) {
  if (!fullName) return ['', ''];
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ''];
  const prenume = parts[parts.length - 1];
  const nume = parts.slice(0, -1).join(' ');
  return [nume, prenume];
}

async function runBackup() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const db = getDb();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RedMedica';
  workbook.created = new Date();

  // ===== Foaia Pacienti =====
  const shPacienti = workbook.addWorksheet('Pacienti');
  shPacienti.columns = [
    { header: 'ID',                  key: 'id',                   width: 8  },
    { header: 'Nume',                key: 'nume',                 width: 22 },
    { header: 'Prenume',             key: 'prenume',              width: 22 },
    { header: 'Data_Nasterii',       key: 'data_nasterii',        width: 15 },
    { header: 'Varsta',              key: 'varsta',               width: 10 },
    { header: 'Adresa',              key: 'adresa',               width: 35 },
    { header: 'Telefon',             key: 'telefon',              width: 16 },
    { header: 'Acord_GDPR',          key: 'acord_gdpr',           width: 13 },
    { header: 'Angajat_Responsabil', key: 'angajat_responsabil',  width: 28 },
    { header: 'Data_Inregistrare',   key: 'data_inregistrare',    width: 20 },
    { header: 'Status_Preluare',     key: 'status_preluare',      width: 18 },
  ];
  applyHeaderStyle(shPacienti.getRow(1));

  const pacienti = db.prepare(`
    SELECT p.*, u.name as angajat_name
    FROM patients p
    LEFT JOIN users u ON p.utilizator_creator_id = u.id
    ORDER BY p.id
  `).all();

  pacienti.forEach((p, i) => {
    const [nume, prenume] = splitName(p.nume);
    const row = shPacienti.addRow({
      id: p.id,
      nume,
      prenume,
      data_nasterii:      p.data_nasterii || '',
      varsta:             p.varsta || '',
      adresa:             p.adresa || '',
      telefon:            p.telefon || '',
      acord_gdpr:         p.acord_gdpr ? 'Da' : 'Nu',
      angajat_responsabil: p.angajat_name || '',
      data_inregistrare:  p.data_inregistrare || '',
      status_preluare:    p.status_preluare || '',
    });
    applyRowStyle(row, i + 1);
  });

  // ===== Foaia Vizite =====
  const shVizite = workbook.addWorksheet('Vizite');
  shVizite.columns = [
    { header: 'ID',                          key: 'id',                  width: 8  },
    { header: 'ID_Pacient',                  key: 'patient_id',          width: 12 },
    { header: 'Nume_Pacient',                key: 'nume_pacient',        width: 28 },
    { header: 'Data_Vizitei',                key: 'data',                width: 14 },
    { header: 'Ora_Vizitei',                 key: 'ora',                 width: 12 },
    { header: 'Angajat',                     key: 'angajat',             width: 25 },
    { header: 'Diagnostic',                  key: 'diagnostic',          width: 32 },
    { header: 'Tratament',                   key: 'tratament',           width: 32 },
    { header: 'CASS',                        key: 'cass',                width: 16 },
    { header: 'Suma_De_Plata',               key: 'suma_de_plata',       width: 15 },
    { header: 'Suma_Incasata',               key: 'suma_incasata',       width: 15 },
    { header: 'Perioada_Tratament_Inceput',  key: 'perioada_inceput',    width: 26 },
    { header: 'Perioada_Tratament_Sfarsit',  key: 'perioada_sfarsit',    width: 26 },
    { header: 'Zile_CASS',                   key: 'zile_cass',           width: 12 },
    { header: 'Servicii_Efectuate',          key: 'servicii_efectuate',  width: 32 },
    { header: 'Stare_Pacient',               key: 'stare_pacient',       width: 18 },
    { header: 'Medicamente',                 key: 'medicamente',         width: 32 },
    { header: 'Tensiune',                    key: 'tensiune',            width: 13 },
    { header: 'Temperatura',                 key: 'temperatura',         width: 13 },
    { header: 'Observatii',                  key: 'observatii',          width: 38 },
  ];
  applyHeaderStyle(shVizite.getRow(1));

  const vizite = db.prepare(`
    SELECT v.*, p.nume as pacient_name, u.name as angajat_name
    FROM visits v
    LEFT JOIN patients p ON v.patient_id = p.id
    LEFT JOIN users u ON v.angajat_id = u.id
    ORDER BY v.id
  `).all();

  vizite.forEach((v, i) => {
    const row = shVizite.addRow({
      id:                 v.id,
      patient_id:         v.patient_id,
      nume_pacient:       v.pacient_name || '',
      data:               v.data || '',
      ora:                v.ora || '',
      angajat:            v.angajat_name || '',
      diagnostic:         v.diagnostic || '',
      tratament:          v.tratament || '',
      cass:               v.cass || '',
      suma_de_plata:      v.suma_de_plata || 0,
      suma_incasata:      v.suma_incasata || 0,
      perioada_inceput:   v.perioada_tratament_inceput || '',
      perioada_sfarsit:   v.perioada_tratament_sfarsit || '',
      zile_cass:          v.zile_cass || '',
      servicii_efectuate: v.servicii_efectuate || '',
      stare_pacient:      v.stare_pacient || '',
      medicamente:        v.medicamente || '',
      tensiune:           v.tensiune || '',
      temperatura:        v.temperatura || '',
      observatii:         v.observatii || '',
    });
    applyRowStyle(row, i + 1);
  });

  // ===== Foaia Angajati =====
  const shAngajati = workbook.addWorksheet('Angajati');
  shAngajati.columns = [
    { header: 'ID',      key: 'id',      width: 8  },
    { header: 'Nume',    key: 'nume',    width: 22 },
    { header: 'Prenume', key: 'prenume', width: 22 },
    { header: 'Email',   key: 'email',   width: 32 },
    { header: 'Rol',     key: 'rol',     width: 18 },
  ];
  applyHeaderStyle(shAngajati.getRow(1));

  const angajati = db.prepare('SELECT id, name, email, role FROM users WHERE active = 1 ORDER BY id').all();
  angajati.forEach((a, i) => {
    const [nume, prenume] = splitName(a.name);
    const row = shAngajati.addRow({
      id:      a.id,
      nume,
      prenume,
      email:   a.email,
      rol:     a.role === 'admin' ? 'Administrator' : 'Angajat',
    });
    applyRowStyle(row, i + 1);
  });

  // Salvează fișierul (suprascrie același fișier)
  await workbook.xlsx.writeFile(BACKUP_FILE);

  // Salvează timestamp
  lastBackupAt = new Date().toISOString();
  lastBackupFile = BACKUP_FILE;
  fs.writeFileSync(LAST_BACKUP_FILE, JSON.stringify({ lastBackupAt, lastBackupFile: BACKUP_FILE }, null, 2));

  console.log(`✓ [Backup] ${BACKUP_FILE} actualizat — ${pacienti.length} pacienți, ${vizite.length} vizite, ${angajati.length} angajați`);
}

loadLastBackup();

module.exports = { runBackup, getLastBackup, BACKUP_FILE };
