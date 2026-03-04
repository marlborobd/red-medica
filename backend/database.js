const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Calea DB: configurabilă prin env var (Railway Volume) sau local
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'asistenta.db');

let sqlJsDb = null; // instanța internă sql.js

// ===== Persistență pe disc =====
// sql.js lucrează in-memory; la fiecare scriere exportăm și salvăm pe disc
function saveDb() {
  if (!sqlJsDb) return;
  try {
    const data = sqlJsDb.export(); // Uint8Array cu conținutul SQLite
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('[DB] Eroare la salvare pe disc:', err.message);
  }
}

// ===== Wrapper Statement — API identic cu better-sqlite3 =====
// Rutele existente folosesc .get(), .all(), .run() fără modificări
class Statement {
  constructor(sql) {
    this._sql = sql;
  }

  // Returnează primul rând sau undefined
  get(...args) {
    const params = args.flat().map(v => (v === undefined ? null : v));
    const stmt = sqlJsDb.prepare(this._sql);
    try {
      if (params.length > 0) stmt.bind(params);
      return stmt.step() ? stmt.getAsObject() : undefined;
    } finally {
      stmt.free();
    }
  }

  // Returnează toate rândurile ca array de obiecte
  all(...args) {
    const params = args.flat().map(v => (v === undefined ? null : v));
    const stmt = sqlJsDb.prepare(this._sql);
    try {
      if (params.length > 0) stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }

  // Execută INSERT/UPDATE/DELETE și salvează pe disc
  run(...args) {
    const params = args.flat().map(v => (v === undefined ? null : v));
    sqlJsDb.run(this._sql, params.length > 0 ? params : undefined);
    // Obținem ID-ul ultimului INSERT (0 pentru UPDATE/DELETE)
    const idResult = sqlJsDb.exec('SELECT last_insert_rowid()');
    const lastInsertRowid = idResult.length > 0 ? idResult[0].values[0][0] : 0;
    saveDb(); // persistare imediată după fiecare scriere
    return { lastInsertRowid };
  }
}

// ===== Obiect db — interfață publică compatibilă cu better-sqlite3 =====
const db = {
  // exec(): pentru DDL cu mai multe instrucțiuni (CREATE TABLE etc.)
  exec(sql) {
    sqlJsDb.exec(sql);
    return this;
  },
  // pragma(): setări SQLite
  pragma(str) {
    try { sqlJsDb.run('PRAGMA ' + str); } catch (_) {}
    return this;
  },
  // prepare(): returnează un Statement wrapper
  prepare(sql) {
    return new Statement(sql);
  }
};

function getDb() {
  if (!sqlJsDb) throw new Error('Baza de date nu este inițializată');
  return db;
}

// ===== Inițializare asincronă (sql.js încarcă WebAssembly) =====
async function initDatabase() {
  // Asigură directorul
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`✓ Director creat: ${dbDir}`);
  }

  // Inițializare sql.js cu calea explicită spre fișierul wasm
  const SQL = await initSqlJs({
    locateFile: filename =>
      path.join(__dirname, 'node_modules', 'sql.js', 'dist', filename)
  });

  // Încarcă baza de date existentă sau creează una nouă
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL.Database(fileBuffer);
    console.log(`✓ Baza de date încărcată: ${DB_PATH}`);
  } else {
    sqlJsDb = new SQL.Database();
    console.log(`✓ Baza de date nouă: ${DB_PATH}`);
  }

  // Creare tabele (suportă multiple instrucțiuni separate prin ;)
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
      cnp TEXT UNIQUE NOT NULL,
      data_nasterii TEXT,
      varsta INTEGER,
      adresa TEXT,
      telefon TEXT,
      acord_gdpr INTEGER DEFAULT 0,
      utilizator_creator_id INTEGER,
      data_inregistrare TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (utilizator_creator_id) REFERENCES users(id)
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
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (patient_id) REFERENCES patients(id),
      FOREIGN KEY (angajat_id) REFERENCES users(id)
    );
  `);

  // Creare user admin implicit dacă nu există
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

  // Salvare stare inițială pe disc
  saveDb();
  console.log('✓ Baza de date inițializată cu succes');
}

module.exports = { getDb, initDatabase };
