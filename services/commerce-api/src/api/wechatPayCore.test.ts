import { beforeAll, describe, expect, it } from 'vitest';
import { loadWechatPayConfig, WechatPayConfigurationError } from './wechatPayConfig';
import { createMerchantAuthorization, createMiniappPaymentParameters, merchantSignatureMessage, miniappSignatureMessage, verifyRsaSha256 } from './wechatPayCrypto';
import { createWechatPayDescription, mapWechatPayTradeState } from './wechatPayModels';
import { createWechatPayTestKeys, type WechatPayTestKeys } from './wechatPayTestSupport';

let keys: WechatPayTestKeys;

beforeAll(async () => {
  keys = await createWechatPayTestKeys();
});

describe('WeChat Pay configuration', () => {
  it('loads the complete server-only configuration', () => {
    const config = loadWechatPayConfig({
      WECHAT_MINIAPP_APP_ID: keys.config.appId,
      WECHAT_PAY_MCH_ID: keys.config.mchId,
      WECHAT_PAY_MERCHANT_SERIAL_NO: keys.config.merchantSerialNo,
      WECHAT_PAY_MERCHANT_PRIVATE_KEY: keys.config.merchantPrivateKeyPem.replace(/\n/g, '\\n'),
      WECHAT_PAY_API_V3_KEY: keys.config.apiV3Key,
      WECHAT_PAY_PLATFORM_PUBLIC_KEY: keys.config.platformPublicKeyPem,
      WECHAT_PAY_PLATFORM_KEY_ID: keys.config.platformKeyId,
      WECHAT_PAY_NOTIFY_URL: keys.config.notifyUrl,
    });
    expect(config).toMatchObject({ appId: keys.config.appId, mchId: keys.config.mchId });
    expect(config.merchantPrivateKeyPem).toContain('\n');
  });

  it('fails closed without a 32-byte APIv3 key', () => {
    expect(() =>
      loadWechatPayConfig({
        WECHAT_MINIAPP_APP_ID: keys.config.appId,
        WECHAT_PAY_MCH_ID: keys.config.mchId,
        WECHAT_PAY_MERCHANT_SERIAL_NO: keys.config.merchantSerialNo,
        WECHAT_PAY_MERCHANT_PRIVATE_KEY: keys.config.merchantPrivateKeyPem,
        WECHAT_PAY_API_V3_KEY: 'too-short',
        WECHAT_PAY_PLATFORM_PUBLIC_KEY: keys.config.platformPublicKeyPem,
        WECHAT_PAY_PLATFORM_KEY_ID: keys.config.platformKeyId,
        WECHAT_PAY_NOTIFY_URL: keys.config.notifyUrl,
      })
    ).toThrowError(expect.objectContaining<Partial<WechatPayConfigurationError>>({ code: 'WECHAT_PAY_API_V3_KEY_INVALID' }));
  });

  it('rejects non-public notification destinations', () => {
    expect(() =>
      loadWechatPayConfig({
        WECHAT_MINIAPP_APP_ID: keys.config.appId,
        WECHAT_PAY_MCH_ID: keys.config.mchId,
        WECHAT_PAY_MERCHANT_SERIAL_NO: keys.config.merchantSerialNo,
        WECHAT_PAY_MERCHANT_PRIVATE_KEY: keys.config.merchantPrivateKeyPem,
        WECHAT_PAY_API_V3_KEY: keys.config.apiV3Key,
        WECHAT_PAY_PLATFORM_PUBLIC_KEY: keys.config.platformPublicKeyPem,
        WECHAT_PAY_PLATFORM_KEY_ID: keys.config.platformKeyId,
        WECHAT_PAY_NOTIFY_URL: 'https://127.0.0.1/payment-notify',
      })
    ).toThrowError(expect.objectContaining({ code: 'WECHAT_PAY_NOTIFY_URL_NOT_PUBLIC' }));
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
    const payment = await createMiniappPaymentParameters(keys.config, 'wxPrepay1234567890', {
      nowMs: 1_786_665_600_000,
      nonce: 'miniappNonce1234',
    });
    expect(payment).toMatchObject({
      timeStamp: '1786665600',
      nonceStr: 'miniappNonce1234',
      package: 'prepay_id=wxPrepay1234567890',
      signType: 'RSA',
    });
    const message = miniappSignatureMessage(keys.config.appId, payment.timeStamp, payment.nonceStr, payment.package);
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
