// Mock getDb and uuid
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
    getSetting: jest.fn(async () => null),
    __resetDb: async () => {
      _db = helper.createTestDb();
      await helper.initSchema(_db);
      return _db;
    },
  };
});

let mockUuidCounter = 0;
jest.mock('uuid', () => ({
  v4: () => `test-uuid-${++mockUuidCounter}`,
}));

const { __resetDb } = require('../database');
const {
  getRallies,
  createRally,
  updateRally,
  deleteRally,
  getStages,
  createStage,
  deleteStage,
  getNoteSets,
  createNoteSet,
  duplicateRally,
  copyNoteSet,
  getRallyPrefsForSet,
  getRallyIdForSet,
  getStraightAngle,
  updateStraightAngle,
  formatSetLabel,
} = require('../rallies');

let db;
beforeEach(async () => {
  mockUuidCounter = 0;
  db = await __resetDb();
});

describe('rallies CRUD', () => {
  it('createRally inserts a rally and seeds chips', async () => {
    const id = await createRally({ name: 'Test Rally', date: '2026-03-01' });
    expect(id).toBe('test-uuid-1');

    const rallies = await getRallies();
    expect(rallies).toHaveLength(1);
    expect(rallies[0].name).toBe('Test Rally');
    expect(rallies[0].date).toBe('2026-03-01');

    // Verify chips were seeded
    const chips = await db.getAllAsync(`SELECT COUNT(*) as c FROM rally_chips WHERE rally_id = ?`, [
      id,
    ]);
    expect(chips[0].c).toBeGreaterThan(0);
  });

  it('createRally stores optional fields', async () => {
    await createRally({
      name: 'R2',
      date: '2026-06-15',
      driver: 'Fred',
      displayOrder: 'severity_first',
      odoUnit: 'km',
      straightAngle: 5,
    });
    const rallies = await getRallies();
    expect(rallies[0].driver).toBe('Fred');
    expect(rallies[0].display_order).toBe('severity_first');
    expect(rallies[0].odo_unit).toBe('km');
    expect(rallies[0].straight_angle).toBe(5);
  });

  it('getRallies returns empty array when none exist', async () => {
    const rallies = await getRallies();
    expect(rallies).toEqual([]);
  });

  it('updateRally modifies rally fields', async () => {
    const id = await createRally({ name: 'Original', date: '2026-01-01' });
    await updateRally(id, {
      name: 'Updated',
      date: '2026-02-01',
      driver: 'Claude',
      displayOrder: 'severity_first',
      odoUnit: 'km',
    });
    const rallies = await getRallies();
    expect(rallies[0].name).toBe('Updated');
    expect(rallies[0].driver).toBe('Claude');
  });

  it('deleteRally removes rally and cascades', async () => {
    const rallyId = await createRally({ name: 'ToDelete', date: '2026-01-01' });
    const stageId = await createStage({ rallyId, name: 'SS1' });
    await createNoteSet({ stageId });

    await deleteRally(rallyId);
    expect(await getRallies()).toEqual([]);
    expect(await getStages(rallyId)).toEqual([]);
  });
});

describe('stages CRUD', () => {
  let rallyId;
  beforeEach(async () => {
    rallyId = await createRally({ name: 'R', date: '2026-01-01' });
  });

  it('createStage and getStages', async () => {
    await createStage({ rallyId, name: 'SS1' });
    const stages = await getStages(rallyId);
    expect(stages).toHaveLength(1);
    expect(stages[0].name).toBe('SS1');
  });

  it('stages ordered by name', async () => {
    await createStage({ rallyId, name: 'SS2' });
    await createStage({ rallyId, name: 'SS1' });
    await createStage({ rallyId, name: 'SS3' });
    const stages = await getStages(rallyId);
    expect(stages.map((s) => s.name)).toEqual(['SS1', 'SS2', 'SS3']);
  });

  it('deleteStage cascades to note_sets', async () => {
    const stageId = await createStage({ rallyId, name: 'SS1' });
    await createNoteSet({ stageId });
    await deleteStage(stageId);
    expect(await getNoteSets(stageId)).toEqual([]);
  });
});

