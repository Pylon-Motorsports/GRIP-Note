/**
 * @module rallies
 * CRUD for rallies, stages, and note_sets.
 * Hierarchy: rallies → stages → note_sets → pace_notes.
 */
import { getDb } from './database';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { seedDefaultChips, copyChips } from './rallyChips';

/**
 * Returns all rallies ordered by date descending, then name ascending.
 * @returns {Promise<import('../types').Rally[]>}
 */
export async function getRallies() {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM rallies ORDER BY date DESC, name ASC`);
}

/**
 * Creates a new rally and seeds it with default chips.
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.date — ISO date string
 * @param {string} [params.driver]
 * @param {import('../types').DisplayOrder} [params.displayOrder='direction_first']
 * @param {import('../types').OdoUnit} [params.odoUnit='metres']
 * @param {number} [params.straightAngle=3] — dead-zone angle in degrees
 * @returns {Promise<string>} new rally UUID
 */
export async function createRally({ name, date, driver, displayOrder, odoUnit, straightAngle }) {
  const db = await getDb();
  const id = uuidv4();
  await db.runAsync(
    `INSERT INTO rallies (id, name, date, driver, display_order, odo_unit, straight_angle)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      date,
      driver ?? null,
      displayOrder ?? 'direction_first',
      odoUnit ?? 'metres',
      straightAngle ?? 3,
    ],
  );
  await seedDefaultChips(id);
  return id;
}

/**
 * Updates a rally's metadata.
 * @param {string} id
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.date
 * @param {string} [params.driver]
 * @param {import('../types').DisplayOrder} [params.displayOrder]
 * @param {import('../types').OdoUnit} [params.odoUnit]
 */
export async function updateRally(id, { name, date, driver, displayOrder, odoUnit }) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE rallies
     SET name = ?, date = ?, driver = ?,
         display_order = ?, odo_unit = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [name, date, driver ?? null, displayOrder ?? 'direction_first', odoUnit ?? 'metres', id],
  );
}

/**
 * Resolves display preferences for a given set_id by walking up to its rally.
 * Falls back to safe defaults if the rally has no preferences stored yet.
 */
export async function getRallyPrefsForSet(setId) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `
    SELECT r.display_order, r.odo_unit
    FROM note_sets ns
    JOIN stages s ON s.id = ns.stage_id
    JOIN rallies r ON r.id = s.rally_id
    WHERE ns.set_id = ?
  `,
    [setId],
  );
  return {
    displayOrder: row?.display_order ?? 'direction_first',
    odoUnit: row?.odo_unit ?? 'metres',
  };
}

/**
 * Returns the rally_id for a given set_id by walking up the hierarchy.
 */
export async function getRallyIdForSet(setId) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT s.rally_id FROM note_sets ns
     JOIN stages s ON s.id = ns.stage_id
     WHERE ns.set_id = ?`,
    [setId],
  );
  return row?.rally_id ?? null;
}

/**
 * Returns the dead-zone angle (degrees) for a rally's tilt detection.
 * @param {string} rallyId
 * @returns {Promise<number>} defaults to 3 if not set
 */
export async function getStraightAngle(rallyId) {
  const db = await getDb();
  const row = await db.getFirstAsync(`SELECT straight_angle FROM rallies WHERE id = ?`, [rallyId]);
  return row?.straight_angle ?? 3;
}

/**
 * Updates the dead-zone angle for a rally's tilt detection.
 * @param {string} rallyId
 * @param {number} angle — degrees
 */
export async function updateStraightAngle(rallyId, angle) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE rallies SET straight_angle = ?, updated_at = datetime('now') WHERE id = ?`,
    [angle, rallyId],
  );
}

/**
 * Deletes a rally and all cascaded children (stages, note_sets, pace_notes, chips).
 * @param {string} id
 */
export async function deleteRally(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM rallies WHERE id = ?`, [id]);
}

/**
 * Returns all stages for a rally, ordered by name ascending.
 * @param {string} rallyId
 * @returns {Promise<import('../types').Stage[]>}
 */
export async function getStages(rallyId) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM stages WHERE rally_id = ? ORDER BY name ASC`, [rallyId]);
}

/**
 * Creates a new stage within a rally.
 * @param {Object} params
 * @param {string} params.rallyId
 * @param {string} params.name
 * @returns {Promise<string>} new stage UUID
 */
export async function createStage({ rallyId, name }) {
  const db = await getDb();
  const id = uuidv4();
  await db.runAsync(`INSERT INTO stages (id, rally_id, name) VALUES (?, ?, ?)`, [
    id,
    rallyId,
    name,
  ]);
  return id;
}

/**
 * Renames a stage.
 * @param {string} id
 * @param {Object} params
 * @param {string} params.name
 */
export async function updateStage(id, { name }) {
  const db = await getDb();
  await db.runAsync(`UPDATE stages SET name = ?, updated_at = datetime('now') WHERE id = ?`, [
    name,
    id,
  ]);
}

/**
 * Deletes a stage and all cascaded children (note_sets, pace_notes).
 * @param {string} id
 */
