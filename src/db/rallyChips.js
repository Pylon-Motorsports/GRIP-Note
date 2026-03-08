/**
 * @module rallyChips
 * CRUD for per-rally chip configuration (rally_chips table).
 * Chips are tappable selection elements used in Writing/Reading/Drive UIs.
 */
import { getDb } from './database';
import { DEFAULT_CHIP_SEEDS } from '../constants/chips';

/**
 * Seeds all default chips for a rally.
 * Safe to call multiple times — INSERT OR IGNORE prevents duplicates.
 */
export async function seedDefaultChips(rallyId) {
  const db = await getDb();
  for (const [category, chips] of Object.entries(DEFAULT_CHIP_SEEDS)) {
    for (let i = 0; i < chips.length; i++) {
      const [value, audible, angle] = chips[i];
      await db.runAsync(
        `INSERT OR IGNORE INTO rally_chips (rally_id, category, value, audible, sort_order, angle)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [rallyId, category, value, audible ?? null, i, angle ?? null],
      );
    }
  }
}

/**
 * Returns chips for a rally + category, ordered by sort_order.
 * Auto-seeds defaults if this rally has no chips at all (migration for old rallies).
 */
export async function getChips(rallyId, category) {
  const db = await getDb();

  // Lazy seed for rallies created before chip support was added
  const anyChips = await db.getFirstAsync(
    `SELECT COUNT(*) as c FROM rally_chips WHERE rally_id = ?`,
    [rallyId],
  );
  if ((anyChips?.c ?? 0) === 0) {
    await seedDefaultChips(rallyId);
  }

  return db.getAllAsync(
    `SELECT * FROM rally_chips WHERE rally_id = ? AND category = ? ORDER BY sort_order ASC, id ASC`,
    [rallyId, category],
  );
}

/**
 * Returns all chips for a rally grouped by category.
 * Auto-seeds defaults if needed.
 */
export async function getAllChips(rallyId) {
  const db = await getDb();

  const anyChips = await db.getFirstAsync(
    `SELECT COUNT(*) as c FROM rally_chips WHERE rally_id = ?`,
    [rallyId],
  );
  if ((anyChips?.c ?? 0) === 0) {
    await seedDefaultChips(rallyId);
  }

  const rows = await db.getAllAsync(
    `SELECT * FROM rally_chips WHERE rally_id = ? ORDER BY category, sort_order ASC, id ASC`,
    [rallyId],
  );

  const result = {};
  for (const row of rows) {
    if (!result[row.category]) result[row.category] = [];
    result[row.category].push(row);
  }
  return result;
}

/**
 * Builds an audible map { value → audible } for TTS.
 * Only includes entries where audible differs from value.
 */
export async function getAudibleMap(rallyId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT value, audible FROM rally_chips WHERE rally_id = ? AND audible IS NOT NULL`,
    [rallyId],
  );
  const map = {};
  for (const row of rows) {
    map[row.value] = row.audible;
  }
  return map;
}

/**
 * Adds a new chip at the end of its category's sort order.
 * Numerical joiner chips are auto-sorted by numeric value after insertion.
 * @param {string} rallyId
 * @param {import('../types').ChipCategory} category
 * @param {string} value
 * @param {string|null} [audible=null] — TTS override
 * @param {number|null} [angle=null] — severity tilt angle (degrees)
 */
export async function addChip(rallyId, category, value, audible = null, angle = null) {
  const db = await getDb();
  const last = await db.getFirstAsync(
    `SELECT MAX(sort_order) as max_order FROM rally_chips WHERE rally_id = ? AND category = ?`,
    [rallyId, category],
  );
  const sortOrder = (last?.max_order ?? -1) + 1;
  await db.runAsync(
    `INSERT OR IGNORE INTO rally_chips (rally_id, category, value, audible, sort_order, angle)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rallyId, category, value, audible || null, sortOrder, angle],
  );
  // Auto-sort numerical chips in joiner category by numeric value
  if (category === 'joiner' && /^\d+$/.test(value.trim())) {
    await sortNumericalJoiners(db, rallyId);
  }
}

/**
 * Re-sorts numerical joiner chips (e.g. '10', '50', '200') by ascending numeric value
 * while preserving non-numerical chips in their original positions.
 * @param {import('expo-sqlite').SQLiteDatabase} db
 * @param {string} rallyId
 */
async function sortNumericalJoiners(db, rallyId) {
  const chips = await db.getAllAsync(
    `SELECT * FROM rally_chips WHERE rally_id = ? AND category = 'joiner' ORDER BY sort_order ASC, id ASC`,
    [rallyId],
  );
  const numChips = chips.filter((c) => /^\d+$/.test(c.value));
  numChips.sort((a, b) => parseInt(a.value, 10) - parseInt(b.value, 10));
  // Collect sort_order slots used by numerical chips, reassign in sorted order
  const slots = chips
    .filter((c) => /^\d+$/.test(c.value))
    .map((c) => c.sort_order)
    .sort((a, b) => a - b);
  for (let i = 0; i < numChips.length; i++) {
    await db.runAsync(`UPDATE rally_chips SET sort_order = ? WHERE id = ?`, [
      slots[i],
      numChips[i].id,
    ]);
  }
}

/**
 * Updates the tilt angle for a severity chip (Drive mode compass dial position).
 * @param {number} id — chip row id
 * @param {number|null} angle — degrees, or null to hide from dial
 */
export async function updateChipAngle(id, angle) {
  const db = await getDb();
  await db.runAsync(`UPDATE rally_chips SET angle = ? WHERE id = ?`, [
    angle != null ? parseInt(angle, 10) : null,
    id,
  ]);
}

/**
 * Updates the TTS audible text for a chip.
 * @param {number} id — chip row id
 * @param {string|null} audible — spoken text, or null to use chip value as-is
 */
export async function updateChipAudible(id, audible) {
  const db = await getDb();
  await db.runAsync(`UPDATE rally_chips SET audible = ? WHERE id = ?`, [audible || null, id]);
}

/**
 * Updates both value and audible for a chip, cascading the rename to all
 * pace_notes in the same rally so existing notes reflect the new label.
 */
export async function updateChip(id, value, audible) {
  const db = await getDb();
  if (!value) return;

  // Look up old value, category, and rally_id before updating
  const chip = await db.getFirstAsync(
    `SELECT value, category, rally_id FROM rally_chips WHERE id = ?`,
    [id],
  );
  if (!chip) return;

  await db.runAsync(`UPDATE rally_chips SET value = ?, audible = ? WHERE id = ?`, [
    value,
    audible || null,
    id,
  ]);

  // Cascade rename to pace_notes if the value actually changed
  if (chip.value !== value) {
    await cascadeChipRename(db, chip.rally_id, chip.category, chip.value, value);
  }
}

/** Renames a chip value across all pace_notes belonging to the same rally. */
async function cascadeChipRename(db, rallyId, category, oldVal, newVal) {
  // Find all set_ids belonging to this rally
  const setRows = await db.getAllAsync(
    `SELECT ns.set_id FROM note_sets ns
     JOIN stages s ON ns.stage_id = s.id
     WHERE s.rally_id = ?`,
    [rallyId],
  );
  if (setRows.length === 0) return;
  const setIds = setRows.map((r) => r.set_id);
  const placeholders = setIds.map(() => '?').join(',');

  // Single-select columns: direct string match
  const SINGLE_MAP = {
    direction: 'direction',
    severity: 'severity',
    duration: 'duration',
    joiner: 'joiner',
  };

  // JSON array columns: decorator categories
  const JSON_MAP = {
    decorator: 'decorators',
    caution_decorator: 'decorators',
    joiner_decorator: 'joiner_decorators',
  };

  const singleCol = SINGLE_MAP[category];
  if (singleCol) {
    await db.runAsync(
      `UPDATE pace_notes SET ${singleCol} = ? WHERE set_id IN (${placeholders}) AND ${singleCol} = ?`,
      [newVal, ...setIds, oldVal],
    );
    return;
  }

  const jsonCol = JSON_MAP[category];
  if (jsonCol) {
    // Fetch notes that contain the old value in the JSON array
    const notes = await db.getAllAsync(
      `SELECT set_id, seq, ${jsonCol} FROM pace_notes
       WHERE set_id IN (${placeholders}) AND ${jsonCol} LIKE ?`,
      [...setIds, `%${oldVal.replace(/[%_]/g, '\\$&')}%`],
    );
    for (const note of notes) {
      const arr = note[jsonCol] ? JSON.parse(note[jsonCol]) : [];
      const updated = arr.map((v) => (v === oldVal ? newVal : v));
      if (JSON.stringify(arr) !== JSON.stringify(updated)) {
        await db.runAsync(
          `UPDATE pace_notes SET ${jsonCol} = ? WHERE set_id = ? AND seq = ?`,
          [JSON.stringify(updated), note.set_id, note.seq],
        );
      }
    }
  }
}

/**
 * Deletes a chip by row id.
 * @param {number} id
 */
export async function deleteChip(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM rally_chips WHERE id = ?`, [id]);
}

/**
 * Moves a chip up or down in sort_order by swapping with its neighbour.
 */
export async function moveChip(id, direction) {
  const db = await getDb();
  const chip = await db.getFirstAsync(`SELECT * FROM rally_chips WHERE id = ?`, [id]);
  if (!chip) return;

  const sibling = await db.getFirstAsync(
    direction === 'up'
      ? `SELECT * FROM rally_chips WHERE rally_id = ? AND category = ? AND sort_order < ?
         ORDER BY sort_order DESC LIMIT 1`
      : `SELECT * FROM rally_chips WHERE rally_id = ? AND category = ? AND sort_order > ?
         ORDER BY sort_order ASC LIMIT 1`,
    [chip.rally_id, chip.category, chip.sort_order],
  );
  if (!sibling) return;

  await db.runAsync(`UPDATE rally_chips SET sort_order = ? WHERE id = ?`, [
    sibling.sort_order,
    chip.id,
  ]);
  await db.runAsync(`UPDATE rally_chips SET sort_order = ? WHERE id = ?`, [
    chip.sort_order,
    sibling.id,
  ]);
}

/**
 * Checks whether a chip value is currently used in any pace_notes for this rally.
 * Returns true if used (cannot safely delete).
 */
export async function isChipUsed(rallyId, category, value) {
  const db = await getDb();

  if (category === 'decorator') {
    const row = await db.getFirstAsync(
      `SELECT COUNT(*) as c FROM pace_notes pn
       JOIN note_sets ns ON ns.set_id = pn.set_id
       JOIN stages s ON s.id = ns.stage_id
       WHERE s.rally_id = ? AND pn.decorators IS NOT NULL
         AND EXISTS (SELECT 1 FROM json_each(pn.decorators) WHERE value = ?)`,
      [rallyId, value],
    );
    return (row?.c ?? 0) > 0;
  }

  if (category === 'joiner_decorator') {
    const row = await db.getFirstAsync(
      `SELECT COUNT(*) as c FROM pace_notes pn
       JOIN note_sets ns ON ns.set_id = pn.set_id
       JOIN stages s ON s.id = ns.stage_id
       WHERE s.rally_id = ? AND pn.joiner_decorators IS NOT NULL
         AND EXISTS (SELECT 1 FROM json_each(pn.joiner_decorators) WHERE value = ?)`,
      [rallyId, value],
    );
    return (row?.c ?? 0) > 0;
  }

  const colMap = {
    direction: 'direction',
    severity: 'severity',
    duration: 'duration',
    joiner: 'joiner',
  };
  const col = colMap[category];
  if (!col) return false;

  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as c FROM pace_notes pn
     JOIN note_sets ns ON ns.set_id = pn.set_id
     JOIN stages s ON s.id = ns.stage_id
     WHERE s.rally_id = ? AND pn.${col} = ?`,
    [rallyId, value],
  );
  return (row?.c ?? 0) > 0;
}

/**
 * Copies all chips from one rally to another.
 * Used when duplicating a rally.
 */
export async function copyChips(sourceRallyId, destRallyId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT category, value, audible, sort_order, angle FROM rally_chips WHERE rally_id = ?`,
    [sourceRallyId],
  );
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR IGNORE INTO rally_chips (rally_id, category, value, audible, sort_order, angle)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [destRallyId, row.category, row.value, row.audible, row.sort_order, row.angle ?? null],
    );
  }
}
