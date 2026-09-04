import { describe, expect, it, vi } from 'vitest';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { FacetsReadHandler } from '../application/handler/FacetsReadHandler';

const transaction = {} as ReadTransactionContext;

describe('finance facets', () => {
  it('aggregates only descendant scopes and merges active Channel Catalog providers', async () => {
    const read = vi.fn(async (_context, scopes: readonly string[]) => ({
      periods: [{ value: '2026-08-01/2026-08-31', count: 4 }],
      providers: [{ value: 'jd', count: 3 }, { value: 'retired', count: 1 }],
      malls: [{ value: 'mall:one', count: 4 }],
      states: [{ value: 'difference', count: 2 }],
      differenceTypes: [{ value: 'AMOUNT_MISMATCH', count: 2 }],
      watermark: '2026-09-05T10:00:00.000Z',
    }));
    const providers = vi.fn(async (_context, scopes: readonly string[]) => [{ id: 'jd', label: '京东', count: 1 }, { id: 'supplier', label: '自有供应商', count: 1 }]);
    const handler = new FacetsReadHandler(
      { read },
      {
        descendants: vi.fn(async () => ['enterprise:one', 'mall:one']),
        activeMalls: vi.fn(async () => ['mall:one']),
        summaries: vi.fn(async () => [{ id: 'mall:one', name: '春晖商城', kind: 'mall' }]),
      },
      { importProviders: providers }
    );

    const reply = await handler.execute({} as never, readHandlerContext('finance.facets.read', transaction, 'enterprise:one'));

    expect(read).toHaveBeenCalledWith(transaction, ['enterprise:one', 'mall:one']);
    expect(providers).toHaveBeenCalledWith(transaction, ['enterprise:one', 'mall:one']);
    expect(reply.body.providers.items).toEqual([
      { value: 'jd', label: '京东', count: 3, available: true },
      { value: 'retired', label: '自定义服务商', count: 1, available: false },
      { value: 'supplier', label: '自有供应商', count: 0, available: true },
    ]);
    expect(reply.body.malls.items).toEqual([{ value: 'mall:one', label: '春晖商城', count: 4 }]);
    expect(reply.body.differenceTypes.items[0]?.label).toBe('金额不一致');
  });

  it('returns an explicit reason for every empty group instead of empty-select ambiguity', async () => {
    const handler = new FacetsReadHandler(
      { read: vi.fn(async () => ({ periods: [], providers: [], malls: [], states: [], differenceTypes: [], watermark: null })) },
      { descendants: vi.fn(async () => ['mall:one']), activeMalls: vi.fn(async () => []), summaries: vi.fn(async () => []) },
      { importProviders: vi.fn(async () => []) }
    );

    const reply = await handler.execute({} as never, readHandlerContext('finance.facets.read', transaction));

    expect(reply.body.periods.reason).toMatch(/账期/);
    expect(reply.body.providers.reason).toMatch(/渠道连接/);
    expect(reply.body.malls.reason).toMatch(/商城/);
    expect(reply.body.states.reason).toMatch(/状态/);
    expect(reply.body.differenceTypes.reason).toMatch(/差异类型/);
  });
});
