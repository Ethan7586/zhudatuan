import { describe, expect, it } from 'vitest';
import { Sla } from './Sla';

describe('Sla', () => {
  it('derives response, resolution and reopen clocks from one policy', () => {
    const sla = new Sla('sla:normal', 'mall:one', 'normal', 300, 3600, 7200, 1);
    const opened = new Date('2026-09-06T00:00:00.000Z');
    expect(sla.deadlines(opened)).toEqual({ response: '2026-09-06T00:05:00.000Z', resolution: '2026-09-06T01:00:00.000Z' });
    expect(sla.reopenUntil(opened)).toBe('2026-09-06T02:00:00.000Z');
  });

  it('rejects inconsistent policy clocks and versions', () => {
    expect(() => new Sla('sla:normal', 'mall:one', 'normal', 600, 300, 7200, 1)).toThrow('SUPPORT_SLA_INVALID');
    expect(() => new Sla('sla:normal', 'mall:one', 'normal', 300, 3600, 0, 1)).toThrow('SUPPORT_SLA_INVALID');
  });
});
