/**
 * @module parseVoiceNote
 * Converts speech-to-text transcripts into pace note fields by matching
 * spoken words against rally chip values and their audible labels.
 */

/** Spoken word → digit, for matching voice transcripts */
const WORD_TO_NUM = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

/**
 * Parses a voice transcript into note fields using the rally's chip definitions.
 *
 * @param {string} transcript — raw STT output
 * @param {Object} allChips   — { category: [{ value, audible }] } from getAllChips()
 * @returns Partial note object — only fields that matched (others are null / [])
 */
export function parseVoiceNote(transcript, allChips) {
  if (!transcript || !allChips) return {};

  // Normalise: lowercase, substitute word-numbers
  let text = transcript.toLowerCase().trim();
  for (const [word, num] of Object.entries(WORD_TO_NUM)) {
    text = text.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
  }

  // Build a flat lookup: { phrase (lowercase) → { category, value } }
  // Multi-word phrases are matched before shorter ones (greedy longest-first)
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

  // Track which character positions in the normalised string are already consumed
  const consumed = new Uint8Array(text.length);

  for (const { phrase, category, value } of entries) {
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const pos = text.indexOf(phrase, searchFrom);
      if (pos === -1) break;
      searchFrom = pos + 1;

      // Require word boundaries
      const before = pos === 0 || /\W/.test(text[pos - 1]);
      const after = pos + phrase.length >= text.length || /\W/.test(text[pos + phrase.length]);
      if (!before || !after) continue;

      // Skip if any character in this span is already matched
      let overlaps = false;
      for (let i = pos; i < pos + phrase.length; i++) {
        if (consumed[i]) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      // Mark consumed
      for (let i = pos; i < pos + phrase.length; i++) consumed[i] = 1;

      // Apply to result (single-select fields overwrite; multi-select append)
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

  return result;
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
  };
}
