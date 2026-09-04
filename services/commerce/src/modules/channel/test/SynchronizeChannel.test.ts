import { describe, expect, it, vi } from 'vitest';
import type { ProviderCapability } from '@shop/contract';
import { SynchronizeChannel, type ChannelSyncExecution } from '../application/process/SynchronizeChannel';
import type { ChannelJobRepository, ChannelSyncKind, ChannelSyncRun } from '../application/port/ChannelJobRepository';

describe('channel incremental synchronization', () => {
  it('commits catalog records and a sanitized cursor checkpoint in one apply transaction', async () => {
    const fixture = harness('catalogsync', 'catalog', 'Catalog', 'cursor:1');
    const accept = vi.fn().mockResolvedValue(undefined);
    fixture.source.pullCatalog = vi.fn().mockResolvedValue({
      records: [{ externalId: 'external:one', version: '2', payload: { name: '商品' } }],
      errors: [{ key: 'private-provider-key', code: 'PROVIDER_RECORD_REJECTED', message: 'raw provider message' }],
      complete: false,
      nextCursor: 'cursor:2',
    });

    await fixture.process({ catalog: { accept, keys: vi.fn(), sku: vi.fn() } });

    expect(fixture.repository.beginApply).toHaveBeenCalledOnce();
    expect(accept).toHaveBeenCalledOnce();
    const checkpoint = fixture.checkpoint();
    expect(checkpoint.run.progress.phase).toBe('apply');
    expect(checkpoint).toMatchObject({ accepted: 1, rejected: 1, complete: false, cursor: 'cursor:2' });
    expect(checkpoint.errors).toEqual([{ keyHash: expect.stringMatching(/^[a-f0-9]{64}$/), code: 'PROVIDER_RECORD_REJECTED' }]);
    expect(JSON.stringify(checkpoint.errors)).not.toMatch(/private-provider-key|raw provider message/);
    expect(fixture.repository.beginApply.mock.invocationCallOrder[0]).toBeLessThan(accept.mock.invocationCallOrder[0]!);
    expect(accept.mock.invocationCallOrder[0]).toBeLessThan(fixture.repository.finish.mock.invocationCallOrder[0]!);
  });

  it('counts unmapped price records as rejected while advancing the source-key cursor', async () => {
    const fixture = harness('pricesync', 'price', 'Price', null);
    fixture.source.pullPrice = vi.fn().mockResolvedValue({
      records: [
        { externalId: 'A', amountMinor: 100 },
        { externalId: 'B', amountMinor: 200 },
      ],
    });
    const saveProviderPrice = vi.fn().mockResolvedValue(undefined);
    const sku = vi.fn().mockResolvedValueOnce('sku:A').mockResolvedValueOnce(null);

    await fixture.process({
      catalog: { accept: vi.fn(), keys: vi.fn().mockResolvedValue(['A', 'B']), sku },
      pricing: { ensureProviderBook: vi.fn().mockResolvedValue(undefined), saveProviderPrice },
    });

    expect(saveProviderPrice).toHaveBeenCalledOnce();
    expect(fixture.checkpoint()).toMatchObject({ accepted: 1, rejected: 1, complete: true, cursor: 'B' });
    expect(fixture.checkpoint().errors).toEqual([{ keyHash: expect.stringMatching(/^[a-f0-9]{64}$/), code: 'CHANNEL_EXTERNAL_MAPPING_MISSING' }]);
  });

  it('applies stock observations and commits only after the batch succeeds', async () => {
    const fixture = harness('inventorysync', 'stock', 'Inventory', 'A');
    fixture.source.pullStock = vi.fn().mockResolvedValue({ records: [{ externalId: 'B', onhand: 8, safety: 2, version: '3' }] });
    const observe = vi.fn().mockResolvedValue(undefined);

    await fixture.process({
      catalog: { accept: vi.fn(), keys: vi.fn().mockResolvedValue(['B']), sku: vi.fn().mockResolvedValue('sku:B') },
      inventory: { observe },
    });

    expect(observe).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sku: 'sku:B', onhand: 8, safety: 2 }));
    expect(fixture.checkpoint()).toMatchObject({ accepted: 1, rejected: 0, complete: true, cursor: 'B' });
  });

  it('persists a statement, hands off a standard reconciliation and checkpoints the period end', async () => {
    const fixture = harness('statementsync', 'statement', 'Statement', null, { start: '2026-09-01', end: '2026-09-05', timezone: 'Asia/Shanghai', partner: 'partner:one' });
    fixture.source.pullStatement = vi.fn().mockResolvedValue({ objectRef: 'object:statement', sha256: 'a'.repeat(64) });
    const receiveReconciliation = vi.fn().mockResolvedValue(undefined);

    await fixture.process({ finance: { receiveReconciliation } });

    expect(fixture.repository.saveStatement).toHaveBeenCalledOnce();
    expect(receiveReconciliation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ provider: 'supplier', statement: expect.stringMatching(/^statement:/) }));
    expect(fixture.repository.scheduleReconciliation).toHaveBeenCalledOnce();
    expect(fixture.checkpoint()).toMatchObject({ accepted: 1, rejected: 0, complete: true, cursor: '2026-09-05' });
  });

  it('preserves the committed cursor when a resumed keyset has no more records', async () => {
    const fixture = harness('pricesync', 'price', 'Price', 'cursor:last');
    await fixture.process({ catalog: { accept: vi.fn(), keys: vi.fn().mockResolvedValue([]), sku: vi.fn() }, pricing: {} as never });
    expect(fixture.source.pullPrice).toBeUndefined();
    expect(fixture.checkpoint()).toMatchObject({ accepted: 0, rejected: 0, complete: true, cursor: 'cursor:last' });
  });

  it('stops after pull when cancellation arrives and classifies terminal deadletters', async () => {
    const controller = new AbortController();
    const fixture = harness('catalogsync', 'catalog', 'Catalog', null, {}, controller.signal);
    fixture.source.pullCatalog = vi.fn().mockImplementation(async () => {
      controller.abort(new Error('CHANNEL_SYNC_CANCELLED'));
      return { records: [], errors: [], complete: true };
    });

    await expect(fixture.process({ catalog: { accept: vi.fn(), keys: vi.fn(), sku: vi.fn() } })).rejects.toThrow('CHANNEL_SYNC_CANCELLED');
    expect(fixture.repository.beginApply).not.toHaveBeenCalled();
    expect(fixture.repository.finish).not.toHaveBeenCalled();

    await fixture.synchronization.fail({} as never, 'sync:one', 'mall:one', 'PROVIDER_RESPONSE_TIMEOUT');
    expect(fixture.repository.fail).toHaveBeenCalledWith({}, 'sync:one', 'mall:one', { classification: 'timeout', code: 'PROVIDER_RESPONSE_TIMEOUT', retryable: false });
  });
});

