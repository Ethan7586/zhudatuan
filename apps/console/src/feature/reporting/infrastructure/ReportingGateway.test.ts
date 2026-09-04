// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportSnapshot } from '../model/Report';
import { ReportingGateway } from './ReportingGateway';

const snapshot: ReportSnapshot = {
  query: { scope: 'enterprise:one', dimension: 'member', period: '7days', application: 'application:one' },
  watermark: { event: 'event:watermark', occurredAt: '2026-09-05T00:00:00.000Z', version: 8 },
  generatedAt: '2026-09-05T00:00:01.000Z',
  generationVersion: 1,
};

const server = setupServer(
  http.post('*/api/v1/reports/exports', async ({ request }) => {
    expect(request.headers.get('x-scope-hint')).toBe('enterprise:one');
    expect(request.headers.get('x-access-version')).toBe('7');
    expect(request.headers.get('idempotency-key')).toBe('export:command:one');
    expect(request.headers.get('x-csrf-token')).toBe('csrf:one');
    expect(await request.json()).toEqual({
      report: 'metrics',
      filter: { view: 'members', period: '7days', application: 'application:one' },
      snapshot,
    });
    return HttpResponse.json({
      id: 'export:one', scope: 'enterprise:one', report: 'metrics', filter: { view: 'members', period: '7days', application: 'application:one' },
      snapshot: { filter: { view: 'members', period: '7days', application: 'application:one' }, watermark: snapshot.watermark, generatedAt: snapshot.generatedAt, generationVersion: 1 },
      state: 'queued', cursor: null, recordCount: 0, objectReference: null, objectHash: null, objectSize: null, scanState: null,
      expiresAt: null, createdAt: '2026-09-05T00:02:00.000Z', generatedAt: null,
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('ReportingGateway', () => {
  it('creates an export from the exact displayed filter and frozen snapshot', async () => {
    const gateway = new ReportingGateway('http://localhost');
    const job = await gateway.createExport(context, { view: 'members', period: '7days', application: 'application:one' }, snapshot, 'export:command:one');
    expect(job).toMatchObject({ id: 'export:one', scope: 'enterprise:one', state: 'queued', snapshot: { watermark: snapshot.watermark } });
  });
});

const context = {
  scope: { kind: 'enterprise', id: 'enterprise:one' },
  session: { accessVersion: 7, csrf: 'csrf:one' },
} as ConsoleContext;
