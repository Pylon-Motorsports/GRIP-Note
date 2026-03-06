let db;

// Mock getDb to return our test database
jest.mock('../database', () => {
  const helper = require('./testDbHelper');
  let _db;
  return {
    getDb: jest.fn(async () => {
      if (!_db) {
        _db = helper.createTestDb();
        await helper.initSchema(_db);
      }
      return _db;
    }),
    // Expose reset for beforeEach
    __resetDb: async () => {
      _db = helper.createTestDb();
      await helper.initSchema(_db);
      return _db;
    },
  };
});

const { __resetDb } = require('../database');

beforeEach(async () => {
  db = await __resetDb();
});

describe('database schema initialisation', () => {
  it('creates all expected tables', async () => {
    const tables = await db.getAllAsync(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    );
    const names = tables.map((t) => t.name);
    expect(names).toContain('rallies');
    expect(names).toContain('stages');
    expect(names).toContain('note_sets');
    expect(names).toContain('pace_notes');
    expect(names).toContain('rally_chips');
    expect(names).toContain('app_settings');
    expect(names).toContain('stage_geometry');
  });

  it('rallies table has migration columns', async () => {
    const cols = await db.getAllAsync(`PRAGMA table_info(rallies)`);
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain('driver');
    expect(colNames).toContain('display_order');
    expect(colNames).toContain('odo_unit');
    expect(colNames).toContain('straight_angle');
    expect(colNames).toContain('pre_note_decs');
  });

  it('pace_notes table has migration columns', async () => {
    const cols = await db.getAllAsync(`PRAGMA table_info(pace_notes)`);
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain('joiner_decorators');
    expect(colNames).toContain('joiner_notes');
  });

  it('rally_chips table has angle column', async () => {
    const cols = await db.getAllAsync(`PRAGMA table_info(rally_chips)`);
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain('angle');
  });
});

describe('app_settings', () => {
  it('seeds default settings on init', async () => {
    const displayOrder = await db.getFirstAsync(`SELECT value FROM app_settings WHERE key = ?`, [
      'display_order',
    ]);
    expect(displayOrder.value).toBe('direction_first');

    const odoUnit = await db.getFirstAsync(`SELECT value FROM app_settings WHERE key = ?`, [
      'odo_unit',
    ]);
    expect(odoUnit.value).toBe('metres');
  });

  it('getSetting reads values', async () => {
    // Directly query since getSetting uses getDb
    const row = await db.getFirstAsync(`SELECT value FROM app_settings WHERE key = ?`, [
      'display_order',
    ]);
    expect(row?.value).toBe('direction_first');
  });

  it('setSetting writes and overwrites values', async () => {
    await db.runAsync(`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`, [
      'display_order',
      'severity_first',
    ]);
    const row = await db.getFirstAsync(`SELECT value FROM app_settings WHERE key = ?`, [
      'display_order',
    ]);
    expect(row.value).toBe('severity_first');
  });
});
