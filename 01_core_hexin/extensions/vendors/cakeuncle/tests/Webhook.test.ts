import { describe, expect, it } from 'vitest';
import type { ProviderCallContext } from '@shop/contract';
import { CakeuncleWebhookVerifier, deriveCakeuncleEventId } from '../Webhook';
import { signCakeuncle } from '../Signer';

const timestamp = '1700000000';
const secret = { channelNo: 'channel-test', channelKey: 'secret-test' };
const context: ProviderCallContext = { tenantId: 'tenant', requestId: 'request', traceId: 'trace', deadline: 1_700_000_005_000 };

describe('cakeuncle webhook authentication', () => {
  it('verifies the official channel timestamp signature and normalizes status', async () => {
    const body = JSON.stringify({ channel_no: secret.channelNo, timestamp,
      sign: signCakeuncle(secret.channelNo, secret.channelKey, timestamp), order_no: 'child-1', out_order_no: 'order-1', status: 2 });
    const request = { headers: {}, body, receivedAt: '2023-11-14T22:13:20.000Z' };
    const verifier = new CakeuncleWebhookVerifier(secret);
    await expect(verifier.verify(context, request)).resolves.toBe(true);
    expect(verifier.normalize(request)).toMatchObject({ eventType: 'order.status', authoritative: false,
      externalReference: 'order-1', state: 'completed' });
  });

  it('rejects stale signatures and derives replay keys without auth fields', async () => {
    const signed = signCakeuncle(secret.channelNo, secret.channelKey, timestamp);
    const first = JSON.stringify({ channel_no: secret.channelNo, timestamp, sign: signed, id: 'product-1', status: 1 });
    const second = JSON.stringify({ channel_no: secret.channelNo, timestamp: '1700000001', sign: '0'.repeat(32), id: 'product-1', status: 1 });
    const verifier = new CakeuncleWebhookVerifier(secret);
    await expect(verifier.verify(context, { headers: {}, body: first, receivedAt: '2023-11-14T23:13:20.000Z' })).resolves.toBe(false);
    expect(deriveCakeuncleEventId(first)).toBe(deriveCakeuncleEventId(second));
  });

  it('marks signed notifications non-authoritative because the official signature omits payload fields', async () => {
    const sign = signCakeuncle(secret.channelNo, secret.channelKey, timestamp);
    const original = { channel_no: secret.channelNo, timestamp, sign, out_order_no: 'order-1', status: 2 };
    const tampered = { ...original, status: 4 };
    const verifier = new CakeuncleWebhookVerifier(secret);
    const request = { headers: {}, body: JSON.stringify(tampered), receivedAt: '2023-11-14T22:13:20.000Z' };
    await expect(verifier.verify(context, request)).resolves.toBe(true);
    expect(verifier.normalize(request)).toMatchObject({ authoritative: false, state: 'cancelled_refunded' });
  });
});
