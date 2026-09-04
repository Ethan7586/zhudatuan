import { describe, expect, it, vi } from 'vitest';
import type { JobScheduler } from '../../../foundation/application/JobScheduler';
import type { WriteHandlerContext } from '../../../foundation/application/HandlerContext';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { DirectoriesSyncHandler } from '../application/handler/DirectoriesSyncHandler';
import type { OrganizationRepository } from '../application/port/OrganizationRepository';

describe('directory sync command', () => {
  it('cancels the durable run and its unclaimed background job', async () => {
    const cancelRun = vi.fn(async () => ({ id: run, state: 'cancelled', mode: 'incremental' }));
    const cancel = vi.fn(async () => undefined);
    const handler = new DirectoriesSyncHandler(repository({ cancelRun }), { schedule: vi.fn(), cancel } as unknown as JobScheduler);
    const result = await handler.execute({ path: { directoryid: directory }, query: {}, body: { action: 'cancel', run } } as never, context());
    expect(cancelRun).toHaveBeenCalledWith(transaction, directory, run);
    expect(cancel).toHaveBeenCalledWith(transaction, 'directorysync', run);
    expect(result).toMatchObject({ status: 200, body: { id: run, state: 'cancelled' } });
  });

  it('creates a new queued run from a failed durable source', async () => {
    const resumeRun = vi.fn(async () => ({ id: resumed, state: 'queued', mode: 'incremental' }));
    const schedule = vi.fn(async () => undefined);
    const handler = new DirectoriesSyncHandler(repository({ resumeRun }), { schedule, cancel: vi.fn() } as unknown as JobScheduler);
    const result = await handler.execute({ path: { directoryid: directory }, query: {}, body: { action: 'resume', run } } as never, context());
    expect(resumeRun).toHaveBeenCalledWith(transaction, directory, run, 'identity:stable');
    expect(schedule).toHaveBeenCalledWith(transaction, expect.objectContaining({ kind: 'directorysync', payload: expect.objectContaining({ connection: directory, run: resumed }) }));
    expect(result).toMatchObject({ status: 202, body: { id: resumed, state: 'queued' } });
  });
});

const directory = '10000000-0000-4000-8000-000000000001';
const run = '20000000-0000-4000-8000-000000000001';
const resumed = '20000000-0000-4000-8000-000000000002';
const transaction = {} as WriteTransactionContext;
function repository(overrides: Record<string, unknown>): OrganizationRepository {
  return { lockDirectory: vi.fn(async () => ({ synchronizable: () => true })), ...overrides } as unknown as OrganizationRepository;
}
function context(): WriteHandlerContext<'organization.directories.sync'> {
  return {
    requestId: 'request:one',
    traceId: 'trace:one',
    deadline: Date.now() + 1000,
    signal: new AbortController().signal,
    operation: 'organization.directories.sync',
    headers: {},
    rawBody: '',
    idempotencyKey: 'identity:stable',
    transaction,
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:one', session: 'session:one', membership: 'membership:one', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3 } },
        membership: { id: 'membership:one', active: true, accessVersion: 1, permissions: { allows: new Set(['organization.directory.sync']), denies: new Set() }, scopes: [] },
        organization: 'mall:one',
        scope: { id: 'mall:one', kind: 'mall', path: [] },
        accessVersion: 1,
        capabilities: new Set(['organization.directories.sync']),
        capabilityVersion: 1,
        assurance: { level: 3 },
        trace: 'trace:one',
      },
    },
  } as never;
}
