import { describe, expect, it, vi } from 'vitest';
import { ExportReport, exportCsvCell } from '../application/process/ExportReport';
import { ExportsReadHandler } from '../application/handler/ExportsReadHandler';

describe('secure report export', () => {
  it.each(['=2+3', '+cmd', '-10+20', '@SUM(A1:A2)'])('neutralizes spreadsheet formula input %s', (value) => {
    expect(exportCsvCell(value)).toBe(`'${value}`);
  });

  it('quotes delimiters after formula neutralization', () => {
    expect(exportCsvCell('=1,2')).toBe('"\'=1,2"');
    expect(exportCsvCell('plain')).toBe('plain');
  });

  it('authorizes only a five minute download after a clean completed object', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://objects.example/report.csv?token=one', expiresAt: '2026-09-03T00:05:00.000Z' });
    const handler = new ExportsReadHandler({} as never, { authorize } as never);
    const response = await handler.finalize({} as never, {
      id: 'export:one', scope: 'enterprise:one', report: 'metrics', filter: {}, state: 'completed', cursor: null,
      recordCount: 2, objectReference: 'reports/export/one.csv', objectHash: 'a'.repeat(64), objectSize: 120, scanState: 'clean',
      expiresAt: '2026-09-03T00:10:00.000Z', createdAt: '2026-09-03T00:00:00.000Z', generatedAt: '2026-09-03T00:01:00.000Z',
    }, {} as never);
    expect(authorize).toHaveBeenCalledWith('reports/export/one.csv', 300);
    expect(response.body.download?.url).toContain('https://objects.example/');
  });

  it('keeps the execution type constructible with bounded dependencies', () => {
    expect(new ExportReport({} as never, {} as never, {} as never, 3)).toBeTruthy();
  });
});
