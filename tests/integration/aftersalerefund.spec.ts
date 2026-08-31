import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { COMMERCE_EVENTS } from '@shop/contract';
import { AfterSale } from '../../services/commerce/src/modules/order/domain/model/AfterSale';
import { AfterSaleRefundPolicy } from '../../services/commerce/src/modules/order/domain/policy/AfterSaleRefundPolicy';

test('physical and digital aftersale branches reach refund only through their declared state paths', () => {
  const physical = ['applied', 'reviewing', 'approved', 'returning', 'received', 'refunding', 'resolved'] as const;
  const digital = ['applied', 'reviewing', 'approved', 'refunding', 'resolved'] as const;
  for (const path of [physical, digital]) {
    for (let index = 0; index < path.length - 1; index += 1) assert.equal(AfterSale.from(path[index]!).transition(path[index + 1]!), path[index + 1]);
  }
  assert.throws(() => AfterSale.from('approved').transition('resolved'), /ORDER_AFTERSALE_NOT_ALLOWED/);
  assert.throws(() => AfterSale.from('returning').transition('refunding'), /ORDER_AFTERSALE_NOT_ALLOWED/);
  assert.throws(() => AfterSale.from('rejected').transition('refunding'), /ORDER_AFTERSALE_NOT_ALLOWED/);
});

test('refund split consumes the original tender in reverse allocation order without double refunding', () => {
  const policy = new AfterSaleRefundPolicy();
  const evidence = {
    tenders: [
      { kind: 'benefit', reference: 'benefit:one', amountMinor: 6_000 },
      { kind: 'voucher', reference: 'voucher:one', amountMinor: 2_000 },
      { kind: 'wechat', reference: null, amountMinor: 4_000 },
    ],
  };
  assert.deepEqual(policy.plan(5_000, evidence), [
    { kind: 'wechat', reference: null, amountMinor: 4_000 },
    { kind: 'voucher', reference: 'voucher:one', amountMinor: 1_000 },
  ]);
  assert.deepEqual(
    policy.plan(4_000, evidence, [
      {
        tenders: [
          { kind: 'wechat', reference: null, amountMinor: 4_000 },
          { kind: 'voucher', reference: 'voucher:one', amountMinor: 1_000 },
        ],
      },
    ]),
    [
      { kind: 'voucher', reference: 'voucher:one', amountMinor: 1_000 },
      { kind: 'benefit', reference: 'benefit:one', amountMinor: 3_000 },
    ]
  );
});

test('event and database contracts make replay idempotent and enforce fulfilled quantity', () => {
  const events = new Map(COMMERCE_EVENTS.map((event) => [event.type, event.module]));
  assert.equal(events.get('aftersale.applied'), 'order');
  assert.equal(events.get('aftersale.changed'), 'order');
  assert.equal(events.get('return.inspected'), 'fulfillment');
  assert.equal(events.get('refund.completed'), 'payment');
  const lifecycle = readFileSync(new URL('../../database/migrations/20260831014000_complete_aftersale_lifecycle.sql', import.meta.url), 'utf8');
  const payment = readFileSync(new URL('../../database/migrations/20260821039000_checkout_atomic_order.sql', import.meta.url), 'utf8');
  assert.match(lifecycle, /constraint trigger enforce_aftersale_line_quantity[\s\S]+deferrable initially deferred/);
  assert.match(lifecycle, /claimed>fulfilled or recorded<>claimed/);
  assert.match(lifecycle, /unique index fulfillment_return_aftersale_fulfillment/);
  assert.match(payment, /unique index payment_refund_aftersale/);
});
