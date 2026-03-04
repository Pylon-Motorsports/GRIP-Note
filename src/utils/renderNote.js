// Decorators that render BEFORE direction/severity
const CAUTION_DECORATORS = new Set(['!', '!!', '!!!', 'care']);

/**
 * Renders a pace note to a display string.
 * Order: [caution decorators] [direction/severity] [duration] [regular decorators] [joiner]
 * Caution decorators (!, !!, !!!, care) always lead the note.
 *
 * @param {object} note           - pace_note row (decorators as array)
 * @param {string} displayOrder   - "direction_first" | "severity_first"
 * @returns {string}
 */
export function renderNote(note, displayOrder = 'direction_first') {
  const decorators = Array.isArray(note.decorators) ? note.decorators : [];
  const cautionDecs = decorators.filter(d => CAUTION_DECORATORS.has(d.toLowerCase()));
  const regularDecs = decorators.filter(d => !CAUTION_DECORATORS.has(d.toLowerCase()));

  const parts = [];

  // 1. Caution decorators first
  parts.push(...cautionDecs);

  // 2. Direction / severity
  const dir = note.direction ?? '';
  const sev = note.severity ?? '';
  if (displayOrder === 'direction_first') {
    if (dir) parts.push(dir);
    if (sev) parts.push(sev);
  } else {
    if (sev) parts.push(sev);
    if (dir) parts.push(dir);
  }

  // 3. Duration
  if (note.duration) parts.push(note.duration);

  // 4. Regular decorators
  parts.push(...regularDecs);

  // 5. Joiner
  if (note.joiner) parts.push(note.joiner);

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
