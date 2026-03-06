/**
 * @module database
 * SQLite singleton, schema initialisation, migrations, and app_settings CRUD.
 * All tables are created on first open; migrations run safely on every startup.
 */
import * as SQLite from 'expo-sqlite';

let _db = null;

/**
 * Returns the shared SQLite database handle, creating and initialising it on first call.
 * @returns {Promise<import('expo-sqlite').SQLiteDatabase>}
 */
export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('grip.db');
  await initialise(_db);
  return _db;
}

/**
 * Creates all tables (IF NOT EXISTS) and runs idempotent migrations.
 * ALTER TABLE calls are wrapped in .catch(() => {}) so they no-op on repeat runs.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 */
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

    CREATE TABLE IF NOT EXISTS rally_chips (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      rally_id    TEXT NOT NULL REFERENCES rallies(id) ON DELETE CASCADE,
      category    TEXT NOT NULL,
      value       TEXT NOT NULL,
      audible     TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      UNIQUE(rally_id, category, value)
    );
  `);

  // Migrations — safe to run on every startup (ALTER TABLE ignores existing columns)
  await db.execAsync(`ALTER TABLE note_sets ADD COLUMN driver TEXT`).catch(() => {});
  await db.execAsync(`ALTER TABLE rallies ADD COLUMN driver TEXT`).catch(() => {});
  await db
    .execAsync(`ALTER TABLE rallies ADD COLUMN display_order TEXT DEFAULT 'direction_first'`)
    .catch(() => {});
  await db
    .execAsync(`ALTER TABLE rallies ADD COLUMN odo_unit TEXT DEFAULT 'metres'`)
    .catch(() => {});
  await db
    .execAsync(
      `ALTER TABLE rallies ADD COLUMN pre_note_decs TEXT DEFAULT '["!","!!","!!!","Care"]'`,
    )
    .catch(() => {});
  await db.execAsync(`ALTER TABLE pace_notes ADD COLUMN joiner_decorators TEXT`).catch(() => {});
  await db.execAsync(`ALTER TABLE pace_notes ADD COLUMN joiner_notes TEXT`).catch(() => {});
  await db.execAsync(`ALTER TABLE rally_chips ADD COLUMN angle INTEGER`).catch(() => {});
  await db
    .execAsync(`ALTER TABLE rallies ADD COLUMN straight_angle INTEGER DEFAULT 3`)
    .catch(() => {});
  // Backfill default angles for existing severity chips that have no angle yet
  await db
    .execAsync(
      `
    UPDATE rally_chips SET angle = CASE value
      WHEN '1' THEN 80  WHEN '2' THEN 70  WHEN '3' THEN 60
      WHEN '4' THEN 50  WHEN '5' THEN 40  WHEN '6' THEN 30
      WHEN '7' THEN 20  WHEN '8' THEN 10  WHEN '9' THEN 5
      ELSE NULL END
    WHERE category = 'severity' AND angle IS NULL
  `,
    )
    .catch(() => {});
  // Migrate caution chips (!, !!, !!!, Care) from decorator → caution_decorator category
  await db
    .execAsync(
      `UPDATE rally_chips SET category = 'caution_decorator'
     WHERE category = 'decorator' AND value IN ('!', '!!', '!!!', 'Care')`,
    )
    .catch(() => {});

  // Seed default settings (no-op if already present)
  await db.runAsync(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, [
    'display_order',
    'direction_first',
  ]);
  await db.runAsync(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, [
    'odo_unit',
    'metres',
  ]);
  await db.runAsync(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, [
    'active_rally_id',
    null,
  ]);
  await db.runAsync(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`, [
    'pre_note_decs',
    '["!","!!","!!!","Care"]',
  ]);
}

/**
 * Reads a value from the app_settings table.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getSetting(key) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT value FROM app_settings WHERE key = ?`, [key]);
  return row?.value ?? null;
}

/**
 * Writes a value to the app_settings table (insert or replace).
 * @param {string} key
 * @param {string|null} value
 */
export async function setSetting(key, value) {
  const db = await getDb();
  await db.runAsync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`, [key, value]);
}
