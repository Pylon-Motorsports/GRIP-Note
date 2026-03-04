import { getDb } from './database';

export async function getPaceNotes(setId) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`,
    [setId]
  );
}

export async function upsertPaceNote(note) {
  const db = await getDb();
  const {
    set_id, seq,
    index_odo, index_landmark, index_sequence,
    direction, severity, duration,
    decorators, joiner, notes, recce_at,
  } = note;

  await db.runAsync(
    `INSERT INTO pace_notes
       (set_id, seq, index_odo, index_landmark, index_sequence,
        direction, severity, duration, decorators, joiner, notes, recce_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(set_id, seq) DO UPDATE SET
       index_odo = excluded.index_odo,
       index_landmark = excluded.index_landmark,
       index_sequence = excluded.index_sequence,
       direction = excluded.direction,
       severity = excluded.severity,
       duration = excluded.duration,
       decorators = excluded.decorators,
       joiner = excluded.joiner,
       notes = excluded.notes,
       recce_at = excluded.recce_at,
       updated_at = datetime('now')`,
    [
      set_id, seq,
      index_odo ?? null,
      index_landmark ?? null,
      index_sequence ?? null,
      direction ?? null,
      severity ?? null,
      duration ?? null,
      decorators ? JSON.stringify(decorators) : null,
      joiner ?? null,
      notes ?? null,
      recce_at ?? null,
    ]
  );
}

export async function deletePaceNote(setId, seq) {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM pace_notes WHERE set_id = ? AND seq = ?`,
    [setId, seq]
  );
}

export async function getNextSeq(setId) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM pace_notes WHERE set_id = ?`,
    [setId]
  );
  return row?.next_seq ?? 1;
}

// Parse decorators JSON field back to array
export function parseNote(row) {
  return {
    ...row,
    decorators: row.decorators ? JSON.parse(row.decorators) : [],
  };
}
