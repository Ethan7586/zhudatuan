import { describe, expect, it } from 'vitest';
import { calendarRange } from './Date';

describe('calendarRange', () => {
  it.each([
    ['2026-09-01', '2026-09-30', '2026年9月1–30日'],
    ['2026-08-31', '2026-09-01', '2026年8月31日–9月1日'],
    ['2026-12-31', '2027-01-01', '2026年12月31日–2027年1月1日'],
  ])('formats %s through %s as a compact business period', (start, end, expected) => {
    expect(calendarRange(start, end)).toBe(expected);
  });

  it('does not reinterpret an instant as a business date', () => {
    expect(calendarRange('2026-08-31T16:00:00.000Z', '2026-09-29T16:00:00.000Z')).toBe('—');
  });
});
