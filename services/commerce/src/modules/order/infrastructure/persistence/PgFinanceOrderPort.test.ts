import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgFinanceOrderPort } from './PgFinanceOrderPort';

describe('PgFinanceOrderPort', () => {
  it('returns only verified Order-owned records in stable order', async () => {
    const query = vi.fn(async (sql: string, values?: readonly unknown[]) => {
      expect(sql).toContain('from ordering.orderrecord');
      expect(sql).not.toMatch(/\b(?:finance|payment)\./);
      expect(values).toEqual([['order:two', 'order:one']]);
      return result([{ id: 'order:one' }, { id: 'order:two' }]);
    });

    await expect(withReadTransaction(query, (context) => new PgFinanceOrderPort().verified(context, ['order:two', 'order:one']))).resolves.toEqual(['order:one', 'order:two']);
  });

  it('does not query the database for an empty request', async () => {
    const query = vi.fn(async () => result([]));
    await expect(withReadTransaction(query, (context) => new PgFinanceOrderPort().verified(context, []))).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