export async function deleteStage(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM stages WHERE id = ?`, [id]);
}

/**
 * Returns all note sets for a stage, ordered by version descending (newest first).
 * @param {string} stageId
 * @returns {Promise<import('../types').NoteSet[]>}
 */
export async function getNoteSets(stageId) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM note_sets WHERE stage_id = ? ORDER BY version DESC`, [
    stageId,
  ]);
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

/**
 * Creates a new note set with an auto-incremented version number.
 * @param {Object} params
 * @param {string} params.stageId
 * @param {string} [params.recceDate] — ISO date string
 * @param {string} [params.driver]
 * @returns {Promise<string>} new set UUID
 */
export async function createNoteSet({ stageId, recceDate, driver }) {
  const db = await getDb();
  const setId = uuidv4();
  const maxVersion = await db.getFirstAsync(
    `SELECT COALESCE(MAX(version), 0) as v FROM note_sets WHERE stage_id = ?`,
    [stageId],
  );
  const version = (maxVersion?.v ?? 0) + 1;
  await db.runAsync(
    `INSERT INTO note_sets (set_id, stage_id, version, recce_date, driver) VALUES (?, ?, ?, ?, ?)`,
    [setId, stageId, version, recceDate ?? null, driver ?? null],
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
  await db.runAsync(`INSERT INTO stages (id, rally_id, name) VALUES (?, ?, ?)`, [
    newStageId,
    source.rally_id,
    `${source.name} (copy)`,
  ]);

  const sets = await db.getAllAsync(
    `SELECT * FROM note_sets WHERE stage_id = ? ORDER BY version ASC`,
    [stageId],
  );
  for (const s of sets) {
    const newSetId = uuidv4();
    await db.runAsync(
      `INSERT INTO note_sets (set_id, stage_id, version, recce_date, is_active, driver)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newSetId, newStageId, s.version, s.recce_date, s.is_active, s.driver],
    );
    const notes = await db.getAllAsync(
      `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`,
      [s.set_id],
    );
    for (const n of notes) {
      await db.runAsync(
        `INSERT INTO pace_notes
           (set_id, seq, index_odo, index_landmark, index_sequence,
            direction, severity, duration, decorators, joiner, joiner_decorators,
            notes, joiner_notes, recce_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          newSetId,
          n.seq,
          n.index_odo,
          n.index_landmark,
          n.index_sequence,
          n.direction,
          n.severity,
          n.duration,
          n.decorators,
          n.joiner,
          n.joiner_decorators,
          n.notes,
          n.joiner_notes,
          n.recce_at,
        ],
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
    `INSERT INTO rallies (id, name, date, driver, display_order, odo_unit, straight_angle)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newRallyId,
      `${source.name} (copy)`,
      source.date,
      source.driver,
      source.display_order,
      source.odo_unit,
      source.straight_angle,
    ],
  );
  await copyChips(rallyId, newRallyId);

  const stages = await db.getAllAsync(`SELECT * FROM stages WHERE rally_id = ?`, [rallyId]);
  for (const stage of stages) {
    const newStageId = uuidv4();
    await db.runAsync(`INSERT INTO stages (id, rally_id, name) VALUES (?, ?, ?)`, [
      newStageId,
      newRallyId,
      stage.name,
    ]);
    const sets = await db.getAllAsync(
      `SELECT * FROM note_sets WHERE stage_id = ? ORDER BY version ASC`,
      [stage.id],
    );
    for (const s of sets) {
      const newSetId = uuidv4();
      await db.runAsync(
        `INSERT INTO note_sets (set_id, stage_id, version, recce_date, is_active, driver)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newSetId, newStageId, s.version, s.recce_date, s.is_active, s.driver],
      );
      const notes = await db.getAllAsync(
        `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`,
        [s.set_id],
      );
      for (const n of notes) {
        await db.runAsync(
          `INSERT INTO pace_notes
             (set_id, seq, index_odo, index_landmark, index_sequence,
              direction, severity, duration, decorators, joiner, joiner_decorators,
              notes, joiner_notes, recce_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            newSetId,
            n.seq,
            n.index_odo,
            n.index_landmark,
            n.index_sequence,
            n.direction,
            n.severity,
            n.duration,
            n.decorators,
            n.joiner,
            n.joiner_decorators,
            n.notes,
            n.joiner_notes,
            n.recce_at,
          ],
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
  const source = await db.getFirstAsync(`SELECT * FROM note_sets WHERE set_id = ?`, [sourceSetId]);
  if (!source) throw new Error('Source note set not found');

  const newSetId = await createNoteSet({
    stageId: source.stage_id,
    recceDate: new Date().toISOString().split('T')[0],
    driver: source.driver,
  });

  const notes = await db.getAllAsync(`SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`, [
    sourceSetId,
  ]);

  for (const n of notes) {
    await db.runAsync(
      `INSERT INTO pace_notes
         (set_id, seq, index_odo, index_landmark, index_sequence,
          direction, severity, duration, decorators, joiner, joiner_decorators,
          notes, joiner_notes, recce_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        newSetId,
        n.seq,
        n.index_odo,
        n.index_landmark,
        n.index_sequence,
        n.direction,
        n.severity,
        n.duration,
        n.decorators,
        n.joiner,
        n.joiner_decorators,
        n.notes,
        n.joiner_notes,
        n.recce_at,
      ],
    );
  }

  return newSetId;
}
