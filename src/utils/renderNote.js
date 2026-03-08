/**
 * @module renderNote
 * Converts pace note objects into display/TTS strings.
 */

/**
 * Renders a pace note to a display/TTS string.
 * Order: [caution decs] [direction/severity] [duration] [freetext] [other decs] [joiner]
 *        [joiner-caution-decs] [joiner-other-decs]
 *
 * Caution decorators (!, !!, !!!, Care) always render before direction/severity — hardcoded.
 *
 * @param {object}      note         - pace_note row (decorators + joiner_decorators as arrays)
 * @param {string}      displayOrder - "direction_first" | "severity_first"
 * @param {object|null} audibleMap   - optional { value → audible } for TTS output
 * @returns {string}
 */

const DEFAULT_CAUTION_DECS = new Set(['!', '!!', '!!!', 'care']);

export function renderNote(note, displayOrder = 'direction_first', audibleMap = null, cautionSet = null) {
  const cautions = cautionSet ?? DEFAULT_CAUTION_DECS;
  const toA = (v) => (audibleMap && audibleMap[v] ? audibleMap[v] : v);

  const decorators = Array.isArray(note.decorators) ? note.decorators : [];
  const before = decorators.filter((d) => cautions.has(d) || cautions.has(d.toLowerCase()));
  const after = decorators.filter((d) => !cautions.has(d) && !cautions.has(d.toLowerCase()));

  const parts = [];

  // 1. Caution decorators (!, !!, !!!, Care)
  before.forEach((d) => parts.push(toA(d)));

  // 2. Direction / severity
  const dir = note.direction ?? '';
  const sev = note.severity ?? '';
  if (displayOrder === 'direction_first') {
    if (dir) parts.push(toA(dir));
    if (sev) parts.push(toA(sev));
  } else {
    if (sev) parts.push(toA(sev));
    if (dir) parts.push(toA(dir));
  }

  // 3. Duration
  if (note.duration) parts.push(toA(note.duration));

  // 4. Note freetext (distances, landmarks — stays close to severity)
  if (note.notes) parts.push(note.notes);

  // 5. Remaining note decorators
  after.forEach((d) => parts.push(toA(d)));

  // 6. Joiner
  if (note.joiner) parts.push(toA(note.joiner));

  // 7. Joiner decorators: cautions first, then others
  const joinerDecs = Array.isArray(note.joiner_decorators) ? note.joiner_decorators : [];
  const joinerBefore = joinerDecs.filter((d) => cautions.has(d) || cautions.has(d.toLowerCase()));
  const joinerAfter = joinerDecs.filter((d) => !cautions.has(d) && !cautions.has(d.toLowerCase()));
  joinerBefore.forEach((d) => parts.push(toA(d)));
  joinerAfter.forEach((d) => parts.push(toA(d)));

  // 8. Joiner freetext (e.g. severity after > / <)
  if (note.joiner_notes) parts.push(note.joiner_notes);

  // In TTS mode, insert comma between consecutive numeric tokens to prevent
  // e.g. "2 200" being read as "2200" instead of "Two, Two Hundred"
  if (audibleMap !== null) {
    let result = '';
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        const sep = /^\d+$/.test(parts[i - 1]) && /^\d+$/.test(parts[i]) ? ', ' : ' ';
        result += sep;
      }
      result += parts[i];
    }
    return result.trim();
  }

  return parts.join(' ').trim();
}

/**
 * Formats an odo value (stored as integer metres) for display.
 *
 * @param {number|null} metres
 * @param {string} unit - "metres" | "km"
 * @returns {string}
 */
export function formatOdo(metres, unit = 'metres') {
  if (metres == null) return '';
  if (unit === 'km') return (metres / 1000).toFixed(2) + ' km';
  return metres + ' m';
}
