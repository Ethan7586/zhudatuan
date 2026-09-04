// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { DirectoryGateway } from './DirectoryGateway';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DirectoryGateway', () => {
  it('maps durable directory and run watermarks', async () => {
    server.use(
      http.get('https://shop.test/api/v1/organization/directories', () => HttpResponse.json({ items: [directory], count: 1 })),
      http.get('https://shop.test/api/v1/organization/directories/:id/syncruns', () => HttpResponse.json({ items: [run], count: 1 }))
    );
    const gateway = new DirectoryGateway('https://shop.test');
    await expect(gateway.read(context)).resolves.toMatchObject({ items: [{ successfulVersion: 29, lastSuccessAt: '2026-09-03T00:10:00.000Z' }] });
    await expect(gateway.runs(context, directory.id)).resolves.toMatchObject({ items: [{ appliedCount: 8, watermark: '2026-09-03T00:09:00.000Z' }] });
  });

  it('sends a resumable command with stable identity, proof and csrf', async () => {
    const proof = 'p'.repeat(43);
    server.use(
      http.post('https://shop.test/api/v1/organization/directories/:id/syncs', async ({ request }) => {
        expect(request.headers.get('idempotency-key')).toBe('identity:stable');
        expect(request.headers.get('x-action-proof')).toBe(proof);
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(await request.json()).toEqual({ action: 'resume', run: run.id });
        return HttpResponse.json({ id: '20000000-0000-4000-8000-000000000002', state: 'queued', mode: 'incremental', preview: false });
      })
    );
    await expect(new DirectoryGateway('https://shop.test').synchronize(context, { action: 'resume', directory: directory.id, run: run.id, mode: 'incremental', proof, identity: 'identity:stable' })).resolves.toMatchObject({
      state: 'queued',
      mode: 'incremental',
    });
  });
});

const directory = {
  id: '10000000-0000-4000-8000-000000000001',
  organization_id: 'mall:one',
  type: 'wecomcorp' as const,
  status: 'enabled' as const,
  successful_version: 29,
  version: 4,
  updated_at: '2026-09-03T00:11:00.000Z',
  last_success_at: '2026-09-03T00:10:00.000Z',
};
const run = {
  id: '20000000-0000-4000-8000-000000000001',
  mode: 'incremental' as const,
  state: 'failed' as const,
  preview: false,
  read_count: 10,
  applied_count: 8,
  create_count: 3,
  update_count: 2,
  freeze_count: 1,
  restore_count: 2,
  conflict_count: 1,
  ignored_count: 1,
  watermark: '2026-09-03T00:09:00.000Z',
  started_at: '2026-09-03T00:08:00.000Z',
  completed_at: '2026-09-03T00:10:00.000Z',
  created_at: '2026-09-03T00:08:00.000Z',
};
const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    accessVersion: 7,
    permissions: ['organization.directory.read', 'organization.directory.sync'],
    capabilities: ['organization.directories.read', 'organization.directories.syncruns.read', 'organization.directories.sync'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};
