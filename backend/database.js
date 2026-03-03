const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Calea DB: configurabilă prin env var (Railway Volume) sau local
const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, 'asistenta.db');

let db;

function getDb() {
  if (!db) {
    // Asigură că directorul există (important pentru Railway volumes)
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`✓ Director creat: ${dbDir}`);
    }

    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA synchronous = NORMAL');
    console.log(`✓ Baza de date: ${DB_PATH}`);
  }
  return db;
}

function initDatabase() {
  const database = getDb();

  database.exec(`
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

  const adminExists = database
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(adminEmail);

  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    database
      .prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)')
      .run(adminEmail, hashedPassword, adminName, 'admin');
    console.log(`✓ Admin creat: ${adminEmail}`);
  }

  console.log('✓ Baza de date inițializată cu succes');
}

module.exports = { getDb, initDatabase };
