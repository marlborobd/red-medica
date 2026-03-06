const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'asistenta.db');

let sqlJsDb = null;

function saveDb() {
  if (!sqlJsDb) return;
  try {
    const data = sqlJsDb.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('[DB] Eroare la salvare pe disc:', err.message);
  }
}

class Statement {
  constructor(sql) { this._sql = sql; }

  get(...args) {
    const params = args.flat().map(v => (v === undefined ? null : v));
    const stmt = sqlJsDb.prepare(this._sql);
    try {
      if (params.length > 0) stmt.bind(params);
      return stmt.step() ? stmt.getAsObject() : undefined;
    } finally { stmt.free(); }
  }

  all(...args) {
    const params = args.flat().map(v => (v === undefined ? null : v));
    const stmt = sqlJsDb.prepare(this._sql);
    try {
      if (params.length > 0) stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally { stmt.free(); }
  }

  run(...args) {
    const params = args.flat().map(v => (v === undefined ? null : v));
    sqlJsDb.run(this._sql, params.length > 0 ? params : undefined);
    const idResult = sqlJsDb.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = idResult.length > 0 ? idResult[0].values[0][0] : 0;
    saveDb();
    return { lastInsertRowid };
  }
}

const db = {
  exec(sql) { sqlJsDb.exec(sql); return this; },
  pragma(str) { try { sqlJsDb.run('PRAGMA ' + str); } catch (_) {} return this; },
  prepare(sql) { return new Statement(sql); }
};

function getDb() {
  if (!sqlJsDb) throw new Error('Baza de date nu este inițializată');
  return db;
}

// ===== Migrare: elimină constrângerea NOT NULL de pe cnp =====
function migrateCnpColumn() {
  try {
    const stmt = sqlJsDb.prepare('PRAGMA table_info(patients)');
    const cols = [];
    while (stmt.step()) cols.push(stmt.getAsObject());
    stmt.free();

    const cnpCol = cols.find(c => c.name === 'cnp');
    if (!cnpCol || !cnpCol.notnull) return; // deja ok sau coloana nu există

    console.log('Migration: eliminare constrângere cnp NOT NULL...');
    sqlJsDb.exec(`
      CREATE TABLE patients_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nume TEXT NOT NULL,
        cnp TEXT,
        data_nasterii TEXT,
        varsta INTEGER,
        adresa TEXT,
        telefon TEXT,
        acord_gdpr INTEGER DEFAULT 0,
        utilizator_creator_id INTEGER,
        data_inregistrare TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (utilizator_creator_id) REFERENCES users(id)
      );
      INSERT INTO patients_v2
        SELECT id, nume, cnp, data_nasterii, varsta, adresa, telefon,
               acord_gdpr, utilizator_creator_id, data_inregistrare
        FROM patients;
      DROP TABLE patients;
      ALTER TABLE patients_v2 RENAME TO patients;
    `);
    saveDb();
    console.log('✓ Migration cnp completată');
  } catch (err) {
    console.error('[Migration cnp]', err.message);
  }
}

// ===== Migrare: adaugă coloana poze în visits dacă nu există =====
function migrateAddPozeColumn() {
  try {
    sqlJsDb.exec("ALTER TABLE visits ADD COLUMN poze TEXT DEFAULT '[]'");
    saveDb();
    console.log('✓ Migration: coloana poze adăugată');
  } catch (_) {}
}

// ===== Migrare: adaugă status_preluare în patients =====
function migrateStatusPreluare() {
  try {
    sqlJsDb.exec("ALTER TABLE patients ADD COLUMN status_preluare TEXT DEFAULT 'ACTIV'");
    saveDb();
    console.log('✓ Migration: coloana status_preluare adăugată');
  } catch (_) {}
}

// ===== Migrare: adaugă redirectionat_catre_id în patients =====
function migrateRedirectionatCatreId() {
  try {
    sqlJsDb.exec('ALTER TABLE patients ADD COLUMN redirectionat_catre_id INTEGER');
    saveDb();
    console.log('✓ Migration: coloana redirectionat_catre_id adăugată');
  } catch (_) {}
}

// ===== Migrare: creare tabelă vizite_programate =====
function migrateViziteProgramate() {
  try {
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS vizite_programate (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pacient_id INTEGER NOT NULL,
        data_programata TEXT NOT NULL,
        ora_programata TEXT NOT NULL,
        angajat_responsabil INTEGER NOT NULL,
        status TEXT DEFAULT 'PROGRAMAT',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (pacient_id) REFERENCES patients(id),
        FOREIGN KEY (angajat_responsabil) REFERENCES users(id)
      )
    `);
    saveDb();
    console.log('✓ Migration: tabela vizite_programate creata');
  } catch (err) {
    console.error('[Migration vizite_programate]', err.message);
  }
}

// ===== Migrare: creare tabelă push_subscriptions =====
function migratePushSubscriptions() {
  try {
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL,
        subscription TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    saveDb();
    console.log('✓ Migration: tabela push_subscriptions creata');
  } catch (err) {
    console.error('[Migration push_subscriptions]', err.message);
  }
}

async function initDatabase() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`✓ Director creat: ${dbDir}`);
  }

  const SQL = await initSqlJs({
    locateFile: filename =>
      path.join(__dirname, 'node_modules', 'sql.js', 'dist', filename)
  });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL.Database(fileBuffer);
    console.log(`✓ Baza de date încărcată: ${DB_PATH}`);
  } else {
    sqlJsDb = new SQL.Database();
    console.log(`✓ Baza de date nouă: ${DB_PATH}`);
  }

  // Creare tabele noi (fără cnp NOT NULL/UNIQUE)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'employee' CHECK(role IN ('admin', 'employee')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nume TEXT NOT NULL,
      cnp TEXT,
      data_nasterii TEXT,
      varsta INTEGER,
      adresa TEXT,
      telefon TEXT,
      acord_gdpr INTEGER DEFAULT 0,
      utilizator_creator_id INTEGER,
      data_inregistrare TEXT DEFAULT (datetime('now', 'localtime')),
      status_preluare TEXT DEFAULT 'ACTIV',
      redirectionat_catre_id INTEGER,
      FOREIGN KEY (utilizator_creator_id) REFERENCES users(id),
      FOREIGN KEY (redirectionat_catre_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS vizite_programate (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pacient_id INTEGER NOT NULL,
      data_programata TEXT NOT NULL,
      ora_programata TEXT NOT NULL,
      angajat_responsabil INTEGER NOT NULL,
      status TEXT DEFAULT 'PROGRAMAT' CHECK(status IN ('PROGRAMAT', 'EFECTUAT')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (pacient_id) REFERENCES patients(id),
      FOREIGN KEY (angajat_responsabil) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      subscription TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      data TEXT,
      ora TEXT,
      angajat_id INTEGER NOT NULL,
      diagnostic TEXT,
      tratament TEXT,
      cass TEXT,
      perioada_tratament_inceput TEXT,
      perioada_tratament_sfarsit TEXT,
      zile_cass INTEGER,
      servicii_efectuate TEXT,
      stare_pacient TEXT,
      medicamente TEXT,
      tensiune TEXT,
      temperatura REAL,
      observatii TEXT,
      suma_de_plata REAL DEFAULT 0,
      suma_incasata REAL DEFAULT 0,
      poze TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (angajat_id) REFERENCES users(id)
    );
  `);

  // Migrări pentru baze de date existente
  migrateCnpColumn();
  migrateAddPozeColumn();
  migrateStatusPreluare();
  migrateRedirectionatCatreId();
  migrateViziteProgramate();
  migratePushSubscriptions();

  // Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@asistenta.ro';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminName = process.env.ADMIN_NAME || 'Administrator';

  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)')
      .run(adminEmail, hashedPassword, adminName, 'admin');
    console.log(`✓ Admin creat: ${adminEmail}`);
  }

  saveDb();
  console.log('✓ Baza de date inițializată cu succes');
}

module.exports = { getDb, initDatabase };
