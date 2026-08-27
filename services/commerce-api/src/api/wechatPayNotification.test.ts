import { beforeAll, describe, expect, it } from 'vitest';
import { sha256Hex } from './wechatPayCrypto';
import { assertWechatPayTransactionMatchesExpected, verifyAndDecryptWechatPayNotification } from './wechatPayNotification';
import { createWechatPayTestKeys, encryptNotificationResource, signedProviderHeaders, type WechatPayTestKeys } from './wechatPayTestSupport';

const TIMESTAMP = '1786665600';
const NOW_MS = 1_786_665_600_000;
let keys: WechatPayTestKeys;

beforeAll(async () => {
  keys = await createWechatPayTestKeys();
});

describe('WeChat Pay notification verification', () => {
  it('verifies, decrypts and minimizes an authentic payment notification', async () => {
    const body = await paymentNotificationBody();
    const headers = await signedProviderHeaders(keys, body, TIMESTAMP);
    const result = await verifyAndDecryptWechatPayNotification(keys.config, { headers, body }, { nowMs: NOW_MS });
    expect(result).toMatchObject({
      notificationId: 'EV-20260814-0001',
      eventType: 'TRANSACTION.SUCCESS',
      payerOpenidHash: await sha256Hex('openidMember123456'),
      summary: {
        transactionId: '420000000020260814000001',
        outTradeNo: 'SW202608140005',
        totalCents: 2590,
        currency: 'CNY',
      },
    });
    expect(result.summary).not.toHaveProperty('payerOpenid');
    expect(() =>
      assertWechatPayTransactionMatchesExpected(result.transaction, {
        outTradeNo: 'SW202608140005',
        totalCents: 2590,
        payerOpenid: 'openidMember123456',
      })
    ).not.toThrow();
  });

  it('rejects body tampering before decryption', async () => {
    const body = await paymentNotificationBody();
    const headers = await signedProviderHeaders(keys, body, TIMESTAMP);
    await expect(verifyAndDecryptWechatPayNotification(keys.config, { headers, body: `${body} ` }, { nowMs: NOW_MS })).rejects.toMatchObject({ code: 'WECHAT_PAY_SIGNATURE_INVALID' });
  });

  it('rejects stale signed notifications to limit replay', async () => {
    const body = await paymentNotificationBody();
    const headers = await signedProviderHeaders(keys, body, '1786665000');
    await expect(verifyAndDecryptWechatPayNotification(keys.config, { headers, body }, { nowMs: NOW_MS })).rejects.toMatchObject({ code: 'WECHAT_PAY_SIGNATURE_TIMESTAMP_STALE' });
  });

  it('rejects a valid provider payment that does not match the recorded attempt', async () => {
    const body = await paymentNotificationBody();
    const headers = await signedProviderHeaders(keys, body, TIMESTAMP);
    const result = await verifyAndDecryptWechatPayNotification(keys.config, { headers, body }, { nowMs: NOW_MS });
    expect(() =>
      assertWechatPayTransactionMatchesExpected(result.transaction, {
        outTradeNo: 'SW202608140005',
        totalCents: 9999,
        payerOpenid: 'openidMember123456',
      })
    ).toThrowError(expect.objectContaining({ code: 'WECHAT_PAY_AMOUNT_MISMATCH' }));
  });
});

async function paymentNotificationBody(): Promise<string> {
  const resource = await encryptNotificationResource(keys.config.apiV3Key, {
    appid: keys.config.appId,
    mchid: keys.config.mchId,
    out_trade_no: 'SW202608140005',
    transaction_id: '420000000020260814000001',
    trade_type: 'JSAPI',
    trade_state: 'SUCCESS',
    trade_state_desc: '支付成功',
    success_time: '2026-08-14T10:00:00+08:00',
    payer: { openid: 'openidMember123456' },
    amount: { total: 2590, payer_total: 2590, currency: 'CNY', payer_currency: 'CNY' },
  });
  return JSON.stringify({
    id: 'EV-20260814-0001',
    create_time: '2026-08-14T10:00:01+08:00',
    event_type: 'TRANSACTION.SUCCESS',
    resource_type: 'encrypt-resource',
    summary: '支付成功',
    resource: { original_type: 'transaction', algorithm: 'AEAD_AES_256_GCM', ...resource },
  });
}
