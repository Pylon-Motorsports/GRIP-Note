import { parseNote } from '../paceNotes';

describe('parseNote', () => {
  it('parses JSON string decorators into arrays', () => {
    const row = {
      set_id: 'abc',
      seq: 1,
      decorators: '["!","Brow"]',
      joiner_decorators: '["Opens"]',
    };
    const parsed = parseNote(row);
    expect(parsed.decorators).toEqual(['!', 'Brow']);
    expect(parsed.joiner_decorators).toEqual(['Opens']);
  });

  it('returns empty arrays for null decorators', () => {
    const row = { set_id: 'abc', seq: 1, decorators: null, joiner_decorators: null };
    const parsed = parseNote(row);
    expect(parsed.decorators).toEqual([]);
    expect(parsed.joiner_decorators).toEqual([]);
  });

  it('returns empty arrays for empty string decorators', () => {
    const row = { set_id: 'abc', seq: 1, decorators: '', joiner_decorators: '' };
    const parsed = parseNote(row);
    expect(parsed.decorators).toEqual([]);
    expect(parsed.joiner_decorators).toEqual([]);
  });

  it('preserves other row fields', () => {
    const row = {
      set_id: 'xyz',
      seq: 3,
      direction: 'L',
      severity: '5',
      decorators: '["!"]',
      joiner_decorators: null,
    };
    const parsed = parseNote(row);
    expect(parsed.set_id).toBe('xyz');
    expect(parsed.seq).toBe(3);
    expect(parsed.direction).toBe('L');
    expect(parsed.severity).toBe('5');
  });
});