function harness(kind: ChannelSyncKind, runKind: ChannelSyncRun['kind'], capability: ProviderCapability, cursor: string | null, input: ChannelSyncRun['input'] = {}, signal = new AbortController().signal) {
  const run: ChannelSyncRun = Object.freeze({
    run: 'sync:one',
    connection: 'connection:one',
    provider: 'supplier',
    scope: 'mall:one',
    connectionVersion: 1,
    runVersion: 1,
    connectionState: 'enabled',
    capabilities: [capability],
    region: 'cn',
    kind: runKind,
    cursor,
    inputHash: 'a'.repeat(64),
    progress: { pulled: 0, accepted: 0, rejected: 0, phase: 'pull' as const, cursor, watermark: null },
    input,
  });
  const repository = {
    claim: vi.fn().mockResolvedValue(run),
    beginApply: vi.fn().mockImplementation(async (_context, current: ChannelSyncRun) => ({ ...current, runVersion: current.runVersion + 1, progress: { ...current.progress, phase: 'apply' } })),
    providerTenant: vi.fn().mockResolvedValue('tenant:one'),
    saveSource: vi.fn().mockResolvedValue(undefined),
    saveStatement: vi.fn().mockResolvedValue(undefined),
    scheduleReconciliation: vi.fn().mockResolvedValue(undefined),
    finish: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  };
  const source: Record<string, unknown> = {};
  const transactions = {
    read: async (_options: unknown, work: (context: never) => Promise<unknown>) => work({} as never),
    write: async (_options: unknown, work: (context: never) => Promise<unknown>) => work({} as never),
  };
  const extensions = { has: () => true, strategy: () => source };
  const synchronization = new SynchronizeChannel(transactions as never, repository as unknown as ChannelJobRepository, extensions as never, kind, {});
  const execution: ChannelSyncExecution = { job: kind, scope: 'mall:one', trace: 'job:one', signal, deadline: Date.now() + 30_000 };
  return {
    repository,
    source,
    synchronization,
    process: (dependencies: ConstructorParameters<typeof SynchronizeChannel>[4]) =>
      new SynchronizeChannel(transactions as never, repository as unknown as ChannelJobRepository, extensions as never, kind, dependencies).execute(run.run, execution),
    checkpoint: () => repository.finish.mock.calls[0]![1],
  };
}
