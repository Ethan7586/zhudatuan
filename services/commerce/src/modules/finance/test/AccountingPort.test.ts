import { describe, expect, it, vi } from 'vitest';
import { result, withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';
import { PgAccountingPort } from '../infrastructure/persistence/PgAccountingPort';
import { PgSettlementReadPort } from '../infrastructure/persistence/PgSettlementReadPort';
import type { PostingCommand } from '../public';

const command: PostingCommand = Object.freeze({
  scopeId: 'mall:one',
  source: Object.freeze({ module: 'payment', aggregate: 'payment', aggregateId: 'payment:one', event: 'payment.captured', eventId: 'event:one', leg: 'capture' }),
  currency: 'CNY',
  description: '支付入账',
  debit: Object.freeze({ code: 'cash', kind: 'asset' }),
  credit: Object.freeze({ code: 'commerce.clearing', kind: 'income' }),
  amountMinor: 100,
  occurredAt: '2026-09-06T00:00:00.000Z',
});

describe('finance public ports', () => {
  it('posts only a validated standard command and preserves its source binding', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('select finance.post')) return result([{ journal: 'journal:one' }]);
      if (sql.includes('select 1 from finance.economicleg')) return result([{ found: 1 }]);
      return result([]);
    });

    await expect(withWriteTransaction(query, context => new PgAccountingPort().post(context, command))).resolves.toBe('journal:one');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('select finance.post'), [
      'mall:one', 'payment.captured', 'payment:one', 'CNY', '支付入账', 'cash', 'asset', 'commerce.clearing', 'income', 100, '2026-09-06T00:00:00.000Z',
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('insert into finance.economicleg'), ['event:one', 'capture', 'journal:one', 'mall:one', 'CNY', 100, '2026-09-06T00:00:00.000Z']);
  });

  it('rejects a source whose event belongs to another module before writing', async () => {
    const query = vi.fn(async () => result([]));
    const invalid = { ...command, source: { ...command.source, module: 'voucher' } };

    await expect(withWriteTransaction(query, context => new PgAccountingPort().post(context, invalid))).rejects.toThrow('VALIDATION_FAILED');
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps settlement reads separate and returns immutable account entries', async () => {
    const query = vi.fn(async () => result([{ id: 'entry:one', accountId: 'account:one', amountMinor: 100, referenceType: 'benefit.grant', referenceId: 'grant:one', description: '福利发放', occurredAt: '2026-09-06T00:00:00.000Z' }]));

    const entries = await withReadTransaction(query, context => new PgSettlementReadPort().entries(context, ['account:one'], { occurredAt: null, entry: null }, 20));

    expect(entries).toEqual([{ id: 'entry:one', accountId: 'account:one', amountMinor: 100, referenceType: 'benefit.grant', referenceId: 'grant:one', description: '福利发放', occurredAt: '2026-09-06T00:00:00.000Z' }]);
    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(entries[0])).toBe(true);
  });
});
