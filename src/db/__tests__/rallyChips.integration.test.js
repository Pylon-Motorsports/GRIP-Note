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
    __resetDb: async () => {
      _db = helper.createTestDb();
      await helper.initSchema(_db);
      return _db;
    },
  };
});

const { __resetDb } = require('../database');
const {
  seedDefaultChips,
  getChips,
  getAllChips,
  getAudibleMap,
  addChip,
  deleteChip,
  moveChip,
  updateChipAngle,
  updateChipAudible,
  updateChip,
  copyChips,
  isChipUsed,
} = require('../rallyChips');

let db;
const RALLY_ID = 'rally-1';

beforeEach(async () => {
  db = await __resetDb();
  await db.runAsync(`INSERT INTO rallies (id, name, date) VALUES (?, ?, ?)`, [
    RALLY_ID,
    'Test',
    '2026-01-01',
  ]);
});

describe('seedDefaultChips', () => {
  it('seeds all default chip categories', async () => {
    await seedDefaultChips(RALLY_ID);
    const all = await getAllChips(RALLY_ID);
    expect(Object.keys(all)).toContain('direction');
    expect(Object.keys(all)).toContain('severity');
    expect(Object.keys(all)).toContain('duration');
    expect(Object.keys(all)).toContain('decorator');
    expect(Object.keys(all)).toContain('joiner');
    expect(Object.keys(all)).toContain('joiner_decorator');
    expect(Object.keys(all)).toContain('caution_decorator');
  });

  it('is idempotent (INSERT OR IGNORE)', async () => {
    await seedDefaultChips(RALLY_ID);
    const count1 = await db.getFirstAsync(
      `SELECT COUNT(*) as c FROM rally_chips WHERE rally_id = ?`,
      [RALLY_ID],
    );
    await seedDefaultChips(RALLY_ID);
    const count2 = await db.getFirstAsync(
      `SELECT COUNT(*) as c FROM rally_chips WHERE rally_id = ?`,
      [RALLY_ID],
    );
    expect(count1.c).toBe(count2.c);
  });

  it('seeds severity chips with angles', async () => {
    await seedDefaultChips(RALLY_ID);
    const severity = await getChips(RALLY_ID, 'severity');
    const sev3 = severity.find((c) => c.value === '3');
    expect(sev3.angle).toBe(63);
    const sev6 = severity.find((c) => c.value === '6');
    expect(sev6.angle).toBe(8);
    // Hairpin has no angle
    const hairpin = severity.find((c) => c.value === 'Hairpin');
    expect(hairpin.angle).toBeNull();
  });
});

describe('getChips', () => {
  it('lazy-seeds when rally has no chips', async () => {
    // Don't call seedDefaultChips — getChips should do it automatically
    const direction = await getChips(RALLY_ID, 'direction');
    expect(direction.length).toBeGreaterThan(0);
    expect(direction.find((c) => c.value === 'L')).toBeTruthy();
  });

  it('returns chips ordered by sort_order', async () => {
    await seedDefaultChips(RALLY_ID);
    const direction = await getChips(RALLY_ID, 'direction');
    for (let i = 1; i < direction.length; i++) {
      expect(direction[i].sort_order).toBeGreaterThanOrEqual(direction[i - 1].sort_order);
    }
  });
});

describe('getAudibleMap', () => {
  it('returns value→audible mapping', async () => {
    await seedDefaultChips(RALLY_ID);
    const map = await getAudibleMap(RALLY_ID);
    expect(map['L']).toBe('Left');
    expect(map['R']).toBe('Right');
    expect(map['→']).toBe('Into');
  });

  it('does not include chips with null audible', async () => {
    await seedDefaultChips(RALLY_ID);
    const map = await getAudibleMap(RALLY_ID);
    // Severity '3' has audible: null in seeds
    expect(map).not.toHaveProperty('3');
  });
});

describe('addChip', () => {
  it('adds a chip at the end of sort order', async () => {
    await seedDefaultChips(RALLY_ID);
    await addChip(RALLY_ID, 'direction', 'Straight', 'Go Straight');
    const chips = await getChips(RALLY_ID, 'direction');
    const last = chips[chips.length - 1];
    expect(last.value).toBe('Straight');
    expect(last.audible).toBe('Go Straight');
  });

  it('auto-sorts numerical joiner chips by numeric value', async () => {
    await seedDefaultChips(RALLY_ID);
    await addChip(RALLY_ID, 'joiner', '200');
    await addChip(RALLY_ID, 'joiner', '50');
    await addChip(RALLY_ID, 'joiner', '10');
    const chips = await getChips(RALLY_ID, 'joiner');
    const numChips = chips.filter((c) => /^\d+$/.test(c.value));
    const numValues = numChips.map((c) => parseInt(c.value, 10));
    // Numerical joiners should be in ascending order
    for (let i = 1; i < numValues.length; i++) {
      expect(numValues[i]).toBeGreaterThanOrEqual(numValues[i - 1]);
    }
  });

  it('does not duplicate (INSERT OR IGNORE)', async () => {
    await seedDefaultChips(RALLY_ID);
    const before = (await getChips(RALLY_ID, 'direction')).length;
    await addChip(RALLY_ID, 'direction', 'L', 'Left');
    const after = (await getChips(RALLY_ID, 'direction')).length;
    expect(after).toBe(before); // No duplicate
  });
});

