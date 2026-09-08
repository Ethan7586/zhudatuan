import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../test/TransactionFixture';
import { PgFinanceChannelPort } from '../infrastructure/persistence/PgFinanceChannelPort';

describe('finance channel public port', () => {
  it('returns only the standard immutable statement DTO', async () => {
    const query = vi.fn(async () =>
      result([
        {
          id: 'statement:one',
          scope: 'mall:one',
          object_ref: 'object:one',
          sha256: 'a'.repeat(64),
          period_start: '2026-08-01',
          period_end: '2026-08-31',
          timezone: 'Asia/Shanghai',
          provider_secret: 'never-expose',
        },
      ])
    );
    const statement = await withReadTransaction(query, (context) => new PgFinanceChannelPort().statement(context, 'statement:one', 'mall:one'));

    expect(statement).toEqual({
      id: 'statement:one',
      scope: 'mall:one',
      objectRef: 'object:one',
      sha256: 'a'.repeat(64),
      period: { start: '2026-08-01', end: '2026-08-31', timezone: 'Asia/Shanghai' },
    });
    expect(JSON.stringify(statement)).not.toContain('never-expose');
  });

  it('returns canonical provider availability without connection configuration', async () => {
    const query = vi.fn(async () => result([{ provider: 'supplier', count: '2', configuration: { credential: 'never-expose' } }]));
    const providers = await withReadTransaction(query, (context) => new PgFinanceChannelPort().importProviders(context, ['mall:one']));

    expect(providers).toEqual([{ id: 'supplier', label: '自有供应商', count: 2 }]);
    expect(Object.isFrozen(providers)).toBe(true);
    expect(JSON.stringify(providers)).not.toContain('credential');
  });
});
