import { beforeAll, describe, expect, it } from 'vitest';
import { loadWechatPayConfig, resolveWechatPayNotifyUrl, WechatPayConfigurationError } from './Config';
import { createMerchantAuthorization, createMiniappPaymentParameters, merchantSignatureMessage, miniappSignatureMessage, verifyRsaSha256 } from './Crypto';
import { createWechatPayDescription, mapWechatPayTradeState } from './Models';
import { createWechatPayTestKeys, type WechatPayTestKeys } from '../test/TestKeys';

let keys: WechatPayTestKeys;

beforeAll(async () => {
  keys = await createWechatPayTestKeys();
});

describe('WeChat Pay configuration', () => {
  it('loads the complete server-only configuration', () => {
    const config = loadWechatPayConfig({
      mchId: keys.config.mchId,
      merchantSerialNo: keys.config.merchantSerialNo,
      merchantPrivateKeyPem: keys.config.merchantPrivateKeyPem.replace(/\n/g, '\\n'),
      apiV3Key: keys.config.apiV3Key,
      platformKeys: keys.config.platformKeys,
      notifyUrl: keys.config.notifyUrl,
    });
    expect(config).toMatchObject({ mchId: keys.config.mchId });
    expect(config.merchantPrivateKeyPem).toContain('\n');
  });

  it('fails closed without a 32-byte APIv3 key', () => {
    expect(() =>
      loadWechatPayConfig({
        mchId: keys.config.mchId,
        merchantSerialNo: keys.config.merchantSerialNo,
        merchantPrivateKeyPem: keys.config.merchantPrivateKeyPem,
        apiV3Key: 'too-short',
        platformKeys: keys.config.platformKeys,
        notifyUrl: keys.config.notifyUrl,
      })
    ).toThrowError(expect.objectContaining<Partial<WechatPayConfigurationError>>({ code: 'WECHAT_PAY_API_V3_KEY_INVALID' }));
  });

  it('rejects non-public notification destinations', () => {
    expect(() =>
      loadWechatPayConfig({
        mchId: keys.config.mchId,
        merchantSerialNo: keys.config.merchantSerialNo,
        merchantPrivateKeyPem: keys.config.merchantPrivateKeyPem,
        apiV3Key: keys.config.apiV3Key,
        platformKeys: keys.config.platformKeys,
        notifyUrl: 'https://127.0.0.1/api/v1/webhooks/wechat/payment',
      })
    ).toThrowError(expect.objectContaining({ code: 'WECHAT_PAY_NOTIFY_URL_NOT_PUBLIC' }));
  });

  it('rejects notification destinations with query parameters', () => {
    expect(() =>
      loadWechatPayConfig({
        mchId: keys.config.mchId,
        merchantSerialNo: keys.config.merchantSerialNo,
        merchantPrivateKeyPem: keys.config.merchantPrivateKeyPem,
        apiV3Key: keys.config.apiV3Key,
        platformKeys: keys.config.platformKeys,
        notifyUrl: `${keys.config.notifyUrl}?tenant=attacker-controlled`,
      })
    ).toThrowError(expect.objectContaining({ code: 'WECHAT_PAY_NOTIFY_URL_INVALID' }));
  });

  it('rejects a public URL that does not match the canonical webhook contract', () => {
    expect(() => loadWechatPayConfig({ ...keys.config, notifyUrl: 'https://hbbtzn.com/api/v1/payments/wechat/notify' }))
      .toThrowError(expect.objectContaining({ code: 'WECHAT_PAY_NOTIFY_URL_INVALID' }));
  });

  it('selects the callback owned by the payment scope without falling back to another node', () => {
    const config = loadWechatPayConfig({
      ...keys.config,
      notifyUrlsByScope: {
        'mall-zhudatuan': 'https://api.zhudatuan.com/api/v1/webhooks/wechat/payment',
        'mall:hongtai': 'https://api.hbbtzn.com/api/v1/webhooks/wechat/payment',
      },
    });
    expect(resolveWechatPayNotifyUrl(config, 'mall-zhudatuan')).toBe('https://api.zhudatuan.com/api/v1/webhooks/wechat/payment');
    expect(resolveWechatPayNotifyUrl(config, 'mall:hongtai')).toBe('https://api.hbbtzn.com/api/v1/webhooks/wechat/payment');
    expect(() => resolveWechatPayNotifyUrl(config, 'mall:unconfigured'))
      .toThrowError(expect.objectContaining({ code: 'WECHAT_PAY_NOTIFY_URL_SCOPE_MISSING' }));
  });
});

describe('WeChat Pay RSA signing', () => {
  it('creates an APIv3 authorization signature over the exact canonical message', async () => {
    const input = {
      method: 'POST',
      canonicalUrl: '/v3/pay/transactions/jsapi',
      body: '{"test":true}',
      timestamp: '1786665600',
      nonce: 'merchantNonce123',
    };
    const authorization = await createMerchantAuthorization(keys.config, input);
    const signature = authorization.match(/signature="([^"]+)"/)?.[1];
    expect(signature).toBeTruthy();
    await expect(verifyRsaSha256(keys.merchantPublicKeyPem, merchantSignatureMessage(input), signature ?? '')).resolves.toBe(true);
  });

  it('creates parameters accepted directly by wx.requestPayment', async () => {
    const payment = await createMiniappPaymentParameters(keys.config, keys.appId, 'wxPrepay1234567890', {
      nowMs: 1_786_665_600_000,
      nonce: 'miniappNonce1234',
    });
    expect(payment).toMatchObject({
      timeStamp: '1786665600',
      nonceStr: 'miniappNonce1234',
      package: 'prepay_id=wxPrepay1234567890',
      signType: 'RSA',
    });
    const message = miniappSignatureMessage(keys.appId, payment.timeStamp, payment.nonceStr, payment.package);
    await expect(verifyRsaSha256(keys.merchantPublicKeyPem, message, payment.paySign)).resolves.toBe(true);
  });
});

describe('WeChat Pay pure helpers', () => {
  it('builds truthful bounded descriptions from immutable item names', () => {
    const description = createWechatPayDescription(['有机纯牛奶', '办公笔记本', '重复不会出现', '重复不会出现']);
    expect(description).toBe('智慧翼福利商城-有机纯牛奶、办公笔记本等3种商品');
    expect(Array.from(description).length).toBeLessThanOrEqual(127);
  });

  it('maps every provider state without treating a frontend success as payment', () => {
    expect(mapWechatPayTradeState('SUCCESS')).toBe('paid');
    expect(mapWechatPayTradeState('USERPAYING')).toBe('pending');
    expect(mapWechatPayTradeState('PAYERROR')).toBe('failed');
    expect(mapWechatPayTradeState('REFUND')).toBe('refunded');
  });
});