describe('updateChipAngle', () => {
  it('updates severity chip angle', async () => {
    await seedDefaultChips(RALLY_ID);
    const chips = await getChips(RALLY_ID, 'severity');
    const sev5 = chips.find((c) => c.value === '5');
    await updateChipAngle(sev5.id, 45);
    const updated = await getChips(RALLY_ID, 'severity');
    expect(updated.find((c) => c.value === '5').angle).toBe(45);
  });
});

describe('moveChip', () => {
  it('swaps sort_order with neighbour on move down', async () => {
    await seedDefaultChips(RALLY_ID);
    const before = await getChips(RALLY_ID, 'direction');
    const first = before[0];
    const second = before[1];

    await moveChip(first.id, 'down');

    const after = await getChips(RALLY_ID, 'direction');
    const movedFirst = after.find((c) => c.id === first.id);
    const movedSecond = after.find((c) => c.id === second.id);
    expect(movedFirst.sort_order).toBe(second.sort_order);
    expect(movedSecond.sort_order).toBe(first.sort_order);
  });

  it('swaps sort_order with neighbour on move up', async () => {
    await seedDefaultChips(RALLY_ID);
    const before = await getChips(RALLY_ID, 'direction');
    const second = before[1];
    const first = before[0];

    await moveChip(second.id, 'up');

    const after = await getChips(RALLY_ID, 'direction');
    const movedSecond = after.find((c) => c.id === second.id);
    const movedFirst = after.find((c) => c.id === first.id);
    expect(movedSecond.sort_order).toBe(first.sort_order);
    expect(movedFirst.sort_order).toBe(second.sort_order);
  });

  it('does nothing when moving first chip up', async () => {
    await seedDefaultChips(RALLY_ID);
    const before = await getChips(RALLY_ID, 'direction');
    const first = before[0];

    await moveChip(first.id, 'up');

    const after = await getChips(RALLY_ID, 'direction');
    expect(after.find((c) => c.id === first.id).sort_order).toBe(first.sort_order);
  });

  it('does nothing when moving last chip down', async () => {
    await seedDefaultChips(RALLY_ID);
    const before = await getChips(RALLY_ID, 'direction');
    const last = before[before.length - 1];

    await moveChip(last.id, 'down');

    const after = await getChips(RALLY_ID, 'direction');
    expect(after.find((c) => c.id === last.id).sort_order).toBe(last.sort_order);
  });
});

describe('deleteChip', () => {
  it('removes a chip by id', async () => {
    await seedDefaultChips(RALLY_ID);
    const chips = await getChips(RALLY_ID, 'direction');
    const toDelete = chips.find((c) => c.value === 'Keep Mid');
    await deleteChip(toDelete.id);
    const after = await getChips(RALLY_ID, 'direction');
    expect(after.find((c) => c.value === 'Keep Mid')).toBeUndefined();
  });
});

describe('copyChips', () => {
  it('copies all chips to a new rally', async () => {
    await seedDefaultChips(RALLY_ID);
    const destId = 'rally-2';
    await db.runAsync(`INSERT INTO rallies (id, name, date) VALUES (?, ?, ?)`, [
      destId,
      'Copy',
      '2026-02-01',
    ]);
    await copyChips(RALLY_ID, destId);

    const sourceCount = await db.getFirstAsync(
      `SELECT COUNT(*) as c FROM rally_chips WHERE rally_id = ?`,
      [RALLY_ID],
    );
    const destCount = await db.getFirstAsync(
      `SELECT COUNT(*) as c FROM rally_chips WHERE rally_id = ?`,
      [destId],
    );
    expect(destCount.c).toBe(sourceCount.c);
  });
});

describe('updateChipAudible', () => {
  it('updates audible text for a chip', async () => {
    await seedDefaultChips(RALLY_ID);
    const chips = await getChips(RALLY_ID, 'direction');
    const left = chips.find((c) => c.value === 'L');
    await updateChipAudible(left.id, 'Turn Left');
    const updated = await getChips(RALLY_ID, 'direction');
    expect(updated.find((c) => c.value === 'L').audible).toBe('Turn Left');
  });

  it('sets audible to null when empty string passed', async () => {
    await seedDefaultChips(RALLY_ID);
    const chips = await getChips(RALLY_ID, 'direction');
    const left = chips.find((c) => c.value === 'L');
    await updateChipAudible(left.id, '');
    const updated = await getChips(RALLY_ID, 'direction');
    expect(updated.find((c) => c.value === 'L').audible).toBeNull();
  });
});

