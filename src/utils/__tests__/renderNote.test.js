import { renderNote, formatOdo } from '../renderNote';

describe('renderNote', () => {
  it('returns empty string for empty note', () => {
    expect(renderNote({})).toBe('');
  });

  it('renders direction only', () => {
    expect(renderNote({ direction: 'L' })).toBe('L');
  });

  it('renders direction + severity (direction_first)', () => {
    expect(renderNote({ direction: 'L', severity: '3' }, 'direction_first')).toBe('L 3');
  });

  it('renders direction + severity (severity_first)', () => {
    expect(renderNote({ direction: 'L', severity: '3' }, 'severity_first')).toBe('3 L');
  });

  it('renders caution decorators before direction/severity', () => {
    expect(
      renderNote({
        direction: 'L',
        severity: '3',
        decorators: ['!'],
      }),
    ).toBe('! L 3');
  });

  it('renders double/triple caution and Care before direction', () => {
    expect(
      renderNote({
        direction: 'R',
        severity: '5',
        decorators: ['!!', 'Care'],
      }),
    ).toBe('!! Care R 5');
  });

  it('renders non-caution decorators after duration', () => {
    expect(
      renderNote({
        direction: 'L',
        severity: '3',
        duration: 'Short',
        decorators: ['Brow'],
      }),
    ).toBe('L 3 Short Brow');
  });

  it('renders mixed caution and non-caution decorators in correct order', () => {
    expect(
      renderNote({
        direction: 'L',
        severity: '3',
        decorators: ['Brow', '!'],
      }),
    ).toBe('! L 3 Brow');
  });

  it('renders note freetext after decorators, before joiner', () => {
    expect(
      renderNote({
        direction: 'L',
        severity: '3',
        notes: 'over bridge',
      }),
    ).toBe('L 3 over bridge');
  });

  it('renders joiner after note body', () => {
    expect(
      renderNote({
        direction: 'L',
        severity: '3',
        joiner: '→',
      }),
    ).toBe('L 3 →');
  });

  it('renders joiner decorators: cautions first, then others', () => {
    expect(
      renderNote({
        direction: 'L',
        severity: '3',
        joiner: '→',
        joiner_decorators: ['Brow', '!'],
      }),
    ).toBe('L 3 → ! Brow');
  });

  it('handles null/undefined fields gracefully', () => {
    expect(
      renderNote({
        direction: null,
        severity: undefined,
        decorators: null,
        joiner_decorators: undefined,
      }),
    ).toBe('');
  });

  // TTS mode tests
  it('TTS: substitutes audibleMap values', () => {
    const audibleMap = { L: 'Left', 3: 'Three' };
    expect(renderNote({ direction: 'L', severity: '3' }, 'direction_first', audibleMap)).toBe(
      'Left Three',
    );
  });

  it('TTS: inserts comma between consecutive numeric tokens', () => {
    const audibleMap = {};
    expect(renderNote({ severity: '3', joiner: '200' }, 'direction_first', audibleMap)).toBe(
      '3, 200',
    );
  });

  it('TTS: no comma between non-numeric tokens', () => {
    const audibleMap = { L: 'Left' };
    expect(renderNote({ direction: 'L', severity: '3' }, 'direction_first', audibleMap)).toBe(
      'Left 3',
    );
  });

  it('renders full complex note correctly', () => {
    expect(
      renderNote({
        direction: 'L',
        severity: '3',
        duration: 'Long',
        decorators: ['!', 'Brow', 'Opens'],
        notes: 'past gate',
        joiner: '→',
        joiner_decorators: ['!!', 'Narrows'],
      }),
    ).toBe('! L 3 Long past gate Brow Opens → !! Narrows');
  });
});

describe('formatOdo', () => {
  it('returns empty string for null', () => {
    expect(formatOdo(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatOdo(undefined)).toBe('');
  });

  it('formats metres', () => {
    expect(formatOdo(500, 'metres')).toBe('500 m');
  });

  it('formats km', () => {
    expect(formatOdo(1500, 'km')).toBe('1.50 km');
  });

  it('formats 0 metres', () => {
    expect(formatOdo(0, 'metres')).toBe('0 m');
  });

  it('defaults to metres', () => {
    expect(formatOdo(750)).toBe('750 m');
  });
});
