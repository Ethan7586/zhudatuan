import { describe, expect, it } from 'vitest';
import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { InvalidateNavigation } from '../application/process/InvalidateNavigation';

describe('InvalidateNavigation', () => {
  it('carries the job scope into cache invalidation and inbox completion', async () => {
    let invalidatedScope = '';
    let completedScope = '';
    const process = new InvalidateNavigation(
      {
        write: async (execution, action) => {
          completedScope = execution.scope;
          return action({} as WriteTransactionContext);
        },
        read: async () => {
          throw new Error('NOT_USED');
        },
      },
      {
        accept: async () => true,
        complete: async () => undefined,
      },
      {
        handle: async (event) => {
          invalidatedScope = event.scope;
          return true;
        },
      }
    );

    await process.execute(
      'event:one',
      'membership.updated',
      {},
      {
        scope: 'tenant:one',
        trace: 'trace:one',
        signal: new AbortController().signal,
        deadline: Date.now() + 1_000,
      }
    );

    expect(invalidatedScope).toBe('tenant:one');
    expect(completedScope).toBe('tenant:one');
  });
});
