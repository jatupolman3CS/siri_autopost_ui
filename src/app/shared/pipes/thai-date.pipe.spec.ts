import { ThaiDatePipe } from './thai-date.pipe';

describe('ThaiDatePipe', () => {
  const pipe = new ThaiDatePipe();

  it('formats in Bangkok time with the Buddhist year', () => {
    const text = pipe.transform('2026-10-03T09:00:00Z');
    expect(text).toContain('2569');
    expect(text).toContain('16:00');
  });

  it('returns a dash for empty or invalid values', () => {
    expect(pipe.transform(null)).toBe('-');
    expect(pipe.transform('not a date')).toBe('-');
  });
});
