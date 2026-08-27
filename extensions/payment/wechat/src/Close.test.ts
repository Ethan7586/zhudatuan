import { beforeAll, describe, expect, it } from 'vitest';
import { closeWechatPayTransaction } from './Close';
import { merchantSignatureMessage, verifyRsaSha256 } from './Crypto';
import { createWechatPayTestKeys, signedProviderHeaders, type WechatPayTestKeys } from '../test/TestKeys';

const NOW_MS = 1_786_665_600_000;
let keys: WechatPayTestKeys;

beforeAll(async () => {
  keys = await createWechatPayTestKeys();
});

describe('WeChat Pay close transaction', () => {
  it('signs the official close request and verifies the empty 204 response', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(null, {
        status: 204,
        headers: await signedProviderHeaders(keys, ''),
      });
    };
    const result = await closeWechatPayTransaction(keys.config, 'SW202608200099', { fetcher, nowMs: NOW_MS, nonce: 'merchantNonce123' });
    expect(result.providerRequestId).toBe('wechat-provider-request-test');
    const canonicalUrl = '/v3/pay/transactions/out-trade-no/SW202608200099/close';
    expect(capturedUrl).toBe(`https://api.mch.weixin.qq.com${canonicalUrl}`);
    const body = String(capturedInit?.body);
    expect(JSON.parse(body)).toEqual({ mchid: keys.config.mchId });
    const authorization = new Headers(capturedInit?.headers).get('authorization') ?? '';
    const signature = authorization.match(/signature="([^"]+)"/)?.[1] ?? '';
    const timestamp = authorization.match(/timestamp="([^"]+)"/)?.[1] ?? '';
    const nonce = authorization.match(/nonce_str="([^"]+)"/)?.[1] ?? '';
    await expect(verifyRsaSha256(keys.merchantPublicKeyPem, merchantSignatureMessage({ method: 'POST', canonicalUrl, timestamp, nonce, body }), signature)).resolves.toBe(true);
  });

  it('never trusts an unsigned 204 as proof that close was accepted', async () => {
    const fetcher: typeof fetch = async () => new Response(null, { status: 204 });
    await expect(
      closeWechatPayTransaction(keys.config, 'SW202608200100', {
        fetcher,
        nowMs: NOW_MS,
        nonce: 'merchantNonce123',
      })
    ).rejects.toMatchObject({ code: 'WECHAT_PAY_SIGNATURE_HEADERS_MISSING' });
  });
});
