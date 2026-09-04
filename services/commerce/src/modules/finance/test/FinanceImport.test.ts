import { describe, expect, it, vi } from 'vitest';
import type { CommitContext } from '../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../foundation/application/JobScheduler';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import type { FinanceChannelPort } from '../../channel/public';
import type { OrganizationReadPort } from '../../organization/public';
import type { ImportObjectPort, ImportPort, RuntimeImportCreated } from '../../runtime/public';
import { ImportsCreateHandler } from '../application/handler/ImportsCreateHandler';

const prepared = Object.freeze({
  scope: 'mall:one',
  reference: 'object:statement',
  sha256: 'a'.repeat(64),
  name: 'statement.csv',
  mediaType: 'text/csv',
  size: 128,
  metadata: Object.freeze({
    provider: 'supplier',
    partnerId: 'partner:one',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    currency: 'CNY' as const,
    openingMinor: 100,
    closingMinor: 100,
  }),
});

describe('finance import creation', () => {
  it('fails closed when the selected provider is unavailable in the scoped Channel Catalog', async () => {
    const fixture = createFixture([{ id: 'wechat', label: '微信支付', count: 1 }]);

    await expect(fixture.handler.commit({} as never, prepared, context())).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { field: 'provider', reason: 'CHANNEL_PROVIDER_UNAVAILABLE' },
    });

    expect(fixture.organizations.descendants).toHaveBeenCalledWith(expect.anything(), 'mall:one');
    expect(fixture.channels.importProviders).toHaveBeenCalledWith(expect.anything(), ['mall:one', 'store:one']);
    expect(fixture.imports.create).not.toHaveBeenCalled();
    expect(fixture.jobs.schedule).not.toHaveBeenCalled();
  });

  it('creates only a Finance-owned statement import and schedules the unified Runtime job', async () => {
    const fixture = createFixture([{ id: 'supplier', label: '供应商账单', count: 1 }]);

    const result = await fixture.handler.commit({} as never, prepared, context());

    expect(fixture.imports.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      scope: 'mall:one',
      owner: 'finance',
      kind: 'statement',
      reference: 'object:statement',
      metadata: prepared.metadata,
    }));
    expect(fixture.jobs.schedule).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      kind: 'financeimport',
      owner: 'finance',
      scope: 'mall:one',
      payload: { import: expect.stringMatching(/^import:/) },
    }));
    expect(result.response).toMatchObject({ status: 202, body: { state: 'uploaded', total_count: 0 } });
  });
});

function context(): CommitContext<'finance.statementimports.create'> {
  const transaction = {} as WriteTransactionContext;
  return { ...readHandlerContext('finance.statementimports.create', transaction), transaction };
}

function createFixture(providers: readonly Readonly<{ id: string; label: string; count: number }>[]) {
  const imports = {
    create: vi.fn(async (): Promise<RuntimeImportCreated> => record()),
  } as unknown as ImportPort;
  const jobs = {
    schedule: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
  } satisfies JobScheduler;
  const organizations = {
    descendants: vi.fn(async () => ['mall:one', 'store:one']),
  } satisfies Pick<OrganizationReadPort, 'descendants'>;
  const channels = {
    importProviders: vi.fn(async () => providers),
  } satisfies Pick<FinanceChannelPort, 'importProviders'>;
  const objects = {} as ImportObjectPort;
  return Object.freeze({
    handler: new ImportsCreateHandler(imports, jobs, objects, organizations, channels),
    imports,
    jobs,
    organizations,
    channels,
  });
}

function record(): RuntimeImportCreated {
  return Object.freeze({
    id: 'import:one',
    state: 'uploaded',
    total_count: 0,
    cursor_value: 0,
    success_count: 0,
    failure_count: 0,
    created_at: '2026-09-06T00:00:00.000Z',
    updated_at: '2026-09-06T00:00:00.000Z',
  });
}
