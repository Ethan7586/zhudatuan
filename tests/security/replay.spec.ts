import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { assertWechatPayTransactionMatchesExpected, verifyWechatPaySignedBody } from '@shop/wechatpayment';
import { createPorts } from '@shop/providercore';
import { createWechatPayTestKeys, signedProviderHeaders } from '../../extensions/payment/wechat/test/TestKeys';
import { claimPaymentRequest } from '../../services/commerce/src/modules/payment/PaymentOperationSupport';

test('an idempotency key replay with a different canonical request is rejected', async () => {
  let calls = 0;
  const database = {
    query: async () => {
      calls += 1;
      return calls === 1 ? { rows: [], rowCount: 1 } : { rows: [{ request_hash: '0'.repeat(64), state: 'started', response: null }], rowCount: 1 };
    },
  };
  await assert.rejects(
    claimPaymentRequest(
      database as never,
      {
        type: 'payment.refunds.request',
        input: { path: {}, query: {}, headers: {}, body: { payment: 'payment:one', amountMinor: 100 }, rawBody: '', idempotency: 'same-key', deadline: Date.now() + 1000, signal: new AbortController().signal },
        security: { kind: 'anonymous', channel: 'system', target: null, trace: 'trace:replay' },
      },
      'principal:one',
      'mall:one'
    ),
    /IDEMPOTENCY_KEY_REUSED/
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
