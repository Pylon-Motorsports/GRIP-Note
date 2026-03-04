import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDb } from '../db/database';
import { getRallies, getStages, createRally, createStage, createNoteSet } from '../db/rallies';
import { upsertPaceNote } from '../db/paceNotes';

const GRIP_EXPORT_VERSION = 1;

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * Exports a single note set as a .grip.json file and shares it.
 * @param {string} setId
 * @returns {string} filename
 */
export async function exportNoteSet(setId) {
  const db = await getDb();

  const noteSet = await db.getFirstAsync(`
    SELECT ns.*, s.name AS stage_name, r.name AS rally_name, r.date AS rally_date
    FROM note_sets ns
    JOIN stages s ON ns.stage_id = s.id
    JOIN rallies r ON s.rally_id = r.id
    WHERE ns.set_id = ?
  `, [setId]);

  if (!noteSet) throw new Error('Note set not found');

  const rows = await db.getAllAsync(
    `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`,
    [setId]
  );

  const data = {
    grip_export_version: GRIP_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    rally: { name: noteSet.rally_name, date: noteSet.rally_date },
    stage: { name: noteSet.stage_name },
    note_set: {
      version: noteSet.version,
      driver: noteSet.driver ?? null,
      recce_date: noteSet.recce_date ?? null,
    },
    pace_notes: rows.map(n => ({
      seq: n.seq,
      index_odo: n.index_odo,
      index_landmark: n.index_landmark,
      index_sequence: n.index_sequence,
      direction: n.direction,
      severity: n.severity,
      duration: n.duration,
      decorators: n.decorators ? JSON.parse(n.decorators) : [],
      joiner: n.joiner,
      notes: n.notes,
    })),
  };

  const safeName = `${noteSet.rally_name}-${noteSet.stage_name}-v${noteSet.version}`
    .replace(/[^a-z0-9-]/gi, '_');
  const filename = `${safeName}.grip.json`;
  const path = FileSystem.cacheDirectory + filename;

  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Export GRIP Note Set',
    UTI: 'public.json',
  });

  return filename;
}

// ── Import ──────────────────────────────────────────────────────────────────

/**
 * Prompts the user to pick a .grip.json file, then imports it into the DB.
 * Always creates a new note set (never overwrites).
 * @returns {{ rallyName, stageName, driver, count } | null} null if cancelled
 */
export async function importNoteSet() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;

  const file = result.assets[0];
  const content = await FileSystem.readAsStringAsync(file.uri);
  const data = JSON.parse(content);

  if (!data.grip_export_version || !Array.isArray(data.pace_notes)) {
    throw new Error('This does not appear to be a valid GRIP export file.');
  }

  // Find or create rally (match on name + date)
  const rallies = await getRallies();
  let rally = rallies.find(r => r.name === data.rally.name && r.date === data.rally.date);
  const rallyId = rally
    ? rally.id
    : await createRally({ name: data.rally.name, date: data.rally.date });

  // Find or create stage (match on name within rally)
  const stages = await getStages(rallyId);
  let stage = stages.find(s => s.name === data.stage.name);
  const stageId = stage
    ? stage.id
    : await createStage({ rallyId, name: data.stage.name });

  // Always create a fresh note set (import = new version)
  const setId = await createNoteSet({
    stageId,
    recceDate: data.note_set.recce_date,
    driver: data.note_set.driver,
  });

  // Insert pace notes
  for (const note of data.pace_notes) {
    await upsertPaceNote({ set_id: setId, ...note });
  }

  return {
    rallyName: data.rally.name,
    stageName: data.stage.name,
    driver: data.note_set.driver,
    count: data.pace_notes.length,
  };
}