describe('updateChip', () => {
  it('updates both value and audible', async () => {
    await seedDefaultChips(RALLY_ID);
    const chips = await getChips(RALLY_ID, 'decorator');
    const first = chips[0];
    await updateChip(first.id, 'NewVal', 'New Audible');
    const updated = await getChips(RALLY_ID, 'decorator');
    const changed = updated.find((c) => c.id === first.id);
    expect(changed.value).toBe('NewVal');
    expect(changed.audible).toBe('New Audible');
  });

  it('does nothing when value is empty', async () => {
    await seedDefaultChips(RALLY_ID);
    const chips = await getChips(RALLY_ID, 'decorator');
    const first = chips[0];
    const originalValue = first.value;
    await updateChip(first.id, '', 'Something');
    const updated = await getChips(RALLY_ID, 'decorator');
    expect(updated.find((c) => c.id === first.id).value).toBe(originalValue);
  });

  it('sets audible to null when empty string passed', async () => {
    await seedDefaultChips(RALLY_ID);
    const chips = await getChips(RALLY_ID, 'decorator');
    const first = chips[0];
    await updateChip(first.id, 'Val', '');
    const updated = await getChips(RALLY_ID, 'decorator');
    expect(updated.find((c) => c.id === first.id).audible).toBeNull();
  });
});

describe('isChipUsed', () => {
  let stageId, setId;

  beforeEach(async () => {
    await seedDefaultChips(RALLY_ID);
    stageId = 'stage-1';
    setId = 'set-1';
    await db.runAsync(`INSERT INTO stages (id, rally_id, name) VALUES (?, ?, ?)`, [
      stageId,
      RALLY_ID,
      'SS1',
    ]);
    await db.runAsync(`INSERT INTO note_sets (set_id, stage_id, version) VALUES (?, ?, ?)`, [
      setId,
      stageId,
      1,
    ]);
  });

  it('returns false when chip value is not used in any note', async () => {
    const used = await isChipUsed(RALLY_ID, 'direction', 'L');
    expect(used).toBe(false);
  });

  it('returns true when direction chip is used', async () => {
    await db.runAsync(`INSERT INTO pace_notes (set_id, seq, direction) VALUES (?, ?, ?)`, [
      setId,
      1,
      'L',
    ]);
    const used = await isChipUsed(RALLY_ID, 'direction', 'L');
    expect(used).toBe(true);
  });

  it('returns true when severity chip is used', async () => {
    await db.runAsync(`INSERT INTO pace_notes (set_id, seq, severity) VALUES (?, ?, ?)`, [
      setId,
      1,
      '3',
    ]);
    const used = await isChipUsed(RALLY_ID, 'severity', '3');
    expect(used).toBe(true);
  });

  it('returns true when joiner chip is used', async () => {
    await db.runAsync(`INSERT INTO pace_notes (set_id, seq, joiner) VALUES (?, ?, ?)`, [
      setId,
      1,
      '→',
    ]);
    const used = await isChipUsed(RALLY_ID, 'joiner', '→');
    expect(used).toBe(true);
  });

  it('returns true when decorator is used in JSON array', async () => {
    await db.runAsync(`INSERT INTO pace_notes (set_id, seq, decorators) VALUES (?, ?, ?)`, [
      setId,
      1,
      JSON.stringify(['!', 'Brow']),
    ]);
    const used = await isChipUsed(RALLY_ID, 'decorator', '!');
    expect(used).toBe(true);
  });

  it('returns false for decorator not in JSON array', async () => {
    await db.runAsync(`INSERT INTO pace_notes (set_id, seq, decorators) VALUES (?, ?, ?)`, [
      setId,
      1,
      JSON.stringify(['Brow']),
    ]);
    const used = await isChipUsed(RALLY_ID, 'decorator', '!');
    expect(used).toBe(false);
  });

  it('returns true when joiner_decorator is used in JSON array', async () => {
    await db.runAsync(`INSERT INTO pace_notes (set_id, seq, joiner_decorators) VALUES (?, ?, ?)`, [
      setId,
      1,
      JSON.stringify(['Opens']),
    ]);
    const used = await isChipUsed(RALLY_ID, 'joiner_decorator', 'Opens');
    expect(used).toBe(true);
  });

  it('returns false for unknown category', async () => {
    const used = await isChipUsed(RALLY_ID, 'unknown_category', 'X');
    expect(used).toBe(false);
  });
});
