import { beforeAll, describe, expect, it } from 'vitest';
import { sha256Hex } from './Crypto';
import { assertWechatPayTransactionMatchesExpected, readWechatPayNotificationKind, verifyAndDecryptWechatPayNotification, verifyAndDecryptWechatRefundNotification } from './Notification';
import { createWechatPayTestKeys, encryptNotificationResource, signedProviderHeaders, type WechatPayTestKeys } from '../test/TestKeys';

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

  it('verifies the official refund callback shape and minimizes its evidence', async () => {
    const body = await refundNotificationBody('REFUND.SUCCESS', 'SUCCESS');
    const headers = await signedProviderHeaders(keys, body, TIMESTAMP);
    expect(readWechatPayNotificationKind(body)).toBe('refund');
    const result = await verifyAndDecryptWechatRefundNotification(keys.config, { headers, body }, { nowMs: NOW_MS });
    expect(result).toMatchObject({
      notificationId: 'EV-20260820-REFUND-0001',
      eventType: 'REFUND.SUCCESS',
      mchId: keys.config.mchId,
      summary: {
        refundId: '503000000020260820000001',
        outRefundNo: 'WR202608200001',
        transactionId: '420000000020260820000001',
        outTradeNo: 'SW202608200001',
        refundStatus: 'SUCCESS',
        refundCents: 990,
        totalCents: 2590,
        payerRefundCents: 990,
        payerTotalCents: 2590,
      },
    });
    expect(result.summary).not.toHaveProperty('userReceivedAccount');
  });

  it('rejects a signed refund callback whose event and decrypted status disagree', async () => {
    const body = await refundNotificationBody('REFUND.CLOSED', 'SUCCESS');
    const headers = await signedProviderHeaders(keys, body, TIMESTAMP);
    await expect(verifyAndDecryptWechatRefundNotification(keys.config, { headers, body }, { nowMs: NOW_MS })).rejects.toMatchObject({
      code: 'WECHAT_PAY_REFUND_NOTIFICATION_STATUS_MISMATCH',
    });
  });

  it('fails closed when Wechatpay-Serial is not the configured public KeyID', async () => {
    const body = await refundNotificationBody('REFUND.SUCCESS', 'SUCCESS');
    const headers = await signedProviderHeaders(keys, body, TIMESTAMP);
    headers.set('wechatpay-serial', 'PUB_KEY_ID_UNKNOWN_ROTATION');
    await expect(verifyAndDecryptWechatRefundNotification(keys.config, { headers, body }, { nowMs: NOW_MS })).rejects.toMatchObject({
      code: 'WECHAT_PAY_PLATFORM_KEY_ID_UNKNOWN',
    });
  });

  it('accepts a signed callback from an inactive retained key during rotation', async () => {
    const body = await paymentNotificationBody();
    const headers = await signedProviderHeaders(keys, body, TIMESTAMP);
    const retainedId = 'PUB_KEY_ID_RETAINED_PLATFORM_2026';
    headers.set('wechatpay-serial', retainedId);
    const rotated = { ...keys.config, platformKeys: [{ id: retainedId, publicKeyPem: keys.config.platformKeys[0]!.publicKeyPem, active: false }, keys.config.platformKeys[0]!] };
    await expect(verifyAndDecryptWechatPayNotification(rotated, { headers, body }, { nowMs: NOW_MS })).resolves.toMatchObject({ notificationId: 'EV-20260814-0001' });
  });
});

async function paymentNotificationBody(): Promise<string> {
  const resource = await encryptNotificationResource(keys.config.apiV3Key, {
    appid: keys.appId,
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

async function refundNotificationBody(eventType: 'REFUND.SUCCESS' | 'REFUND.ABNORMAL' | 'REFUND.CLOSED', refundStatus: 'SUCCESS' | 'ABNORMAL' | 'CLOSED'): Promise<string> {
  const resource = await encryptNotificationResource(
    keys.config.apiV3Key,
    {
      mchid: keys.config.mchId,
      transaction_id: '420000000020260820000001',
      out_trade_no: 'SW202608200001',
      refund_id: '503000000020260820000001',
      out_refund_no: 'WR202608200001',
      refund_status: refundStatus,
      ...(refundStatus === 'SUCCESS' ? { success_time: '2026-08-20T11:30:00+08:00' } : {}),
      user_received_account: '支付用户零钱',
      amount: { total: 2590, refund: 990, payer_total: 2590, payer_refund: 990 },
    },
    '0123456789ab',
    'refund'
  );
  return JSON.stringify({
    id: 'EV-20260820-REFUND-0001',
    create_time: '2026-08-20T11:30:01+08:00',
    event_type: eventType,
    resource_type: 'encrypt-resource',
    summary: '退款状态变化',
    resource: { original_type: 'refund', algorithm: 'AEAD_AES_256_GCM', ...resource },
  });
}
