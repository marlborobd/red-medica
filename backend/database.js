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
      CREATE TABLE IF NOT EXISTS patients_v2 (
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
      INSERT OR IGNORE INTO patients_v2
        SELECT id, nume, cnp, data_nasterii, varsta, adresa, telefon,
               acord_gdpr, utilizator_creator_id, data_inregistrare
        FROM patients;
      ALTER TABLE patients RENAME TO patients_old_backup;
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

// ===== Migrare: adaugă coloane sold_initial și sold_ramas în patients =====
function migrateSoldInitial() {
  try { sqlJsDb.exec('ALTER TABLE patients ADD COLUMN sold_initial REAL DEFAULT 0'); saveDb(); console.log('✓ Migration: coloana sold_initial adăugată'); } catch (_) {}
  try { sqlJsDb.exec('ALTER TABLE patients ADD COLUMN sold_ramas REAL DEFAULT 0'); saveDb(); console.log('✓ Migration: coloana sold_ramas adăugată'); } catch (_) {}
}

// ===== Migrare: adaugă coloane tip_pacient și CASS în patients =====
function migrateTipPacient() {
  const cols = ['tip_pacient', 'perioada_cass_inceput', 'perioada_cass_sfarsit', 'zile_cass'];
  const defs = [
    "ALTER TABLE patients ADD COLUMN tip_pacient TEXT DEFAULT 'PRIVAT'",
    'ALTER TABLE patients ADD COLUMN perioada_cass_inceput TEXT',
    'ALTER TABLE patients ADD COLUMN perioada_cass_sfarsit TEXT',
    'ALTER TABLE patients ADD COLUMN zile_cass INTEGER'
  ];
  defs.forEach((sql, i) => {
    try { sqlJsDb.exec(sql); saveDb(); console.log(`✓ Migration: coloana ${cols[i]} adăugată`); } catch (_) {}
  });
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

// ===== Migrare: creare tabelă notificari =====
function migrateNotificari() {
  try {
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS notificari (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        titlu TEXT NOT NULL,
        mesaj TEXT NOT NULL,
        citita INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);
    saveDb();
    console.log('✓ Migration: tabela notificari creata');
  } catch (err) {
    console.error('[Migration notificari]', err.message);
  }
}

// ===== Migrare: adaugă viteza_medie_sursa în amb_curse =====
function migrateVitezaMedieSursa() {
  try {
    sqlJsDb.exec("ALTER TABLE amb_curse ADD COLUMN viteza_medie_sursa TEXT NOT NULL DEFAULT 'auto'");
    saveDb();
    console.log('✓ Migration: coloana viteza_medie_sursa adăugată în amb_curse');
  } catch (_) {}
}

// ===== Migrare: creare tabele ambulanță (amb_ambulante, amb_zile, amb_curse) =====
function migrateAmbulante() {
  try {
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS amb_ambulante (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numar_inmatriculare TEXT UNIQUE NOT NULL,
        odometru_curent REAL NOT NULL DEFAULT 0,
        activ INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS amb_zile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ambulanta_id INTEGER NOT NULL REFERENCES amb_ambulante(id),
        data_activitate TEXT NOT NULL,
        locatie_start TEXT NOT NULL,
        locatie_final TEXT,
        odometru_start REAL NOT NULL,
        odometru_final REAL,
        status TEXT NOT NULL DEFAULT 'deschisa',
        creat_de INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE (ambulanta_id, data_activitate)
      )
    `);
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS amb_curse (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zi_id INTEGER NOT NULL REFERENCES amb_zile(id) ON DELETE CASCADE,
        ordine INTEGER NOT NULL,
        data_cursa TEXT NOT NULL,
        ora_plecare TEXT NOT NULL,
        ora_sosire TEXT NOT NULL,
        locatie_plecare TEXT NOT NULL,
        locatie_sosire TEXT NOT NULL,
        distanta_km REAL NOT NULL,
        distanta_sursa TEXT NOT NULL DEFAULT 'auto',
        odometru_start REAL NOT NULL,
        odometru_final REAL NOT NULL,
        durata_condus_sec INTEGER NOT NULL,
        stationare_pornit_sec INTEGER NOT NULL DEFAULT 0,
        stationare_oprit_sec INTEGER,
        viteza_medie INTEGER,
        viteza_maxima INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    sqlJsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_amb_zile ON amb_zile(ambulanta_id, data_activitate);
      CREATE INDEX IF NOT EXISTS idx_amb_curse ON amb_curse(zi_id, ordine);
    `);
    saveDb();
    console.log('✓ Migration: tabele ambulanță create (amb_ambulante, amb_zile, amb_curse)');
  } catch (err) {
    console.error('[Migration ambulante]', err.message);
  }
}

// ===== Migrare: creare tabel amb_adrese_frecvente (autocomplete adrese ambulanță) =====
function migrateAdreseFrecvente() {
  try {
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS amb_adrese_frecvente (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adresa TEXT UNIQUE NOT NULL,
        utilizari INTEGER NOT NULL DEFAULT 1,
        ultima_utilizare TEXT DEFAULT (datetime('now'))
      )
    `);
    sqlJsDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_amb_adrese_utilizari ON amb_adrese_frecvente(utilizari DESC);
    `);
    saveDb();
    console.log('✓ Migration: tabela amb_adrese_frecvente creata');
  } catch (err) {
    console.error('[Migration amb_adrese_frecvente]', err.message);
  }
}

