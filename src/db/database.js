import * as SQLite from 'expo-sqlite';

let _db = null;

export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('grip.db');
  await initialise(_db);
  return _db;
}

async function initialise(db) {
  await db.execAsync(`PRAGMA journal_mode = WAL;`);
  await db.execAsync(`PRAGMA foreign_keys = ON;`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS rallies (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      date        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stages (
      id          TEXT PRIMARY KEY,
      rally_id    TEXT NOT NULL REFERENCES rallies(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS note_sets (
      set_id      TEXT PRIMARY KEY,
      stage_id    TEXT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
      version     INTEGER NOT NULL DEFAULT 1,
      recce_date  TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pace_notes (
      set_id          TEXT NOT NULL REFERENCES note_sets(set_id) ON DELETE CASCADE,
      seq             INTEGER NOT NULL,
      index_odo       INTEGER,
      index_landmark  TEXT,
      index_sequence  INTEGER,
      direction       TEXT,
      severity        TEXT,
      duration        TEXT,
      decorators      TEXT,
      joiner          TEXT,
      notes           TEXT,
      recce_at        TEXT,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (set_id, seq)
    );

    CREATE TABLE IF NOT EXISTS stage_geometry (
      set_id        TEXT NOT NULL REFERENCES note_sets(set_id) ON DELETE CASCADE,
      seq           INTEGER NOT NULL,
      length_m      INTEGER,
      h_angle       REAL,
      left_surfaces TEXT,
      right_surfaces TEXT,
      roadside_left  TEXT,
      roadside_right TEXT,
      PRIMARY KEY (set_id, seq)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migrations — safe to run on every startup (ALTER TABLE ignores existing columns)
  await db.execAsync(`ALTER TABLE note_sets ADD COLUMN driver TEXT`).catch(() => {});
  await db.execAsync(`ALTER TABLE rallies ADD COLUMN driver TEXT`).catch(() => {});

  // Seed default settings (no-op if already present)
  await db.runAsync(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`,
    ['display_order', 'direction_first']
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`,
    ['odo_unit', 'metres']
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`,
    ['active_rally_id', null]
  );
}

export async function getSetting(key) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT value FROM app_settings WHERE key = ?`, [key]
  );
  return row?.value ?? null;
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`,
    [key, value]
  );
}
