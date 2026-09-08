import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import { PgActivationRate } from '../infrastructure/persistence/PgActivationRate';

describe('PgActivationRate', () => {
  it('allows and records the fifth attempt within the operation transaction', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => result(sql.includes('count(*)') ? [{ attempts: 4 }] : []));
    await expect(withWriteTransaction(query, (context) => new PgActivationRate().consume(context, attempt()))).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('insert into voucher.activationattempt'), ['activationattempt:one', 'mall:one', 'principal:one', 'a'.repeat(64), new Date('2026-09-05T00:00:00.000Z')]);
  });

  it('returns a denial after five attempts without rolling back earlier evidence', async () => {
    const query = vi.fn(async (sql: string, _values?: readonly unknown[]) => result(sql.includes('count(*)') ? [{ attempts: 5 }] : []));
    await expect(withWriteTransaction(query, (context) => new PgActivationRate().consume(context, attempt()))).resolves.toBe(false);
    expect(query.mock.calls.some(([sql]) => sql.includes('insert into'))).toBe(false);
  });
});

function attempt() {
  return Object.freeze({ id: 'activationattempt:one', scope: 'mall:one', actor: 'principal:one', fingerprint: 'a'.repeat(64), attemptedAt: new Date('2026-09-05T00:00:00.000Z') });
}
