import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutSelection } from '../../services/commerce/src/modules/checkout/domain/model/CheckoutSelection';
import { PgCheckoutSessionStore } from '../../services/commerce/src/modules/checkout/infrastructure/persistence/PgCheckoutSessionStore';
import { CHECKOUT_LOCK_ORDER, LockOrderGuard } from '../../services/commerce/src/modules/checkout/domain/policy/LockOrderGuard';
import { withWriteTransaction } from '../../services/commerce/src/test/TransactionFixture';

test('checkout quote binds only explicit selected lines and canonicalizes resource locks', () => {
  const selection = checkoutSelection({
    cartVersion: 7,
    lines: [
      { listingId: 'listing:b', quantity: 2, lineVersion: 4 },
      { listingId: 'listing:a', quantity: 1, lineVersion: 3 },
    ],
    addressId: 'address:one',
    delivery: {},
    voucherIds: ['voucher:one'],
    benefits: [{ accountId: 'benefit:one', amountMinor: 100 }],
    paymentScene: 'jsapi',
  });
  assert.deepEqual(
    selection.lines.map(({ listingId }) => listingId),
    ['listing:a', 'listing:b']
  );
  assert.equal(selection.cartVersion, 7);
  const guard = LockOrderGuard.afterIdempotency();
  for (const lock of CHECKOUT_LOCK_ORDER.slice(1)) guard.advance(lock);
  assert.doesNotThrow(() => guard.complete());
});

test('concurrent confirmation of one quote succeeds once', async () => {
  let quoted = true;
  const database = {
    query: async (sql: string) => {
      assert.match(sql, /state='quoted'/);
      if (!quoted) return { rows: [], rowCount: 0 };
      quoted = false;
      return { rows: [{ id: 'checkout:one' }], rowCount: 1 };
    },
  };
  const repository = new PgCheckoutSessionStore();
  const outcomes = await Promise.allSettled([withWriteTransaction(database.query, (context) => repository.confirm(context, 'checkout:one')), withWriteTransaction(database.query, (context) => repository.confirm(context, 'checkout:one'))]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 1);
});
