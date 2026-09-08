import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { ExpireMarketingBudget } from './ExpireMarketingBudget';

describe('ExpireMarketingBudget', () => {
  it('runs one scoped write transaction and releases only the requested order at the job clock', async () => {
    const expire = vi.fn(async (_context: WriteTransactionContext, _order: string, _at: Date) => undefined);
    const write = vi.fn(async (options, work: (context: WriteTransactionContext) => Promise<void>) => {
      expect(options).toMatchObject({ scope: 'mall:one', actor: 'job:marketingbudgetexpiry', operation: 'job.marketing.budgetexpiry', workload: 'jobs' });
      return work({ trace: options.trace } as WriteTransactionContext);
    });
    const before = Date.now();
    await new ExpireMarketingBudget({ write } as never, { expire }).execute({
      order: 'order:one',
      scope: 'mall:one',
      trace: 'job:one',
      signal: new AbortController().signal,
      deadline: Date.now() + 5_000,
    });
    expect(expire).toHaveBeenCalledWith(expect.objectContaining({ trace: 'job:one' }), 'order:one', expect.any(Date));
    expect(expire.mock.calls[0]?.[2].getTime()).toBeGreaterThanOrEqual(before);
    expect(write).toHaveBeenCalledOnce();
  });
});
