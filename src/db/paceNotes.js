/**
 * @module paceNotes
 * CRUD operations for pace_notes within a note set.
 * Notes are keyed by (set_id, seq) and store semantic fields directly.
 */
import { getDb } from './database';

/**
 * Returns all pace notes for a note set, ordered by sequence.
 * Decorators are returned as raw JSON strings — use {@link parseNote} to get arrays.
 * @param {string} setId
 * @returns {Promise<import('../types').PaceNote[]>}
 */
export async function getPaceNotes(setId) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`, [setId]);
}

/**
 * Inserts or updates a pace note (INSERT ... ON CONFLICT DO UPDATE).
 * Array fields (decorators, joiner_decorators) are JSON-stringified before storage.
 * @param {import('../types').PaceNote} note
 */
export async function upsertPaceNote(note) {
  const db = await getDb();
  const {
    set_id,
    seq,
    index_odo,
    index_landmark,
    index_sequence,
    direction,
    severity,
    duration,
    decorators,
    joiner,
    joiner_decorators,
    notes,
    joiner_notes,
    recce_at,
  } = note;

  await db.runAsync(
    `INSERT INTO pace_notes
       (set_id, seq, index_odo, index_landmark, index_sequence,
        direction, severity, duration, decorators, joiner, joiner_decorators, notes, joiner_notes, recce_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(set_id, seq) DO UPDATE SET
       index_odo = excluded.index_odo,
       index_landmark = excluded.index_landmark,
       index_sequence = excluded.index_sequence,
       direction = excluded.direction,
       severity = excluded.severity,
       duration = excluded.duration,
       decorators = excluded.decorators,
       joiner = excluded.joiner,
       joiner_decorators = excluded.joiner_decorators,
       notes = excluded.notes,
       joiner_notes = excluded.joiner_notes,
       recce_at = excluded.recce_at,
       updated_at = datetime('now')`,
    [
      set_id,
      seq,
      index_odo ?? null,
      index_landmark ?? null,
      index_sequence ?? null,
      direction ?? null,
      severity ?? null,
      duration ?? null,
      decorators ? JSON.stringify(decorators) : null,
      joiner ?? null,
      joiner_decorators ? JSON.stringify(joiner_decorators) : null,
      notes ?? null,
      joiner_notes ?? null,
      recce_at ?? null,
    ],
  );
}

/**
 * Shifts all notes with seq >= fromSeq up by 1 to make room for an insert.
 * Processes in descending order to avoid PK conflicts during the shift.
 */
export async function shiftSeqsUp(setId, fromSeq) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT seq FROM pace_notes WHERE set_id = ? AND seq >= ? ORDER BY seq DESC`,
    [setId, fromSeq],
  );
  for (const row of rows) {
    await db.runAsync(`UPDATE pace_notes SET seq = ? WHERE set_id = ? AND seq = ?`, [
      row.seq + 1,
      setId,
      row.seq,
    ]);
  }
}

/**
 * Deletes a single pace note by set_id and sequence number.
 * @param {string} setId
 * @param {number} seq
 */
export async function deletePaceNote(setId, seq) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM pace_notes WHERE set_id = ? AND seq = ?`, [setId, seq]);
}

/**
 * Returns the next available sequence number for a note set (MAX(seq) + 1).
 * @param {string} setId
 * @returns {Promise<number>}
 */
export async function getNextSeq(setId) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM pace_notes WHERE set_id = ?`,
    [setId],
  );
  return row?.next_seq ?? 1;
}

/**
 * Parses a raw DB row, converting decorators and joiner_decorators from JSON strings to arrays.
 * @param {import('../types').PaceNote} row — raw DB row with JSON string fields
 * @returns {import('../types').PaceNote} — row with decorators/joiner_decorators as arrays
 */
export function parseNote(row) {
  return {
    ...row,
    decorators: row.decorators ? JSON.parse(row.decorators) : [],
    joiner_decorators: row.joiner_decorators ? JSON.parse(row.joiner_decorators) : [],
  };
}
