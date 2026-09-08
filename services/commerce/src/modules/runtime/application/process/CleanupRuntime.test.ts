import { describe, expect, it, vi } from 'vitest';
import { result, transactionManager } from '../../../../test/TransactionFixture';
import type { RuntimeCleanupPorts } from '../port/CleanupPort';
import { CleanupRuntime } from './CleanupRuntime';

describe('CleanupRuntime', () => {
  it('removes expired objects outside transactions before deleting task metadata', async () => {
    const calls: string[] = [];
    const cleanup = new CleanupRuntime(
      transactionManager(async () => result([])),
      ports(calls),
      {
        remove: async (reference) => {
          calls.push(`remove:${reference}`);
        },
      },
      {
        identity: {
          purge: async () => {
            calls.push('identity');
          },
        },
        checkout: {
          purge: async () => {
            calls.push('checkout');
            return [];
          },
        },
        pricing: {
          purgeQuotes: async () => {
            calls.push('pricing');
          },
        },
        verification: {
          purge: async () => {
            calls.push('verification');
          },
        },
      },
      { batch: 500, objectConcurrency: 2, inboxDays: 90, outboxDays: 90 }
    );
    await cleanup.execute({ id: 'job:cleanup', token: 1 }, new AbortController().signal, Date.now() + 10_000);
    expect(calls).toEqual([
      'jobs:recover',
      'imports:expire',
      'identity',
      'checkout',
      'pricing',
      'verification',
      'imports:plan:500',
      'exports:plan:499',
      'jobs:plan',
      'idempotency:plan',
      'deadletters:plan',
      'inbox:plan',
      'outbox:plan',
      'jobs:record',
      'remove:object:source',
      'remove:object:report',
      'imports:purge:import:one',
      'exports:purge:export:one',
      'deadletters:purge',
      'jobs:purge',
      'idempotency:purge',
      'inbox:purge',
      'outbox:purge',
    ]);
  });

  it('keeps task metadata when object deletion fails so the next run can recover', async () => {
    const purge = vi.fn(async () => 1);
    const cleanup = new CleanupRuntime(
      transactionManager(async () => result([])),
      {
        ...ports([]),
        imports: { expire: async () => undefined, plan: async () => ({ ids: ['import:one'], objects: ['object:one'] }), purge },
      },
      {
        remove: async () => {
          throw new Error('OBJECT_STORE_UNAVAILABLE');
        },
      },
      { identity: { purge: async () => undefined }, checkout: { purge: async () => [] }, pricing: { purgeQuotes: async () => undefined }, verification: { purge: async () => undefined } },
      { batch: 500, objectConcurrency: 2, inboxDays: 90, outboxDays: 90 }
    );
    await expect(cleanup.execute({ id: 'job:cleanup', token: 1 }, new AbortController().signal, Date.now() + 10_000)).rejects.toThrow('OBJECT_STORE_UNAVAILABLE');
    expect(purge).not.toHaveBeenCalled();
  });

  it('records a deterministic plan hash and rejects a changed deletion boundary', async () => {
    const configured = ports([]);
    const record = vi.fn(configured.jobs.record);
    const cleanup = new CleanupRuntime(
      transactionManager(async () => result([])),
      {
        ...configured,
        jobs: { ...configured.jobs, record },
        exports: { ...configured.exports, purge: async () => 0 },
      },
      { remove: async () => undefined },
      { identity: { purge: async () => undefined }, checkout: { purge: async () => [] }, pricing: { purgeQuotes: async () => undefined }, verification: { purge: async () => undefined } },
      { batch: 500, objectConcurrency: 2, inboxDays: 90, outboxDays: 90 }
    );
    await expect(cleanup.execute({ id: 'job:cleanup', token: 7 }, new AbortController().signal, Date.now() + 10_000)).rejects.toThrow('CLEANUP_BOUNDARY_CHANGED:exports:1:0');
    expect(record).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'job:cleanup', token: 7 },
      expect.objectContaining({
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        counts: expect.objectContaining({ objects: 2, exports: 1 }),
      })
    );
  });
});

function ports(calls: string[]): RuntimeCleanupPorts {
  return {
    jobs: {
      recover: async () => {
        calls.push('jobs:recover');
      },
      plan: async () => {
        calls.push('jobs:plan');
        return ['job:old'];
      },
      record: async () => {
        calls.push('jobs:record');
      },
      purge: async () => {
        calls.push('jobs:purge');
        return 1;
      },
    },
    imports: {
      expire: async () => {
        calls.push('imports:expire');
      },
      plan: async (_context, limit) => {
        calls.push(`imports:plan:${limit}`);
        return { ids: ['import:one'], objects: ['object:source', 'object:report'] };
      },
      purge: async (_context, ids) => {
        calls.push(`imports:purge:${ids.join(',')}`);
        return 1;
      },
    },
    exports: {
      plan: async (_context, limit) => {
        calls.push(`exports:plan:${limit}`);
        return { ids: ['export:one'], objects: ['object:report'] };
      },
      purge: async (_context, ids) => {
        calls.push(`exports:purge:${ids.join(',')}`);
        return 1;
      },
    },
    control: {
      planIdempotency: async () => {
        calls.push('idempotency:plan');
        return [{ scope: 'scope:one', actor: 'actor:one', key: 'key:one' }];
      },
      purgeIdempotency: async () => {
        calls.push('idempotency:purge');
        return 1;
      },
      planDeadletters: async () => {
        calls.push('deadletters:plan');
        return ['deadletter:one'];
      },
      purgeDeadletters: async () => {
        calls.push('deadletters:purge');
        return 1;
      },
    },
    inbox: {
      plan: async () => {
        calls.push('inbox:plan');
        return [{ consumer: 'consumer:one', event: 'event:one' }];
      },
      purge: async () => {
        calls.push('inbox:purge');
        return 1;
      },
    },
    outbox: {
      plan: async () => {
        calls.push('outbox:plan');
        return ['event:one'];
      },
      purge: async () => {
        calls.push('outbox:purge');
        return 1;
      },
    },
  };
}
