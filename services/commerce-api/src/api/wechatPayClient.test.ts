import { beforeAll, describe, expect, it } from 'vitest';
import { createJsapiPrepay, queryWechatPayTransaction } from './wechatPayClient';
import { merchantSignatureMessage, verifyRsaSha256 } from './wechatPayCrypto';
import { WechatPayProtocolError } from './wechatPayModels';
import { createWechatPayTestKeys, signedProviderHeaders, type WechatPayTestKeys } from './wechatPayTestSupport';

const NOW_MS = 1_786_665_600_000;
let keys: WechatPayTestKeys;

beforeAll(async () => {
  keys = await createWechatPayTestKeys();
});

describe('WeChat Pay APIv3 client', () => {
  it('signs a JSAPI prepay request and verifies the signed provider response', async () => {
    const responseBody = JSON.stringify({ prepay_id: 'wxPrepay1234567890' });
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(responseBody, { status: 200, headers: await signedProviderHeaders(keys, responseBody) });
    };
    const result = await createJsapiPrepay(
      keys.config,
      {
        description: '智慧翼福利商城-有机纯牛奶',
        outTradeNo: 'SW202608140001',
        totalCents: 2590,
        payerOpenid: 'openidMember123456',
      },
      { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123' }
    );
    expect(result).toEqual({ prepayId: 'wxPrepay1234567890', providerRequestId: 'wechat-provider-request-test' });
    expect(capturedUrl).toBe('https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi');
    const body = String(capturedInit?.body);
    expect(JSON.parse(body)).toMatchObject({
      appid: keys.config.appId,
      mchid: keys.config.mchId,
      out_trade_no: 'SW202608140001',
      amount: { total: 2590, currency: 'CNY' },
      payer: { openid: 'openidMember123456' },
    });
    const requestHeaders = new Headers(capturedInit?.headers);
    expect(requestHeaders.get('wechatpay-serial')).toBe(keys.config.platformKeyId);
    const authorization = requestHeaders.get('authorization') ?? '';
    const signature = authorization.match(/signature="([^"]+)"/)?.[1] ?? '';
    const timestamp = authorization.match(/timestamp="([^"]+)"/)?.[1] ?? '';
    const nonce = authorization.match(/nonce_str="([^"]+)"/)?.[1] ?? '';
    const message = merchantSignatureMessage({
      method: 'POST',
      canonicalUrl: '/v3/pay/transactions/jsapi',
      timestamp,
      nonce,
      body,
    });
    await expect(verifyRsaSha256(keys.merchantPublicKeyPem, message, signature)).resolves.toBe(true);
  });

  it('rejects an unsigned provider success response', async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({ prepay_id: 'wxPrepay1234567890' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await expect(
      createJsapiPrepay(
        keys.config,
        {
          description: '智慧翼福利商城-有机纯牛奶',
          outTradeNo: 'SW202608140002',
          totalCents: 2590,
          payerOpenid: 'openidMember123456',
        },
        { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123' }
      )
    ).rejects.toMatchObject({ code: 'WECHAT_PAY_SIGNATURE_HEADERS_MISSING' });
  });

  it('verifies and parses a signed transaction query response', async () => {
    const responseBody = JSON.stringify({
      appid: keys.config.appId,
      mchid: keys.config.mchId,
      out_trade_no: 'SW202608140003',
      trade_type: 'JSAPI',
      trade_state: 'NOTPAY',
      trade_state_desc: '订单未支付',
      amount: { total: 100, currency: 'CNY' },
    });
    const fetcher: typeof fetch = async () => new Response(responseBody, { status: 200, headers: await signedProviderHeaders(keys, responseBody) });
    const result = await queryWechatPayTransaction(keys.config, 'SW202608140003', {
      fetcher,
      nowMs: NOW_MS,
      nonce: 'merchantNonce123',
    });
    expect(result.transaction).toMatchObject({ outTradeNo: 'SW202608140003', tradeState: 'NOTPAY' });
  });

  it('keeps signed provider errors structured and retry-aware', async () => {
    const responseBody = JSON.stringify({ code: 'SYSTEM_ERROR', message: 'internal provider detail' });
    const fetcher: typeof fetch = async () => new Response(responseBody, { status: 503, headers: await signedProviderHeaders(keys, responseBody) });
    const promise = createJsapiPrepay(
      keys.config,
      {
        description: '智慧翼福利商城-办公笔记本',
        outTradeNo: 'SW202608140004',
        totalCents: 100,
        payerOpenid: 'openidMember123456',
      },
      { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123' }
    );
    await expect(promise).rejects.toEqual(
      expect.objectContaining<Partial<WechatPayProtocolError>>({
        code: 'WECHAT_PAY_PROVIDER_SYSTEM_ERROR',
        retryable: true,
        providerRequestId: 'wechat-provider-request-test',
      })
    );
  });
});
