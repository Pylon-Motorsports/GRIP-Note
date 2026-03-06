/**
 * @module parseVoiceNote
 * Converts speech-to-text transcripts into pace note fields by matching
 * spoken words against rally chip values and their audible labels.
 */

/** Common STT homophones relevant to rally pace notes */
const HOMOPHONES = {
  write: 'right',
  rite: 'right',
  wright: 'right',
  hand: 'and',
  sex: 'six',
  titans: 'tightens',
};

/** Spoken word → digit, for matching voice transcripts */
const WORD_TO_NUM = {
  zero: '0',
  one: '1',
  won: '1',
  two: '2',
  too: '2',
  to: '2',
  three: '3',
  four: '4',
  for: '4',
  fore: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  ate: '8',
  nine: '9',
};

/**
 * Normalises a transcript: lowercase, strip punctuation, apply homophones,
 * convert word-numbers, split compound numbers (e.g. "220" → "2 20").
 */
function normalizeTranscript(transcript) {
  let text = transcript.toLowerCase().trim().replace(/[:.;,!?]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [word, replacement] of Object.entries(HOMOPHONES)) {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'g'), replacement);
  }
  for (const [word, num] of Object.entries(WORD_TO_NUM)) {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
  }
  // Split compound numbers: "220" → "2 20" (severity digit + distance)
  // Only splits when the remaining digits start with a non-zero digit.
  text = text.replace(/\b(\d)([1-9]\d+)\b/g, '$1 $2');
  return text;
}

/**
 * Parses already-normalised text against chip definitions.
 *
 * @param {string}  text
 * @param {Object}  allChips
 * @param {boolean} preserveOrder — when true, only extract structural fields
 *   (direction, severity, joiner, caution_decorator). Everything else stays in
 *   the text so it becomes part of `notes` in spoken order.
 */
function parseNormalizedText(text, allChips, preserveOrder = false) {
  // Categories that are always extracted (structural fields)
  const STRUCTURAL = new Set(['direction', 'severity', 'joiner', 'caution_decorator']);

  const entries = [];
  for (const [category, chips] of Object.entries(allChips)) {
    for (const chip of chips) {
      const forms = new Set([chip.value.toLowerCase()]);
      if (chip.audible) forms.add(chip.audible.toLowerCase());
      for (const phrase of forms) {
        entries.push({ phrase, category, value: chip.value });
      }
    }
  }
  entries.sort((a, b) => b.phrase.length - a.phrase.length);

  const result = {
    direction: null,
    severity: null,
    duration: null,
    decorators: [],
    joiner: null,
    joiner_decorators: [],
  };

  const consumed = new Uint8Array(text.length);

  for (const { phrase, category, value } of entries) {
    // In preserveOrder mode, skip non-structural categories so they stay in notes
    if (preserveOrder && !STRUCTURAL.has(category)) continue;

    let searchFrom = 0;
    while (searchFrom < text.length) {
      const pos = text.indexOf(phrase, searchFrom);
      if (pos === -1) break;
      searchFrom = pos + 1;

      const before = pos === 0 || /\W/.test(text[pos - 1]);
      const after = pos + phrase.length >= text.length || /\W/.test(text[pos + phrase.length]);
      if (!before || !after) continue;

      let overlaps = false;
      for (let i = pos; i < pos + phrase.length; i++) {
        if (consumed[i]) { overlaps = true; break; }
      }
      if (overlaps) continue;

      for (let i = pos; i < pos + phrase.length; i++) consumed[i] = 1;

      switch (category) {
        case 'direction':
          result.direction = value;
          break;
        case 'severity':
          result.severity = value;
          break;
        case 'duration':
          result.duration = value;
          break;
        case 'joiner':
          result.joiner = value;
          break;
        case 'caution_decorator':
        case 'decorator':
          if (!result.decorators.includes(value)) result.decorators.push(value);
          break;
        case 'joiner_decorator':
          if (!result.joiner_decorators.includes(value)) result.joiner_decorators.push(value);
          break;
      }
    }
  }

  // Collect unmatched text as freetext notes
  let remaining = '';
  for (let i = 0; i < text.length; i++) {
    remaining += consumed[i] ? ' ' : text[i];
  }
  remaining = remaining.replace(/\s+/g, ' ').trim();
  if (remaining) result.notes = remaining;

  return result;
}

/**
 * Parses a voice transcript into note fields using the rally's chip definitions.
 *
 * @param {string} transcript — raw STT output
 * @param {Object} allChips   — { category: [{ value, audible }] } from getAllChips()
 * @returns Partial note object — only fields that matched (others are null / [])
 */
export function parseVoiceNote(transcript, allChips) {
  if (!transcript || !allChips) return {};
  return parseNormalizedText(normalizeTranscript(transcript), allChips);
}

/**
 * Parses a transcript that may contain multiple pace notes (multiple directions).
 * Splits at direction word boundaries and parses each segment independently.
 *
 * @returns {Array} array of parsed note objects
 */
export function parseMultiNote(transcript, allChips) {
  if (!transcript || !allChips) return [];

  const text = normalizeTranscript(transcript);

  // Collect all direction trigger forms (value + audible, lowercased)
  const dirForms = [];
  for (const chip of allChips.direction ?? []) {
    dirForms.push(chip.value.toLowerCase());
    if (chip.audible) dirForms.push(chip.audible.toLowerCase());
  }

  // Find positions of direction words in the normalised text
  const splitPoints = [];
  for (const dir of dirForms) {
    const re = new RegExp(`\\b${dir}\\b`, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      splitPoints.push(m.index);
    }
  }

  // Deduplicate and sort
  const sorted = [...new Set(splitPoints)].sort((a, b) => a - b);

  if (sorted.length <= 1) {
    // Single note — parse the whole text
    const result = parseNormalizedText(text, allChips, true);
    return hasContent(result) ? [result] : [];
  }

  // Split into segments at each direction boundary
  const segments = [];
  for (let i = 0; i < sorted.length; i++) {
    // First segment includes any text before the first direction
    const start = i === 0 ? 0 : sorted[i];
    const end = i + 1 < sorted.length ? sorted[i + 1] : text.length;
    const seg = text.slice(start, end).trim();
    if (seg) segments.push(seg);
  }

  return segments.map((s) => parseNormalizedText(s, allChips, true)).filter(hasContent);
}

function hasContent(note) {
  return note.direction || note.severity || note.joiner || note.notes || note.decorators?.length > 0;
}

/**
 * Merges a voice-parsed result into the current note state.
 * Voiced fields always win; missing/empty voiced fields leave current unchanged.
 */
export function mergeVoiceResult(current, voiced) {
  return {
    ...current,
    ...(voiced.direction != null ? { direction: voiced.direction } : {}),
    ...(voiced.severity != null ? { severity: voiced.severity } : {}),
    ...(voiced.duration != null ? { duration: voiced.duration } : {}),
    ...(voiced.joiner != null ? { joiner: voiced.joiner } : {}),
    ...(voiced.decorators?.length ? { decorators: voiced.decorators } : {}),
    ...(voiced.joiner_decorators?.length ? { joiner_decorators: voiced.joiner_decorators } : {}),
    ...(voiced.notes ? { notes: voiced.notes } : {}),
  };
}
