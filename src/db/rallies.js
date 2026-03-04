import { getDb } from './database';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export async function getRallies() {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM rallies ORDER BY date DESC, name ASC`);
}

export async function createRally({ name, date, driver }) {
  const db = await getDb();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO rallies (id, name, date, driver) VALUES (?, ?, ?, ?)`,
    [id, name, date, driver ?? null]
  );
  return id;
}

export async function updateRally(id, { name, date, driver }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE rallies SET name = ?, date = ?, driver = ?, updated_at = datetime('now') WHERE id = ?`,
    [name, date, driver ?? null, id]
  );
}

export async function deleteRally(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM rallies WHERE id = ?`, [id]);
}

export async function getStages(rallyId) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM stages WHERE rally_id = ? ORDER BY name ASC`,
    [rallyId]
  );
}

export async function createStage({ rallyId, name }) {
  const db = await getDb();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO stages (id, rally_id, name) VALUES (?, ?, ?)`,
    [id, rallyId, name]
  );
  return id;
}

export async function updateStage(id, { name }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE stages SET name = ?, updated_at = datetime('now') WHERE id = ?`,
    [name, id]
  );
}

export async function deleteStage(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM stages WHERE id = ?`, [id]);
}

export async function getNoteSets(stageId) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM note_sets WHERE stage_id = ? ORDER BY version DESC`,
    [stageId]
  );
}

/**
 * Formats a note_set row for display: "2026-03-01 · 3"
 * (Driver is now on the rally, not the note set.)
 */
export function formatSetLabel(set) {
  const parts = [];
  if (set.recce_date) parts.push(set.recce_date);
  parts.push(String(set.version));
  return parts.join(' · ');
}

export async function createNoteSet({ stageId, recceDate, driver }) {
  const db = await getDb();
  const setId = uuidv4();
  const maxVersion = await db.getFirstAsync(
    `SELECT COALESCE(MAX(version), 0) as v FROM note_sets WHERE stage_id = ?`,
    [stageId]
  );
  const version = (maxVersion?.v ?? 0) + 1;
  await db.runAsync(
    `INSERT INTO note_sets (set_id, stage_id, version, recce_date, driver) VALUES (?, ?, ?, ?, ?)`,
    [setId, stageId, version, recceDate ?? null, driver ?? null]
  );
  return setId;
}

/**
 * Duplicates a stage (and all its note_sets + pace_notes) into the same rally.
 * Returns the new stage id.
 */
export async function duplicateStage(stageId) {
  const db = await getDb();
  const source = await db.getFirstAsync(`SELECT * FROM stages WHERE id = ?`, [stageId]);
  if (!source) throw new Error('Stage not found');

  const newStageId = uuidv4();
  await db.runAsync(
    `INSERT INTO stages (id, rally_id, name) VALUES (?, ?, ?)`,
    [newStageId, source.rally_id, `${source.name} (copy)`]
  );

  const sets = await db.getAllAsync(
    `SELECT * FROM note_sets WHERE stage_id = ? ORDER BY version ASC`, [stageId]
  );
  for (const s of sets) {
    const newSetId = uuidv4();
    await db.runAsync(
      `INSERT INTO note_sets (set_id, stage_id, version, recce_date, is_active, driver)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newSetId, newStageId, s.version, s.recce_date, s.is_active, s.driver]
    );
    const notes = await db.getAllAsync(
      `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`, [s.set_id]
    );
    for (const n of notes) {
      await db.runAsync(
        `INSERT INTO pace_notes
           (set_id, seq, index_odo, index_landmark, index_sequence,
            direction, severity, duration, decorators, joiner, notes, recce_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [newSetId, n.seq, n.index_odo, n.index_landmark, n.index_sequence,
         n.direction, n.severity, n.duration, n.decorators, n.joiner, n.notes, n.recce_at]
      );
    }
  }
  return newStageId;
}

/**
 * Duplicates a rally with all its stages, note_sets, and pace_notes.
 * Returns the new rally id.
 */
export async function duplicateRally(rallyId) {
  const db = await getDb();
  const source = await db.getFirstAsync(`SELECT * FROM rallies WHERE id = ?`, [rallyId]);
  if (!source) throw new Error('Rally not found');

  const newRallyId = uuidv4();
  await db.runAsync(
    `INSERT INTO rallies (id, name, date, driver) VALUES (?, ?, ?, ?)`,
    [newRallyId, `${source.name} (copy)`, source.date, source.driver]
  );

  const stages = await db.getAllAsync(`SELECT * FROM stages WHERE rally_id = ?`, [rallyId]);
  for (const stage of stages) {
    const newStageId = uuidv4();
    await db.runAsync(
      `INSERT INTO stages (id, rally_id, name) VALUES (?, ?, ?)`,
      [newStageId, newRallyId, stage.name]
    );
    const sets = await db.getAllAsync(
      `SELECT * FROM note_sets WHERE stage_id = ? ORDER BY version ASC`, [stage.id]
    );
    for (const s of sets) {
      const newSetId = uuidv4();
      await db.runAsync(
        `INSERT INTO note_sets (set_id, stage_id, version, recce_date, is_active, driver)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newSetId, newStageId, s.version, s.recce_date, s.is_active, s.driver]
      );
      const notes = await db.getAllAsync(
        `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`, [s.set_id]
      );
      for (const n of notes) {
        await db.runAsync(
          `INSERT INTO pace_notes
             (set_id, seq, index_odo, index_landmark, index_sequence,
              direction, severity, duration, decorators, joiner, notes, recce_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [newSetId, n.seq, n.index_odo, n.index_landmark, n.index_sequence,
           n.direction, n.severity, n.duration, n.decorators, n.joiner, n.notes, n.recce_at]
        );
      }
    }
  }
  return newRallyId;
}

/**
 * Creates a new note set by copying all pace_notes from an existing one.
 * Used when entering Recce read mode — preserves the original, edits go to the copy.
 */
export async function copyNoteSet(sourceSetId) {
  const db = await getDb();
  const source = await db.getFirstAsync(
    `SELECT * FROM note_sets WHERE set_id = ?`, [sourceSetId]
  );
  if (!source) throw new Error('Source note set not found');

  const newSetId = await createNoteSet({
    stageId:   source.stage_id,
    recceDate: new Date().toISOString().split('T')[0],
    driver:    source.driver,
  });

  const notes = await db.getAllAsync(
    `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`, [sourceSetId]
  );

  for (const n of notes) {
    await db.runAsync(
      `INSERT INTO pace_notes
         (set_id, seq, index_odo, index_landmark, index_sequence,
          direction, severity, duration, decorators, joiner, notes, recce_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [newSetId, n.seq, n.index_odo, n.index_landmark, n.index_sequence,
       n.direction, n.severity, n.duration, n.decorators, n.joiner, n.notes, n.recce_at]
    );
  }

  return newSetId;
}
