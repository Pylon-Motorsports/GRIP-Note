/**
 * Renders a pace note to a display string.
 * Order: [pre-note decorators] [direction/severity] [duration] [other decorators] [joiner]
 *
 * @param {object}   note           - pace_note row (decorators as array)
 * @param {string}   displayOrder   - "direction_first" | "severity_first"
 * @param {string[]} preNoteDecs    - decorator values that render BEFORE direction/severity
 *                                   (case-insensitive match). Defaults to ['!','!!','!!!','Care'].
 * @returns {string}
 */
export function renderNote(
  note,
  displayOrder = 'direction_first',
  preNoteDecs = ['!', '!!', '!!!', 'Care'],
) {
  const preSet = new Set(preNoteDecs.map(d => d.toLowerCase()));
  const decorators = Array.isArray(note.decorators) ? note.decorators : [];
  const before = decorators.filter(d => preSet.has(d.toLowerCase()));
  const after  = decorators.filter(d => !preSet.has(d.toLowerCase()));

  const parts = [];

  // 1. Pre-note decorators
  parts.push(...before);

  // 2. Direction / severity
  const dir = note.direction ?? '';
  const sev = note.severity  ?? '';
  if (displayOrder === 'direction_first') {
    if (dir) parts.push(dir);
    if (sev) parts.push(sev);
  } else {
    if (sev) parts.push(sev);
    if (dir) parts.push(dir);
  }

  // 3. Duration
  if (note.duration) parts.push(note.duration);

  // 4. Remaining decorators
  parts.push(...after);

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
