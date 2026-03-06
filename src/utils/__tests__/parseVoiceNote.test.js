import { parseVoiceNote, mergeVoiceResult } from '../parseVoiceNote';

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