describe('note_sets CRUD', () => {
  let rallyId, stageId;
  beforeEach(async () => {
    rallyId = await createRally({ name: 'R', date: '2026-01-01' });
    stageId = await createStage({ rallyId, name: 'SS1' });
  });

  it('createNoteSet auto-increments version', async () => {
    await createNoteSet({ stageId });
    await createNoteSet({ stageId });
    const sets = await getNoteSets(stageId);
    // Ordered by version DESC
    expect(sets[0].version).toBe(2);
    expect(sets[1].version).toBe(1);
  });

  it('formatSetLabel formats correctly', () => {
    expect(formatSetLabel({ recce_date: '2026-03-01', version: 3 })).toBe('2026-03-01 · 3');
    expect(formatSetLabel({ recce_date: null, version: 1 })).toBe('1');
  });
});

describe('hierarchy queries', () => {
  let rallyId, stageId, setId;
  beforeEach(async () => {
    rallyId = await createRally({
      name: 'R',
      date: '2026-01-01',
      displayOrder: 'severity_first',
      odoUnit: 'km',
    });
    stageId = await createStage({ rallyId, name: 'SS1' });
    setId = await createNoteSet({ stageId });
  });

  it('getRallyPrefsForSet walks up hierarchy', async () => {
    const prefs = await getRallyPrefsForSet(setId);
    expect(prefs.displayOrder).toBe('severity_first');
    expect(prefs.odoUnit).toBe('km');
  });

  it('getRallyIdForSet returns the rally id', async () => {
    const id = await getRallyIdForSet(setId);
    expect(id).toBe(rallyId);
  });

  it('getStraightAngle returns default 3', async () => {
    const angle = await getStraightAngle(rallyId);
    expect(angle).toBe(3);
  });

  it('updateStraightAngle modifies the angle', async () => {
    await updateStraightAngle(rallyId, 10);
    const angle = await getStraightAngle(rallyId);
    expect(angle).toBe(10);
  });
});

describe('duplication', () => {
  it('duplicateRally copies everything', async () => {
    const rallyId = await createRally({ name: 'Original', date: '2026-01-01' });
    const stageId = await createStage({ rallyId, name: 'SS1' });
    const setId = await createNoteSet({ stageId });

    // Add a pace note
    await db.runAsync(
      `INSERT INTO pace_notes (set_id, seq, direction, severity) VALUES (?, ?, ?, ?)`,
      [setId, 1, 'L', '3'],
    );

    const newRallyId = await duplicateRally(rallyId);
    const rallies = await getRallies();
    expect(rallies).toHaveLength(2);

    const newRally = rallies.find((r) => r.id === newRallyId);
    expect(newRally.name).toBe('Original (copy)');

    // Verify stages were copied
    const newStages = await getStages(newRallyId);
    expect(newStages).toHaveLength(1);
    expect(newStages[0].name).toBe('SS1');

    // Verify notes were copied
    const newSets = await getNoteSets(newStages[0].id);
    expect(newSets).toHaveLength(1);
    const newNotes = await db.getAllAsync(`SELECT * FROM pace_notes WHERE set_id = ?`, [
      newSets[0].set_id,
    ]);
    expect(newNotes).toHaveLength(1);
    expect(newNotes[0].direction).toBe('L');
    expect(newNotes[0].severity).toBe('3');
  });

  it('copyNoteSet creates a new version with copied notes', async () => {
    const rallyId = await createRally({ name: 'R', date: '2026-01-01' });
    const stageId = await createStage({ rallyId, name: 'SS1' });
    const setId = await createNoteSet({ stageId });

    await db.runAsync(
      `INSERT INTO pace_notes (set_id, seq, direction, severity) VALUES (?, ?, ?, ?)`,
      [setId, 1, 'R', '5'],
    );

    const newSetId = await copyNoteSet(setId);
    expect(newSetId).not.toBe(setId);

    const sets = await getNoteSets(stageId);
    expect(sets).toHaveLength(2);

    const newNotes = await db.getAllAsync(`SELECT * FROM pace_notes WHERE set_id = ?`, [newSetId]);
    expect(newNotes).toHaveLength(1);
    expect(newNotes[0].direction).toBe('R');
  });
});
