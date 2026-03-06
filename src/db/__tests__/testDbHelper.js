/**
 * Test helper: creates an in-memory SQLite database using better-sqlite3,
 * wrapped to match the expo-sqlite async API surface.
 *
 * Usage in tests:
 *   const { createTestDb, resetDb } = require('./testDbHelper');
 *   let db;
 *   beforeEach(() => { db = createTestDb(); resetDb(); });
 */
const Database = require('better-sqlite3');

let _testDb = null;

/**
 * Creates a fresh in-memory SQLite database wrapped with the expo-sqlite async API.
 * Resets the singleton used by getDb() mock.
 */
function createTestDb() {
  if (_testDb) _testDb.close();
  const raw = new Database(':memory:');
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  // Wrap synchronous better-sqlite3 API to match expo-sqlite async API
  const wrapped = {
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    runAsync: async (sql, params = []) => {
      return raw.prepare(sql).run(...params);
    },
    getAllAsync: async (sql, params = []) => {
      return raw.prepare(sql).all(...params);
    },
    getFirstAsync: async (sql, params = []) => {
      return raw.prepare(sql).get(...params) ?? null;
    },
    close: () => raw.close(),
  };

  _testDb = raw;
  return wrapped;
}

/**
 * Runs the same schema creation + migrations as database.js initialise().
 * This ensures tests use the exact same schema as the real app.
 */
async function initSchema(db) {
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

  // Run the same migrations as database.js
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

  // Seed default settings
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

module.exports = { createTestDb, initSchema };
