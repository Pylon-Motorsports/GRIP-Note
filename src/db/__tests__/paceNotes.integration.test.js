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
  getPaceNotes,
  upsertPaceNote,
  deletePaceNote,
  getNextSeq,
  shiftSeqsUp,
} = require('../paceNotes');

let db;
const RALLY_ID = 'rally-1';
const STAGE_ID = 'stage-1';
const SET_ID = 'set-1';

beforeEach(async () => {
  db = await __resetDb();
  // Insert parent records so FK constraints are satisfied
  await db.runAsync(`INSERT INTO rallies (id, name, date) VALUES (?, ?, ?)`, [
    RALLY_ID,
    'Test',
    '2026-01-01',
  ]);
  await db.runAsync(`INSERT INTO stages (id, rally_id, name) VALUES (?, ?, ?)`, [
    STAGE_ID,
    RALLY_ID,
    'SS1',
  ]);
  await db.runAsync(`INSERT INTO note_sets (set_id, stage_id, version) VALUES (?, ?, ?)`, [
    SET_ID,
    STAGE_ID,
    1,
  ]);
});

describe('upsertPaceNote', () => {
  it('inserts a new note', async () => {
    await upsertPaceNote({
      set_id: SET_ID,
      seq: 1,
      direction: 'L',
      severity: '3',
      duration: 'Short',
      decorators: ['!', 'Brow'],
      joiner: '→',
      joiner_decorators: ['Opens'],
    });

    const notes = await getPaceNotes(SET_ID);
    expect(notes).toHaveLength(1);
    expect(notes[0].direction).toBe('L');
    expect(notes[0].severity).toBe('3');
    // Decorators stored as JSON string
    expect(JSON.parse(notes[0].decorators)).toEqual(['!', 'Brow']);
    expect(JSON.parse(notes[0].joiner_decorators)).toEqual(['Opens']);
  });

  it('updates existing note on conflict', async () => {
    await upsertPaceNote({ set_id: SET_ID, seq: 1, direction: 'L', severity: '3' });
    await upsertPaceNote({ set_id: SET_ID, seq: 1, direction: 'R', severity: '5' });

    const notes = await getPaceNotes(SET_ID);
    expect(notes).toHaveLength(1);
    expect(notes[0].direction).toBe('R');
    expect(notes[0].severity).toBe('5');
  });

  it('handles null optional fields', async () => {
    await upsertPaceNote({ set_id: SET_ID, seq: 1 });
    const notes = await getPaceNotes(SET_ID);
    expect(notes[0].direction).toBeNull();
    expect(notes[0].severity).toBeNull();
    expect(notes[0].decorators).toBeNull();
  });
});

describe('getPaceNotes', () => {
  it('returns notes ordered by seq', async () => {
    await upsertPaceNote({ set_id: SET_ID, seq: 3, direction: 'L' });
    await upsertPaceNote({ set_id: SET_ID, seq: 1, direction: 'R' });
    await upsertPaceNote({ set_id: SET_ID, seq: 2, severity: '5' });

    const notes = await getPaceNotes(SET_ID);
    expect(notes.map((n) => n.seq)).toEqual([1, 2, 3]);
  });

  it('returns empty array for empty set', async () => {
    const notes = await getPaceNotes(SET_ID);
    expect(notes).toEqual([]);
  });
});

describe('getNextSeq', () => {
  it('returns 1 for empty set', async () => {
    const seq = await getNextSeq(SET_ID);
    expect(seq).toBe(1);
  });

  it('returns max + 1', async () => {
    await upsertPaceNote({ set_id: SET_ID, seq: 1 });
    await upsertPaceNote({ set_id: SET_ID, seq: 2 });
    const seq = await getNextSeq(SET_ID);
    expect(seq).toBe(3);
  });
});

describe('deletePaceNote', () => {
  it('deletes a specific note by set_id and seq', async () => {
    await upsertPaceNote({ set_id: SET_ID, seq: 1, direction: 'L' });
    await upsertPaceNote({ set_id: SET_ID, seq: 2, direction: 'R' });
    await deletePaceNote(SET_ID, 1);

    const notes = await getPaceNotes(SET_ID);
    expect(notes).toHaveLength(1);
    expect(notes[0].seq).toBe(2);
  });
});

describe('shiftSeqsUp', () => {
  it('shifts seqs >= fromSeq up by 1', async () => {
    await upsertPaceNote({ set_id: SET_ID, seq: 1, direction: 'L' });
    await upsertPaceNote({ set_id: SET_ID, seq: 2, direction: 'R' });
    await upsertPaceNote({ set_id: SET_ID, seq: 3, severity: '5' });

    await shiftSeqsUp(SET_ID, 2);

    const notes = await getPaceNotes(SET_ID);
    expect(notes.map((n) => n.seq)).toEqual([1, 3, 4]);
    expect(notes[0].direction).toBe('L'); // seq 1 unchanged
    expect(notes[1].direction).toBe('R'); // was seq 2, now seq 3
    expect(notes[2].severity).toBe('5'); // was seq 3, now seq 4
  });
});