// ===== Migrare: backfill amb_adrese_frecvente din date existente (amb_zile, amb_curse) =====
function migrateAdreseFrecventeBackfill() {
  try {
    const countStmt = sqlJsDb.prepare('SELECT COUNT(*) as n FROM amb_adrese_frecvente');
    countStmt.step();
    const { n } = countStmt.getAsObject();
    countStmt.free();
    if (n > 0) return; // deja populat (backfill anterior sau utilizare curentă)

    const upsert = (adresa) => {
      if (!adresa || typeof adresa !== 'string' || !adresa.trim()) return;
      sqlJsDb.run(`
        INSERT INTO amb_adrese_frecvente (adresa, utilizari, ultima_utilizare)
        VALUES (?, 1, datetime('now'))
        ON CONFLICT(adresa) DO UPDATE SET
          utilizari = utilizari + 1,
          ultima_utilizare = datetime('now')
      `, [adresa.trim()]);
    };

    const zileStmt = sqlJsDb.prepare('SELECT locatie_start, locatie_final FROM amb_zile');
    while (zileStmt.step()) {
      const row = zileStmt.getAsObject();
      upsert(row.locatie_start);
      upsert(row.locatie_final);
    }
    zileStmt.free();

    const curseStmt = sqlJsDb.prepare('SELECT locatie_plecare, locatie_sosire FROM amb_curse');
    while (curseStmt.step()) {
      const row = curseStmt.getAsObject();
      upsert(row.locatie_plecare);
      upsert(row.locatie_sosire);
    }
    curseStmt.free();

    saveDb();
    console.log('✓ Migration: amb_adrese_frecvente populat din date existente (amb_zile, amb_curse)');
  } catch (err) {
    console.error('[Migration amb_adrese_frecvente backfill]', err.message);
  }
}

// ===== Migrare: extinde CHECK role cu 'ambulanta' =====
function migrateUsersRoleConstraint() {
  try {
    const stmt = sqlJsDb.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
    let realSql = null;
    if (stmt.step()) realSql = stmt.getAsObject().sql;
    stmt.free();

    if (!realSql) return;
    if (realSql.includes("'ambulanta'")) return; // deja migrat

    // Construiește users_v2 pornind de la schema reală, înlocuind DOAR textul CHECK-ului
    const v2Sql = realSql
      .replace(
        /CHECK\s*\(\s*role\s+IN\s*\([^)]*\)\s*\)/i,
        "CHECK(role IN ('admin', 'employee', 'ambulanta'))"
      )
      .replace(/\bCREATE TABLE\s+(IF NOT EXISTS\s+)?users\b/i, 'CREATE TABLE users_v2');

    // Citește coloanele reale cu PRAGMA
    const colStmt = sqlJsDb.prepare('PRAGMA table_info(users)');
    const cols = [];
    while (colStmt.step()) cols.push(colStmt.getAsObject().name);
    colStmt.free();
    if (cols.length === 0) return;

    const colList = cols.join(', ');

    // Numărul de rânduri înainte
    const countStmt = sqlJsDb.prepare('SELECT COUNT(*) as n FROM users');
    countStmt.step();
    const countBefore = countStmt.getAsObject().n;
    countStmt.free();

    sqlJsDb.run('PRAGMA foreign_keys=OFF');
    sqlJsDb.exec(v2Sql);
    sqlJsDb.exec(`INSERT INTO users_v2 (${colList}) SELECT ${colList} FROM users`);
    sqlJsDb.exec('DROP TABLE users');
    sqlJsDb.exec('ALTER TABLE users_v2 RENAME TO users');
    sqlJsDb.run('PRAGMA foreign_keys=ON');

    // Verificare integritate
    const countStmt2 = sqlJsDb.prepare('SELECT COUNT(*) as n FROM users');
    countStmt2.step();
    const countAfter = countStmt2.getAsObject().n;
    countStmt2.free();

    if (countAfter !== countBefore) {
      throw new Error(
        `[Migration users role] INTEGRITATE COMPROMISĂ: ${countBefore} useri înainte, ${countAfter} după. DB NU a fost salvat.`
      );
    }

    saveDb();
    console.log(`✓ Migration: role constraint actualizat (+ ambulanta), ${countAfter} useri verificați`);
  } catch (err) {
    console.error('[Migration users role]', err.message);
    throw err;
  }
}

