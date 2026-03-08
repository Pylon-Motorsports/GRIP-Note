import { parseVoiceNote, parseMultiNote, mergeVoiceResult } from '../parseVoiceNote';

// Minimal chip definitions matching DEFAULT_CHIP_SEEDS structure
const CHIPS = {
  direction: [
    { value: 'L', audible: 'Left' },
    { value: 'R', audible: 'Right' },
    { value: 'Keep L', audible: 'Keep Left' },
    { value: 'Keep R', audible: 'Keep Right' },
  ],
  severity: [
    { value: '3', audible: null },
    { value: '5', audible: null },
    { value: '9', audible: null },
    { value: 'Hairpin', audible: null },
  ],
  duration: [
    { value: 'Short', audible: null },
    { value: 'Long', audible: null },
  ],
  caution_decorator: [
    { value: '!', audible: 'Caution' },
    { value: '!!', audible: 'Double Caution' },
  ],
  decorator: [
    { value: 'Brow', audible: null },
    { value: 'Opens', audible: null },
  ],
  joiner: [
    { value: '→', audible: 'Into' },
    { value: '100', audible: null },
    { value: '200', audible: null },
  ],
  joiner_decorator: [
    { value: '!', audible: 'Caution' },
    { value: 'Brow', audible: null },
  ],
};

describe('parseVoiceNote', () => {
  it('returns empty object for empty transcript', () => {
    expect(parseVoiceNote('', CHIPS)).toEqual({});
  });

  it('returns empty object for null transcript', () => {
    expect(parseVoiceNote(null, CHIPS)).toEqual({});
  });

  it('returns empty object for null chips', () => {
    expect(parseVoiceNote('left three', null)).toEqual({});
  });

  it('parses "left three" → direction L, severity 3', () => {
    const result = parseVoiceNote('left three', CHIPS);
    expect(result.direction).toBe('L');
    expect(result.severity).toBe('3');
  });

  it('parses word numbers: "five" → severity 5', () => {
    const result = parseVoiceNote('five', CHIPS);
    expect(result.severity).toBe('5');
  });

  it('multi-word chips: "keep left" matches Keep L, not bare L', () => {
    const result = parseVoiceNote('keep left', CHIPS);
    expect(result.direction).toBe('Keep L');
  });

  it('parses decorators: "caution brow" → decorators [!, Brow]', () => {
    const result = parseVoiceNote('caution brow', CHIPS);
    expect(result.decorators).toContain('!');
    expect(result.decorators).toContain('Brow');
  });

  it('single-select overwrites: longest-first order determines winner', () => {
    const result = parseVoiceNote('left right', CHIPS);
    // "right" (5 chars) matched first (longest-first), then "left" (4 chars) overwrites
    expect(result.direction).toBe('L');
  });

  it('joiner detection via audible: "into" → joiner →', () => {
    const result = parseVoiceNote('into', CHIPS);
    expect(result.joiner).toBe('→');
  });

  it('word boundary respect: "brow" matches but "browse" doesn\'t', () => {
    const result = parseVoiceNote('browse', CHIPS);
    // "browse" has no word boundary after "brow" since 'se' follows
    expect(result.decorators).toEqual([]);
  });

  it('parses a full voice command', () => {
    const result = parseVoiceNote('caution left three long into', CHIPS);
    expect(result.direction).toBe('L');
    expect(result.severity).toBe('3');
    expect(result.duration).toBe('Long');
    expect(result.decorators).toContain('!');
    expect(result.joiner).toBe('→');
  });
});

describe('mergeVoiceResult', () => {
  const current = {
    direction: 'L',
    severity: '5',
    duration: null,
    decorators: ['Brow'],
    joiner: null,
    joiner_decorators: [],
  };

  it('voiced fields overwrite current', () => {
    const voiced = { direction: 'R', severity: '3', decorators: [], joiner_decorators: [] };
    const merged = mergeVoiceResult(current, voiced);
    expect(merged.direction).toBe('R');
    expect(merged.severity).toBe('3');
  });

  it('missing voiced fields preserve current', () => {
    const voiced = { direction: null, severity: null, decorators: [], joiner_decorators: [] };
    const merged = mergeVoiceResult(current, voiced);
    expect(merged.direction).toBe('L');
    expect(merged.severity).toBe('5');
    expect(merged.decorators).toEqual(['Brow']);
  });

  it('voiced decorators replace current decorators when non-empty', () => {
    const voiced = { decorators: ['!', 'Opens'], joiner_decorators: [] };
    const merged = mergeVoiceResult(current, voiced);
    expect(merged.decorators).toEqual(['!', 'Opens']);
  });

  it('empty voiced decorators preserve current decorators', () => {
    const voiced = { decorators: [], joiner_decorators: [] };
    const merged = mergeVoiceResult(current, voiced);
    expect(merged.decorators).toEqual(['Brow']);
  });
});

// ── Note accumulation (simulates DriveScreen handleStructuredResult) ──────────

const DRIVE_CHIPS = {
  ...CHIPS,
  joiner: [
    { value: '→', audible: 'Into' },
    { value: '>', audible: 'Opens' },
    { value: '<', audible: 'Tightens' },
    { value: '100', audible: null },
    { value: '200', audible: null },
  ],
};

const EMPTY_NOTE = {
  direction: null,
  severity: null,
  duration: null,
  decorators: [],
  joiner: null,
  joiner_decorators: [],
  notes: '',
  joiner_notes: '',
};

