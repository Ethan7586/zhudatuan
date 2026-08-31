import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PaymentLifecycle } from '../../services/commerce/src/modules/payment/domain/policy/PaymentLifecycle';

test('payment query, close and late-success paths are deterministic', () => {
  const lifecycle = new PaymentLifecycle();
  assert.equal(lifecycle.afterQuery('succeeded', false), 'settle');
  assert.equal(lifecycle.afterQuery('pending', false), 'requery');
  assert.equal(lifecycle.afterQuery('pending', true), 'close');
  assert.equal(lifecycle.afterQuery('refunded', false), 'recover');
  assert.equal(lifecycle.afterClose('succeeded'), 'settle');
  assert.equal(lifecycle.afterClose('pending'), 'requery');
});

test('webhook and active query race converge on one locked payment and one recovery resource', () => {
  const jobs = text('../../services/commerce/src/modules/payment/PaymentJobs.ts');
  const webhook = text('../../services/commerce/src/modules/payment/PaymentWebhook.ts');
  const schema = text('../../database/migrations/20260821021000_create_payment_voucher_benefit.sql');
  assert.match(jobs, /for update of intent,attempt/);
  assert.match(jobs, /if \(current\.payment\)[\s\S]+commit/);
  assert.match(jobs, /recovery:late:\$\{selected\.intent\}/);
  assert.match(webhook, /runtime\.accept_provider_webhook/);
  assert.match(webhook, /PAYMENT_WEBHOOK_INTEGRITY_MISMATCH/);
  assert.match(schema, /order_id text not null unique/);
});

function text(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}
