import { describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { ReportingMapper } from '../infrastructure/ReportingMapper';
import { reportingKey } from './ReportingQueryKey';

describe('ReportingViewModel boundaries', () => {
  it('isolates cache identity by scope, access version, filter and cursor', () => {
    const context = { scope: { kind: 'mall', id: 'mall:one' }, session: { accessVersion: 9 } } as ConsoleContext;
    const base = reportingKey(context, { view: 'categories', period: '30days' });
    const next = reportingKey(context, { view: 'categories', period: '30days', cursor: 'cursor:two' });
    expect(base.slice(0, 4)).toEqual(['console', 'mall', 'mall:one', 9]);
    expect(base).not.toEqual(next);
  });

  it('rejects DTO extensions and non-HTTPS download links at the mapper boundary', () => {
    const mapper = new ReportingMapper();
    const job = { id: 'export:one', scope: 'mall:one', report: 'metrics', filter: {}, state: 'completed', cursor: null, recordCount: 1, objectReference: 'reports/one.csv', objectHash: 'a'.repeat(64), objectSize: 10, scanState: 'clean', expiresAt: null, createdAt: '2026-09-03T00:00:00.000Z', generatedAt: '2026-09-03T00:01:00.000Z' } as const;
    expect(() => mapper.export({ ...job, unexpected: true })).toThrow();
    expect(() => mapper.export({ ...job, download: { url: 'http://objects.example/report.csv', expiresAt: '2026-09-03T00:05:00.000Z' } })).toThrow();
  });
});