/**
 * Simulates DriveScreen's handleStructuredResult logic:
 * accumulates voice inputs, saves when a new direction or caution is spoken.
 */
function simulateAccumulation(transcripts, chips = DRIVE_CHIPS) {
  const saved = [];
  let cur = { ...EMPTY_NOTE };

  const cautionValues = new Set(
    (chips.caution_decorator ?? []).map((c) => c.value),
  );

  for (const transcript of transcripts) {
    const parsed = parseMultiNote(transcript, chips);
    for (const note of parsed) {
      const startsNew =
        !!note.direction || note.decorators?.some((d) => cautionValues.has(d));

      if (startsNew && (cur.direction || cur.severity || cur.decorators?.length)) {
        saved.push({ ...cur });
        cur = { ...EMPTY_NOTE };
      }

      cur = mergeVoiceResult(cur, note);
    }
  }

  return { saved, current: cur };
}

describe('regular note accumulation', () => {
  it('builds a note across direction → severity → joiner inputs', () => {
    const { saved, current } = simulateAccumulation(['left', 'three', 'into']);

    // Nothing saved yet — note is still building (into is not a SAVE_JOINER)
    expect(saved).toHaveLength(0);
    expect(current.direction).toBe('L');
    expect(current.severity).toBe('3');
    expect(current.joiner).toBe('→');
  });

  it('saves previous note when new direction is spoken', () => {
    const { saved, current } = simulateAccumulation([
      'left', 'three', 'into',   // first note
      'right', 'five',            // triggers save of first, starts second
    ]);

    expect(saved).toHaveLength(1);
    expect(saved[0].direction).toBe('L');
    expect(saved[0].severity).toBe('3');
    expect(saved[0].joiner).toBe('→');

    expect(current.direction).toBe('R');
    expect(current.severity).toBe('5');
  });

  it('parses direction + severity in single utterance', () => {
    const { saved, current } = simulateAccumulation(['left three']);

    expect(saved).toHaveLength(0);
    expect(current.direction).toBe('L');
    expect(current.severity).toBe('3');
  });

  it('multi-note utterance splits and saves correctly', () => {
    const { saved, current } = simulateAccumulation(['left three into right five']);

    // "left three into" saved, "right five" is current
    expect(saved).toHaveLength(1);
    expect(saved[0].direction).toBe('L');
    expect(saved[0].severity).toBe('3');
    expect(saved[0].joiner).toBe('→');

    expect(current.direction).toBe('R');
    expect(current.severity).toBe('5');
  });

  it('standalone joiner adds to accumulated note (hasContent fix)', () => {
    const { current } = simulateAccumulation(['left', 'three', 'into']);

    expect(current.joiner).toBe('→');
  });

  it('caution triggers save of previous note', () => {
    const { saved, current } = simulateAccumulation([
      'left three',
      'caution right five',
    ]);

    expect(saved).toHaveLength(1);
    expect(saved[0].direction).toBe('L');
    expect(saved[0].severity).toBe('3');

    expect(current.decorators).toContain('!');
    expect(current.direction).toBe('R');
    expect(current.severity).toBe('5');
  });
});

describe('opens/tightens (regular joiners)', () => {
  it('opens accumulates as a normal joiner', () => {
    const { saved, current } = simulateAccumulation(['right five opens']);

    // Not saved — still accumulating
    expect(saved).toHaveLength(0);
    expect(current.direction).toBe('R');
    expect(current.severity).toBe('5');
    expect(current.joiner).toBe('>');
  });

  it('tightens accumulates as a normal joiner', () => {
    const { saved, current } = simulateAccumulation(['left three tightens']);

    expect(saved).toHaveLength(0);
    expect(current.direction).toBe('L');
    expect(current.severity).toBe('3');
    expect(current.joiner).toBe('<');
  });

  it('new direction after opens saves previous note', () => {
    const { saved, current } = simulateAccumulation([
      'right five opens',
      'left three',
    ]);

    expect(saved).toHaveLength(1);
    expect(saved[0].direction).toBe('R');
    expect(saved[0].severity).toBe('5');
    expect(saved[0].joiner).toBe('>');

    expect(current.direction).toBe('L');
    expect(current.severity).toBe('3');
  });
});

describe('parseMultiNote', () => {
  it('returns empty array for empty input', () => {
    expect(parseMultiNote('', CHIPS)).toEqual([]);
    expect(parseMultiNote(null, CHIPS)).toEqual([]);
  });

  it('parses standalone joiner (hasContent includes joiner)', () => {
    const results = parseMultiNote('into', CHIPS);
    expect(results).toHaveLength(1);
    expect(results[0].joiner).toBe('→');
  });

  it('splits multi-direction utterance into separate notes', () => {
    const results = parseMultiNote('left three right five', CHIPS);
    expect(results).toHaveLength(2);
    expect(results[0].direction).toBe('L');
    expect(results[0].severity).toBe('3');
    expect(results[1].direction).toBe('R');
    expect(results[1].severity).toBe('5');
  });

  it('compound number splitting: "220" → severity 2 + freetext 20', () => {
    // "left 220" normalizes to "left 2 20" → direction L, severity matched
    const results = parseMultiNote('left 220', {
      ...CHIPS,
      severity: [{ value: '2', audible: null }, ...CHIPS.severity],
    });
    expect(results).toHaveLength(1);
    expect(results[0].direction).toBe('L');
    expect(results[0].severity).toBe('2');
    // "20" should be in notes as freetext
    expect(results[0].notes).toContain('20');
  });
});
