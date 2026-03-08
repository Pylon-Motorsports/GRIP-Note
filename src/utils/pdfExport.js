/**
 * @module pdfExport
 * Generates a landscape A4 PDF pacenote booklet from a rally's data.
 * Content is placed on the right half of each page (single-sided booklet layout).
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db/database';
import { renderNote, formatOdo } from './renderNote';

// A numerical joiner is a distance (10, 20, 30 …) — ends a note group and adds visual gap
const isNumJoiner = (joiner) => joiner && /^\d+$/.test(joiner);

// Conservative entries per page; notes that wrap to 2 lines won't overflow but may leave blank space
const ENTRIES_PER_PAGE = 9;

/**
 * Exports all stages of a rally as a landscape A4 PDF pacenote booklet.
 * Content is placed on the right half of each page (single-sided booklet layout).
 * Uses the latest note set per stage.
 */
export async function exportRallyPdf(rallyId) {
  const db = await getDb();

  const rally = await db.getFirstAsync(`SELECT * FROM rallies WHERE id = ?`, [rallyId]);
  if (!rally) throw new Error('Rally not found');

  const displayOrder = rally.display_order ?? 'direction_first';
  const odoUnit = rally.odo_unit ?? 'metres';

  const cauRows = await db.getAllAsync(
    `SELECT value FROM rally_chips WHERE rally_id = ? AND category = 'caution_decorator'`,
    [rallyId],
  );
  const cautionSet = cauRows.length > 0 ? new Set(cauRows.map((r) => r.value)) : null;

  const stages = await db.getAllAsync(`SELECT * FROM stages WHERE rally_id = ? ORDER BY name ASC`, [
    rallyId,
  ]);

  const pageHtmlParts = [];

  for (const stage of stages) {
    // Latest note set for this stage
    const noteSet = await db.getFirstAsync(
      `SELECT * FROM note_sets WHERE stage_id = ? ORDER BY version DESC LIMIT 1`,
      [stage.id],
    );
    if (!noteSet) continue;

    const rows = await db.getAllAsync(
      `SELECT * FROM pace_notes WHERE set_id = ? ORDER BY seq ASC`,
      [noteSet.set_id],
    );
    if (rows.length === 0) continue;

    const notes = rows.map((n) => ({
      ...n,
      decorators: n.decorators ? JSON.parse(n.decorators) : [],
      joiner_decorators: n.joiner_decorators ? JSON.parse(n.joiner_decorators) : [],
    }));

    // Group notes into entries: a new group starts after every numerical joiner (or end of stage)
    const entries = [];
    let current = [];
    for (const note of notes) {
      current.push(note);
      if (!note.joiner || isNumJoiner(note.joiner)) {
        entries.push(current);
        current = [];
      }
    }
    if (current.length > 0) entries.push(current);

    // Paginate
    const totalPages = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PAGE));
    for (let p = 0; p < totalPages; p++) {
      const pageEntries = entries.slice(p * ENTRIES_PER_PAGE, (p + 1) * ENTRIES_PER_PAGE);
      pageHtmlParts.push(
        renderPage(rally.name, stage.name, pageEntries, p + 1, totalPages, displayOrder, odoUnit, cautionSet),
      );
    }
  }

  if (pageHtmlParts.length === 0) throw new Error('No notes to export');

  const html = buildHtml(pageHtmlParts.join('\n'));

  // A4 landscape in points (1pt = 1/72 inch): 297mm ≈ 842pt, 210mm ≈ 595pt
  const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Export Pacenotes PDF',
    UTI: 'com.adobe.pdf',
  });
}

// ── HTML page rendering ──────────────────────────────────────────────────────

/**
 * Renders a single PDF page as an HTML div with header, odo, and note entries.
 * @param {string} rallyName
 * @param {string} stageName
 * @param {import('../types').PaceNote[][]} entries — groups of notes (split by numerical joiners)
 * @param {number} pageNum — current page (1-based)
 * @param {number} totalPages
 * @param {import('../types').DisplayOrder} displayOrder
 * @param {import('../types').OdoUnit} odoUnit
 * @returns {string} HTML string for the page
 */
function renderPage(rallyName, stageName, entries, pageNum, totalPages, displayOrder, odoUnit, cautionSet) {
  const entriesHtml = entries
    .map((entry) => {
      const first = entry[0];
      const odoText = formatOdo(first.index_odo, odoUnit);
      const landmark = first.index_landmark ?? '';
      const odoLine = [odoText, landmark].filter(Boolean).join('  ·  ');

      // Each note in the group is rendered including its (non-numerical) joiner at the end
      const noteText = entry
        .map((n) => renderNote(n, displayOrder, null, cautionSet))
        .filter(Boolean)
        .join('  ');

      const last = entry[entry.length - 1];
      const isGap = isNumJoiner(last.joiner); // extra space after numerical joiner

      return `<div class="entry${isGap ? ' gap' : ''}">
      ${odoLine ? `<div class="odo">${esc(odoLine)}</div>` : ''}
      <div class="note">${esc(noteText)}</div>
    </div>`;
    })
    .join('');

  return `<div class="page">
  <div class="content">
    <div class="hdr">
      <span><b>${esc(stageName)}</b>&ensp;<span class="rn">${esc(rallyName)}</span></span>
      <span class="pn">${pageNum}&thinsp;/&thinsp;${totalPages}</span>
    </div>
    <div class="entries">${entriesHtml}</div>
  </div>
</div>`;
}

/** Escapes HTML special characters for safe embedding. */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wraps page HTML fragments in a full HTML document with print-ready CSS. */
function buildHtml(body) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Helvetica, Arial, sans-serif; background: white; }

.page {
  width: 297mm;
  height: 210mm;
  overflow: hidden;
  page-break-after: always;
  position: relative;
  background: white;
}
.page:last-child { page-break-after: auto; }

/* Right half only — left half intentionally blank for booklet printing */
.content {
  position: absolute;
  left: 50%; top: 0; right: 0; bottom: 0;
  padding: 8mm 12mm 8mm 10mm;
  display: flex;
  flex-direction: column;
}

.hdr {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 0.4pt solid #ccc;
  padding-bottom: 1.5mm;
  margin-bottom: 4mm;
  font-size: 8pt;
  color: #777;
  flex-shrink: 0;
}
.hdr b  { color: #111; font-size: 9pt; }
.rn     { color: #aaa; font-size: 7.5pt; }
.pn     { color: #888; font-size: 8pt; white-space: nowrap; }

.entries { flex: 1; overflow: hidden; }

.entry     { margin-bottom: 3mm; }
.entry.gap { margin-bottom: 8mm; }

.odo {
  font-size: 8pt;
  color: #bbb;
  margin-bottom: 0.5mm;
  letter-spacing: 0.3pt;
}

.note {
  font-size: 24pt;
  font-weight: bold;
  font-family: 'Courier New', Courier, monospace;
  line-height: 1.1;
  color: #111;
}

@media print {
  @page { size: A4 landscape; margin: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
}
</style></head>
<body>
${body}
</body></html>`;
}
