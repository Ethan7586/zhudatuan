import { describe, expect, it, vi } from 'vitest';
import { result, withWriteTransaction } from '../../../../test/TransactionFixture';
import { PgCheckoutSessionStore } from './PgCheckoutSessionStore';
import { confirmationDigest } from '../../domain/model/ConfirmationToken';

describe('PgCheckoutSessionStore', () => {
  it('persists only the one-time confirmation digest and binds it to quote ownership', async () => {
    const calls: unknown[][] = [];
    const rawToken = 'a'.repeat(43);
    const digest = confirmationDigest(rawToken);
    const query = vi.fn(async (sql: string, values: readonly unknown[] = []) => {
      calls.push([sql, values]);
      if (sql.includes('insert into checkout.session')) return result([{ checkoutId: 'checkout:one', quoteId: 'quote:one', signature: 'a'.repeat(64), expiresAt: future(), quoteVersion: 0 }]);
      if (sql.includes('from checkout.session session where')) return result([{ checkout: 'checkout:one', cartId: 'cart:one', memberId: 'member:one', mallId: 'mall:one', applicationId: 'app:one', quoteId: 'quote:one', quoteHash: 'a'.repeat(64), expiresAt: future(), input: {}, version: 0 }]);
      return result([]);
    });
    await withWriteTransaction(query, async (context) => {
      const store = new PgCheckoutSessionStore();
      await store.replaceCurrent(context, { checkoutId: 'checkout:one', quoteId: 'quote:one', signature: 'c'.repeat(64), confirmationDigest: digest, cartId: 'cart:one', memberId: 'member:one', mallId: 'mall:one', applicationId: 'app:one', addressId: null, selection: {}, expiresAt: future() });
      await store.lockQuote(context, 'quote:one', 'member:one', 'mall:one', digest);
    });
    const inserted = calls.find(([sql]) => String(sql).includes('insert into checkout.session'))!;
    expect(inserted[1]).toContain(digest);
    expect(JSON.stringify(inserted[1])).not.toContain(rawToken);
    const locked = calls.find(([sql]) => String(sql).includes('from checkout.session session where'))!;
    expect(locked[0]).toContain('session.confirmation_digest=$4');
    expect(locked[1]).toEqual(['quote:one', 'member:one', 'mall:one', digest]);
  });

  it('allows only one quoted-to-confirmed transition', async () => {
    let confirmations = 0;
    const query = vi.fn(async (sql: string) => sql.includes("set state='confirmed'") && confirmations++ === 0 ? result([{ id: 'checkout:one' }]) : result([]));
    await withWriteTransaction(query, async (context) => {
      const store = new PgCheckoutSessionStore();
      await store.confirm(context, 'checkout:one');
      await expect(store.confirm(context, 'checkout:one')).rejects.toThrow('CHECKOUT_CONFIRMATION_CONFLICT');
    });
  });
});

function future(): string {
  return new Date(Date.now() + 60_000).toISOString();
}