// ===== Migrare: creare tabele foi_parcurs și setari_angajat =====
function migrateFoiParcurs() {
  try {
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS foi_parcurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        angajat_email TEXT NOT NULL,
        numar_inmatriculare TEXT,
        data TEXT,
        ora_inceput TEXT,
        ora_final TEXT,
        km_inceput INTEGER,
        km_final INTEGER,
        km_total INTEGER,
        observatii TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);
    sqlJsDb.exec(`
      CREATE TABLE IF NOT EXISTS setari_angajat (
        angajat_email TEXT PRIMARY KEY,
        numar_inmatriculare TEXT
      )
    `);
    saveDb();
    console.log('✓ Migration: tabele foi_parcurs și setari_angajat create');
  } catch (err) {
    console.error('[Migration foi_parcurs]', err.message);
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
      role TEXT DEFAULT 'employee' CHECK(role IN ('admin', 'employee', 'ambulanta')),
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
      tip_pacient TEXT DEFAULT 'PRIVAT',
      perioada_cass_inceput TEXT,
      perioada_cass_sfarsit TEXT,
      zile_cass INTEGER,
      sold_initial REAL DEFAULT 0,
      sold_ramas REAL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS notificari (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      titlu TEXT NOT NULL,
      mesaj TEXT NOT NULL,
      citita INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
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

    CREATE TABLE IF NOT EXISTS foi_parcurs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      angajat_email TEXT NOT NULL,
      numar_inmatriculare TEXT,
      data TEXT,
      ora_inceput TEXT,
      ora_final TEXT,
      km_inceput INTEGER,
      km_final INTEGER,
      km_total INTEGER,
      observatii TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS setari_angajat (
      angajat_email TEXT PRIMARY KEY,
      numar_inmatriculare TEXT
    );

    CREATE TABLE IF NOT EXISTS amb_ambulante (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numar_inmatriculare TEXT UNIQUE NOT NULL,
      odometru_curent REAL NOT NULL DEFAULT 0,
      activ INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS amb_zile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ambulanta_id INTEGER NOT NULL REFERENCES amb_ambulante(id),
      data_activitate TEXT NOT NULL,
      locatie_start TEXT NOT NULL,
      locatie_final TEXT,
      odometru_start REAL NOT NULL,
      odometru_final REAL,
      status TEXT NOT NULL DEFAULT 'deschisa',
      creat_de INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE (ambulanta_id, data_activitate)
    );

    CREATE TABLE IF NOT EXISTS amb_curse (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      zi_id INTEGER NOT NULL REFERENCES amb_zile(id) ON DELETE CASCADE,
      ordine INTEGER NOT NULL,
      data_cursa TEXT NOT NULL,
      ora_plecare TEXT NOT NULL,
      ora_sosire TEXT NOT NULL,
      locatie_plecare TEXT NOT NULL,
      locatie_sosire TEXT NOT NULL,
      distanta_km REAL NOT NULL,
      distanta_sursa TEXT NOT NULL DEFAULT 'auto',
      odometru_start REAL NOT NULL,
      odometru_final REAL NOT NULL,
      durata_condus_sec INTEGER NOT NULL,
      stationare_pornit_sec INTEGER NOT NULL DEFAULT 0,
      stationare_oprit_sec INTEGER,
      viteza_medie INTEGER,
      viteza_medie_sursa TEXT NOT NULL DEFAULT 'auto',
      viteza_maxima INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_amb_zile ON amb_zile(ambulanta_id, data_activitate);
    CREATE INDEX IF NOT EXISTS idx_amb_curse ON amb_curse(zi_id, ordine);

    CREATE TABLE IF NOT EXISTS amb_adrese_frecvente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adresa TEXT UNIQUE NOT NULL,
      utilizari INTEGER NOT NULL DEFAULT 1,
      ultima_utilizare TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_amb_adrese_utilizari ON amb_adrese_frecvente(utilizari DESC);
  `);

  // Migrări pentru baze de date existente
  migrateCnpColumn();
  migrateAddPozeColumn();
  migrateStatusPreluare();
  migrateRedirectionatCatreId();
  migrateTipPacient();
  migrateSoldInitial();
  migrateViziteProgramate();
  migratePushSubscriptions();
  migrateNotificari();
  migrateFoiParcurs();
  migrateAmbulante();
  migrateVitezaMedieSursa();
  migrateAdreseFrecvente();
  migrateAdreseFrecventeBackfill();
  migrateUsersRoleConstraint();

  // Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@asistenta.ro';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Administrator';
  if (!adminPassword) {
    console.warn('[WARN] ADMIN_PASSWORD nu este setat. Contul admin nu va fi creat/actualizat.');
    saveDb();
    console.log('✓ Baza de date inițializată cu succes');
    return;
  }

  const hashedPassword = bcrypt.hashSync(adminPassword, 10);
  db.prepare('INSERT OR IGNORE INTO users (email, password, name, role) VALUES (?, ?, ?, ?)')
    .run(adminEmail, hashedPassword, adminName, 'admin');

  saveDb();
  console.log('✓ Baza de date inițializată cu succes');
}

module.exports = { getDb, initDatabase };
