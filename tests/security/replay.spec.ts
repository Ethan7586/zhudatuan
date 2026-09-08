import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { assertWechatPayTransactionMatchesExpected, verifyWechatPaySignedBody } from '@shop/wechatpayment';
import { createPorts } from '@shop/providercore';
import { createWechatPayTestKeys, signedProviderHeaders } from '../../extensions/payment/wechat/test/TestKeys';
import { PgIdempotencyRepository } from '../../services/commerce/src/platform/database/PgIdempotencyRepository';
import { PgTransactionAccess } from '../../services/commerce/src/platform/database/PgTransactionAccess';
import { PgTransactionManager } from '../../services/commerce/src/platform/database/PgTransactionManager';

test('an idempotency key replay with a different canonical request is rejected', async () => {
  const client = {
    query: async (sql: string) => {
      if (sql.startsWith('select request_hash')) return { rows: [{ request_hash: '0'.repeat(64), state: 'started', response: null }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release: () => undefined,
  };
  const manager = new PgTransactionManager({ workload: () => ({ connect: async () => client }) } as never);
  const repository = new PgIdempotencyRepository(new PgTransactionAccess());
  const signal = new AbortController().signal;
  await assert.rejects(
    manager.write(
      {
        tenant: 'tenant:one',
        membership: 'membership:one',
        scope: 'mall:one',
        actor: 'principal:one',
        trace: 'trace:replay',
        operation: 'payment.refunds.request',
        deadline: Date.now() + 1000,
        signal,
      },
      (transaction) =>
        repository.claim(transaction, {
          scope: 'mall:one',
          actor: 'principal:one',
          operation: 'payment.refunds.request',
          key: 'same-key',
          requestHash: '1'.repeat(64),
        })
    ),
    /IDEMPOTENCY_CONFLICT/
  );
});

test('payment webhook rejects invalid signatures, stale timestamps and amount mismatch', async () => {
  const keys = await createWechatPayTestKeys();
  const body = '{"id":"payment-event"}';
  const headers = await signedProviderHeaders(keys, body);
  await assert.doesNotReject(verifyWechatPaySignedBody(keys.config, headers, body, { nowMs: 1_786_665_600_000 }));
  await assert.rejects(verifyWechatPaySignedBody(keys.config, headers, `${body} `, { nowMs: 1_786_665_600_000 }), (cause: unknown) => errorCode(cause) === 'WECHAT_PAY_SIGNATURE_INVALID');
  await assert.rejects(verifyWechatPaySignedBody(keys.config, headers, body, { nowMs: 1_786_666_000_001 }), (cause: unknown) => errorCode(cause) === 'WECHAT_PAY_SIGNATURE_TIMESTAMP_STALE');
  assert.throws(
    () => assertWechatPayTransactionMatchesExpected({ outTradeNo: 'SW202608140005', amount: { total: 2590 }, payerOpenid: 'member' } as never, { outTradeNo: 'SW202608140005', totalCents: 9999, payerOpenid: 'member' }),
    (cause: unknown) => errorCode(cause) === 'WECHAT_PAY_AMOUNT_MISMATCH'
  );
});

test('provider webhook verifies HMAC and a five-minute time window before normalization', async () => {
  const secret = 'provider-webhook-secret-material';
  const timestamp = '1786665600';
  const body = '{"kind":"order","state":"completed"}';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const webhook = createPorts({} as never, {}, undefined, { webhookSecret: secret }).webhook!;
  const context = {} as never;
  const request = { headers: { 'x-provider-timestamp': timestamp, 'x-provider-signature': signature }, body, receivedAt: '2026-08-14T00:00:00.000Z' };
  assert.equal(await webhook.verify(context, request), true);
  assert.equal(await webhook.verify(context, { ...request, body: `${body} ` }), false);
  assert.equal(await webhook.verify(context, { ...request, receivedAt: '2026-08-14T00:05:00.001Z' }), false);
});

function errorCode(cause: unknown): string | undefined {
  return cause !== null && typeof cause === 'object' ? (Reflect.get(cause, 'code') as string | undefined) : undefined;
}
