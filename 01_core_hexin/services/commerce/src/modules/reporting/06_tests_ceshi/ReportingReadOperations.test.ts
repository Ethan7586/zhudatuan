import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { reportingOperatorReadActions } from '../03_application_yingyong/ReportingReadOperations';

describe('reporting read pagination', () => {
  it('encodes PostgreSQL timestamp values into the next-page cursor', async () => {
    const cursorTime = new Date('2026-09-11T12:00:00.000Z');
    const rows = Array.from({ length: 51 }, (_, index) => ({
      code: `sales.order.${index}`, version: 1, scope: 'mall:one',
      period: { from: '2026-09-11T00:00:00.000Z', to: '2026-09-12T00:00:00.000Z', timezone: 'Asia/Shanghai' },
      dimensions: {}, value: 1, unit: 'count', watermark: '2026-09-11T12:00:00.000Z', projectionVersion: 1,
      cursorTime, cursorId: `sales.order.${index}`,
    }));
    const query = vi.fn(async () => ({ rows, rowCount: rows.length } as unknown as QueryResult));
    const action = reportingOperatorReadActions()['reporting.sales.read'];
    if (typeof action !== 'function') throw new Error('REPORTING_SALES_READ_ACTION_MISSING');

    const response = await action(request(), { query } as unknown as OperationDatabase);

    expect(response).toMatchObject({ status: 200, body: { count: 50 } });
    expect((response.body as { nextCursor?: string }).nextCursor).toBeTypeOf('string');
  });
});

function request(): OperationRequest {
  return {
    type: 'reporting.sales.read', access: { scope: { id: 'mall:one' } },
    input: { path: {}, query: { limit: '50', period: '30days' }, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal },
  } as unknown as OperationRequest;
}
