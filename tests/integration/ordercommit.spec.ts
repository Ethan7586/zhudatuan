import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CHECKOUT_LOCK_ORDER } from '../../services/commerce/src/modules/checkout/domain/policy/LockOrderGuard';

test('order commit has one fixed lock order and returns order plus prepared payment in one use case', () => {
  assert.deepEqual(CHECKOUT_LOCK_ORDER, ['idempotency', 'quote', 'cart', 'inventory', 'voucher', 'benefit', 'order', 'payment', 'finance', 'audit', 'outbox']);
  const source = text('../../services/commerce/src/modules/checkout/infrastructure/persistence/CheckoutConfirmationService.ts');
  for (const stage of CHECKOUT_LOCK_ORDER.slice(1)) assert.match(source, new RegExp(`lock\\.advance\\('${stage}'\\)`));
  assert.match(source, /orders\.create[\s\S]+payment\.prepare[\s\S]+payment\.capture/);
  assert.match(source, /body: \{ order: saved\.record, payment \}/);
});

test('same checkout and same idempotency identity cannot create two orders', () => {
  const order = text('../../database/migrations/20260821019000_create_cart_checkout_order.sql');
  const idempotency = text('../../database/migrations/20260829101000_operation_idempotency.sql');
  const runtime = text('../../services/commerce/src/adapter/database/PgIdempotencyRepository.ts');
  assert.match(order, /checkout_id text not null unique/);
  assert.match(idempotency, /primary key\(scope,actor_id,operation,key\)/);
  assert.match(runtime, /row\.request_hash !== claim\.requestHash[\s\S]+IDEMPOTENCY_CONFLICT/);
  assert.match(runtime, /row\.state === 'started'[\s\S]+row\.response/);
});

function text(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}
