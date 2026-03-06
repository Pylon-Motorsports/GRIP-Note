/**
 * @module importExport
 * Rally export (.grip.json v4) and import with full chip + note preservation.
 * Supports current multi-stage format and legacy v1 single-note-set format.
 */
import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDb } from '../db/database';
import { getRallies, getStages, createRally, createStage, createNoteSet } from '../db/rallies';
import { upsertPaceNote } from '../db/paceNotes';

const GRIP_EXPORT_VERSION = 4;

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * Exports an entire rally (all stages + all note sets) as a .grip.json file.
 * @param {string} rallyId
 * @returns {string} filename
 */
export async function exportRally(rallyId) {
  const db = await getDb();

  const rally = await db.getFirstAsync(`SELECT * FROM rallies WHERE id = ?`, [rallyId]);
  if (!rally) throw new Error('Rally not found');

  const stages = await db.getAllAsync(`SELECT * FROM stages WHERE rally_id = ? ORDER BY name ASC`, [
    rallyId,
  ]);

  const stageData = await Promise.all(
    stages.map(async (stage) => {
      const noteSets = await db.getAllAsync(
        `SELECT * FROM note_sets WHERE stage_id = ? ORDER BY version ASC`,
        [stage.id],
      );
      const noteSetData = await Promise.all(
        noteSets.map(async (ns) => {
          const rows = await db.getAllAsync(
            `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`,
            [ns.set_id],
          );
          return {
            version: ns.version,
            driver: ns.driver ?? null,
            recce_date: ns.recce_date ?? null,
            pace_notes: rows.map((n) => ({
              seq: n.seq,
              index_odo: n.index_odo,
              index_landmark: n.index_landmark,
              index_sequence: n.index_sequence,
              direction: n.direction,
              severity: n.severity,
              duration: n.duration,
              decorators: n.decorators ? JSON.parse(n.decorators) : [],
              joiner: n.joiner,
              joiner_decorators: n.joiner_decorators ? JSON.parse(n.joiner_decorators) : [],
              notes: n.notes,
              joiner_notes: n.joiner_notes ?? '',
            })),
          };
        }),
      );
      return { name: stage.name, note_sets: noteSetData };
    }),
  );

  const chipRows = await db.getAllAsync(
    `SELECT category, value, audible, sort_order, angle FROM rally_chips WHERE rally_id = ? ORDER BY category, sort_order ASC, id ASC`,
    [rallyId],
  );

  const data = {
    grip_export_version: GRIP_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    rally: {
      name: rally.name,
      date: rally.date,
      driver: rally.driver ?? null,
      display_order: rally.display_order ?? 'direction_first',
      odo_unit: rally.odo_unit ?? 'metres',
      straight_angle: rally.straight_angle ?? 3,
    },
    chips: chipRows,
    stages: stageData,
  };

  const safeName = rally.name.replace(/[^a-z0-9-]/gi, '_');
  const filename = `${safeName}.grip.json`;
  const file = new File(Paths.cache, filename);
  file.write(JSON.stringify(data, null, 2));

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export GRIP Rally',
    UTI: 'public.json',
  });

  return filename;
}

// ── Import ──────────────────────────────────────────────────────────────────

/**
 * Prompts the user to pick a .grip.json file, then imports the rally into the DB.
 * Always creates a fresh note set for each set imported (never overwrites).
 * @returns {{ rallyName, stageCount, noteCount } | null}
 */
export async function importRally() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  const f = new File(asset.uri);
  const content = f.text();
  const data = JSON.parse(content);

  if (!data.grip_export_version || !Array.isArray(data.stages)) {
    // Try to handle v1 format (single note-set export)
    if (data.grip_export_version === 1 && Array.isArray(data.pace_notes)) {
      return importLegacyNoteSet(data);
    }
    throw new Error('This does not appear to be a valid GRIP export file.');
  }

  // Find or create rally (match on name + date)
  const rallies = await getRallies();
  let rally = rallies.find((r) => r.name === data.rally.name && r.date === data.rally.date);
  const isNewRally = !rally;
  const rallyId = rally
    ? rally.id
    : await createRally({
        name: data.rally.name,
        date: data.rally.date,
        driver: data.rally.driver,
        displayOrder: data.rally.display_order,
        odoUnit: data.rally.odo_unit,
        straightAngle: data.rally.straight_angle,
      });

  // If new rally and file has chips, replace seeded defaults with exported chips
  if (isNewRally && Array.isArray(data.chips) && data.chips.length > 0) {
    const db = await getDb();
    await db.runAsync(`DELETE FROM rally_chips WHERE rally_id = ?`, [rallyId]);
    for (const chip of data.chips) {
      await db.runAsync(
        `INSERT OR IGNORE INTO rally_chips (rally_id, category, value, audible, sort_order, angle) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          rallyId,
          chip.category,
          chip.value,
          chip.audible ?? null,
          chip.sort_order,
          chip.angle ?? null,
        ],
      );
    }
  }

  let totalNotes = 0;

  for (const stage of data.stages) {
    // Find or create stage
    const stages = await getStages(rallyId);
    let existingStage = stages.find((s) => s.name === stage.name);
    const stageId = existingStage
      ? existingStage.id
      : await createStage({ rallyId, name: stage.name });

    for (const ns of stage.note_sets) {
      const setId = await createNoteSet({
        stageId,
        recceDate: ns.recce_date,
        driver: ns.driver,
      });
      for (const note of ns.pace_notes) {
        await upsertPaceNote({ set_id: setId, ...note });
      }
      totalNotes += ns.pace_notes.length;
    }
  }

  return {
    rallyName: data.rally.name,
    stageCount: data.stages.length,
    noteCount: totalNotes,
  };
}

// ── Legacy v1 import (single note-set) ─────────────────────────────────────

/**
 * Imports a v1-format export file containing a single note set.
 * Creates rally/stage if they don't already exist (matched by name + date).
 * @param {Object} data — parsed JSON from v1 export file
 * @returns {Promise<{rallyName: string, stageCount: number, noteCount: number}>}
 */
async function importLegacyNoteSet(data) {
  const rallies = await getRallies();
  let rally = rallies.find((r) => r.name === data.rally.name && r.date === data.rally.date);
  const rallyId = rally
    ? rally.id
    : await createRally({ name: data.rally.name, date: data.rally.date });

  const stages = await getStages(rallyId);
  let stage = stages.find((s) => s.name === data.stage.name);
  const stageId = stage ? stage.id : await createStage({ rallyId, name: data.stage.name });

  const setId = await createNoteSet({
    stageId,
    recceDate: data.note_set.recce_date,
    driver: data.note_set.driver,
  });

  for (const note of data.pace_notes) {
    await upsertPaceNote({ set_id: setId, ...note });
  }

  return {
    rallyName: data.rally.name,
    stageCount: 1,
    noteCount: data.pace_notes.length,
  };
}
