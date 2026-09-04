import { beforeAll, describe, expect, it } from 'vitest';
import { applyWechatPayRefund, createJsapiPrepay, queryWechatPayRefund, queryWechatPayTransaction } from './Client';
import { merchantSignatureMessage, verifyRsaSha256 } from './Crypto';
import { WechatPayProtocolError } from './Models';
import { createWechatPayTestKeys, signedProviderHeaders, type WechatPayTestKeys } from '../test/TestKeys';

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
        appId: keys.appId,
        description: '智慧翼福利商城-有机纯牛奶',
        outTradeNo: 'SW202608140001',
        totalCents: 2590,
        payerOpenid: 'openidMember123456',
        expiresAt: '2026-08-14T10:30:00+08:00',
      },
      { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123', requestId: 'payment:one', traceId: 'trace:one' }
    );
    expect(result).toEqual({ prepayId: 'wxPrepay1234567890', providerRequestId: 'wechat-provider-request-test' });
    expect(capturedUrl).toBe('https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi');
    const body = String(capturedInit?.body);
    expect(JSON.parse(body)).toMatchObject({
      appid: keys.appId,
      mchid: keys.config.mchId,
      out_trade_no: 'SW202608140001',
      amount: { total: 2590, currency: 'CNY' },
      payer: { openid: 'openidMember123456' },
    });
    const requestHeaders = new Headers(capturedInit?.headers);
    expect(requestHeaders.get('wechatpay-serial')).toBe(keys.config.platformKeys[0]!.id);
    expect(requestHeaders.get('x-request-id')).toBe('payment:one');
    expect(requestHeaders.get('x-trace-id')).toBe('trace:one');
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
          appId: keys.appId,
          description: '智慧翼福利商城-有机纯牛奶',
          outTradeNo: 'SW202608140002',
          totalCents: 2590,
          payerOpenid: 'openidMember123456',
          expiresAt: '2026-08-14T10:30:00+08:00',
        },
        { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123' }
      )
    ).rejects.toMatchObject({ code: 'WECHAT_PAY_SIGNATURE_HEADERS_MISSING' });
  });

  it('verifies and parses a signed transaction query response', async () => {
    const responseBody = JSON.stringify({
      appid: keys.appId,
      mchid: keys.config.mchId,
      out_trade_no: 'SW202608140003',
      trade_type: 'JSAPI',
      trade_state: 'NOTPAY',
      trade_state_desc: '订单未支付',
      amount: { total: 100, currency: 'CNY' },
    });
    const fetcher: typeof fetch = async () => new Response(responseBody, { status: 200, headers: await signedProviderHeaders(keys, responseBody) });
    const result = await queryWechatPayTransaction(keys.config, keys.appId, 'SW202608140003', {
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
        appId: keys.appId,
        description: '智慧翼福利商城-办公笔记本',
        outTradeNo: 'SW202608140004',
        totalCents: 100,
        payerOpenid: 'openidMember123456',
        expiresAt: '2026-08-14T10:30:00+08:00',
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

  it('submits a stable refund identity and treats provider acceptance as processing', async () => {
    const responseBody = JSON.stringify(refundResponse('PROCESSING'));
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(responseBody, { status: 200, headers: await signedProviderHeaders(keys, responseBody) });
    };
    const result = await applyWechatPayRefund(
      keys.config,
      {
        outRefundNo: 'WR202608200001',
        transactionId: '420000000020260820000001',
        refundCents: 990,
        totalCents: 2590,
        reason: '  售后审核通过\n原路退款  ',
      },
      { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123' }
    );
    expect(capturedUrl).toBe('https://api.mch.weixin.qq.com/v3/refund/domestic/refunds');
    expect(capturedInit?.method).toBe('POST');
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      transaction_id: '420000000020260820000001',
      out_refund_no: 'WR202608200001',
      reason: '售后审核通过 原路退款',
      notify_url: keys.config.notifyUrl,
      amount: { refund: 990, total: 2590, currency: 'CNY' },
    });
    expect(result.refund).toMatchObject({ outRefundNo: 'WR202608200001', status: 'PROCESSING' });
  });

  it('queries a refund and recognizes SUCCESS only from signed matching evidence', async () => {
    const responseBody = JSON.stringify(refundResponse('SUCCESS'));
    let capturedUrl = '';
    const fetcher: typeof fetch = async (input) => {
      capturedUrl = String(input);
      return new Response(responseBody, { status: 200, headers: await signedProviderHeaders(keys, responseBody) });
    };
    const result = await queryWechatPayRefund(keys.config, 'WR202608200001', {
      fetcher,
      nowMs: NOW_MS,
      nonce: 'merchantNonce123',
    });
    expect(capturedUrl).toBe('https://api.mch.weixin.qq.com/v3/refund/domestic/refunds/WR202608200001');
    expect(result.refund).toMatchObject({ status: 'SUCCESS', successTime: '2026-08-20T11:30:00+08:00' });
  });

  it('bounds the refund reason by UTF-8 bytes instead of JavaScript characters', async () => {
    const responseBody = JSON.stringify(refundResponse('PROCESSING'));
    let capturedBody = '';
    const fetcher: typeof fetch = async (_input, init) => {
      capturedBody = String(init?.body);
      return new Response(responseBody, { status: 200, headers: await signedProviderHeaders(keys, responseBody) });
    };
    await applyWechatPayRefund(
      keys.config,
      {
        outRefundNo: 'WR202608200001',
        transactionId: '420000000020260820000001',
        refundCents: 990,
        totalCents: 2590,
        reason: '退'.repeat(40),
      },
      { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123' }
    );
    const reason = JSON.parse(capturedBody).reason as string;
    expect(reason).toBe('退'.repeat(26));
    expect(new TextEncoder().encode(reason).byteLength).toBeLessThanOrEqual(80);
  });

  it('rejects signed refund evidence whose amount differs from the request', async () => {
    const responseBody = JSON.stringify({ ...refundResponse('PROCESSING'), amount: { ...refundResponse('PROCESSING').amount, refund: 991 } });
    const fetcher: typeof fetch = async () => new Response(responseBody, { status: 200, headers: await signedProviderHeaders(keys, responseBody) });
    await expect(
      applyWechatPayRefund(
        keys.config,
        {
          outRefundNo: 'WR202608200001',
          transactionId: '420000000020260820000001',
          refundCents: 990,
          totalCents: 2590,
          reason: '原路退款',
        },
        { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123' }
      )
    ).rejects.toMatchObject({ code: 'WECHAT_PAY_REFUND_AMOUNT_MISMATCH' });
  });
});

function refundResponse(status: 'PROCESSING' | 'SUCCESS') {
  return {
    refund_id: '503000000020260820000001',
    out_refund_no: 'WR202608200001',
    transaction_id: '420000000020260820000001',
    out_trade_no: 'SW202608200001',
    status,
    ...(status === 'SUCCESS' ? { success_time: '2026-08-20T11:30:00+08:00' } : {}),
    amount: { total: 2590, refund: 990, payer_total: 2590, payer_refund: 990, currency: 'CNY' },
  };
}
