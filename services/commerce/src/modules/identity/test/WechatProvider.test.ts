import { describe, expect, it, vi } from 'vitest';
import { ProviderInstance } from '../domain/model/ProviderInstance';
import { WechatProvider } from '../infrastructure/adapter/wechat/WechatProvider';

describe('WechatProvider', () => {
  it('uses Miniapp code exchange and keeps both OpenId and UnionId mappings without exposing the AppSecret', async () => {
    const send = vi.fn(async (_url: string | URL) => new Response(JSON.stringify({ openid: 'openid_12345678', unionid: 'unionid_12345678', session_key: 'never-persist' }), { status: 200 }));
    const credentials = vi.fn(async () => ({ clientid: 'wx1234567890abcdef', secret: 'secret-value-from-store', tenant: 'tenant:one', issuer: null }));
    const provider = new WechatProvider({ credentials, send, json: (response: Response) => response.json() } as never);

    const started = await provider.start({ instance: instance(['miniapp']), state: 'state-value', nonce: 'nonce-value', challenge: 'c'.repeat(43) });
    const subject = await provider.callback({
      instance: instance(['miniapp']),
      code: 'wx-login-code',
      state: 'state-value',
      noncehash: Buffer.alloc(32),
      verifier: 'v'.repeat(48),
      signal: new AbortController().signal,
      deadline: Date.now() + 1_000,
    });

    expect(started.location).toContain('method=wx.login');
    const target = send.mock.calls[0]?.[0];
    if (!(target instanceof URL)) throw new Error('WECHAT_REQUEST_URL_MISSING');
    expect(target.origin + target.pathname).toBe('https://api.weixin.qq.com/sns/jscode2session');
    expect(target.searchParams.get('js_code')).toBe('wx-login-code');
    expect(target.searchParams.get('secret')).toBe('secret-value-from-store');
    expect(credentials).toHaveBeenCalledWith('secret/identity/wechat');
    expect(subject).toMatchObject({ subject: 'unionid_12345678', claims: { openid: 'openid_12345678', unionid: 'unionid_12345678' } });
    expect(JSON.stringify(subject)).not.toContain('secret-value-from-store');
    expect(JSON.stringify(subject)).not.toContain('never-persist');
  });

  it('keeps JSAPI authorization and rejects provider error payloads through the domain error contract', async () => {
    const send = vi.fn(async (_url: string | URL) => new Response(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }), { status: 200 }));
    const provider = new WechatProvider({
      credentials: vi.fn(async () => ({ clientid: 'wx1234567890abcdef', secret: 'secret-value-from-store', tenant: 'tenant:one', issuer: null })),
      send,
      json: (response: Response) => response.json(),
    } as never);
    const started = await provider.start({ instance: instance(['jsapi']), state: 'state-value', nonce: 'nonce-value', challenge: 'c'.repeat(43) });
    expect(started.location).toContain('open.weixin.qq.com/connect/oauth2/authorize');
    await expect(provider.callback({ instance: instance(['jsapi']), code: 'bad-code', state: 'state-value', noncehash: Buffer.alloc(32), verifier: 'v'.repeat(48) })).rejects.toMatchObject({ code: 'FEDERATION_CALLBACK_REJECTED' });
  });
});

function instance(scopes: readonly string[]): ProviderInstance {
  return new ProviderInstance({
    id: '00000000-0000-0000-0000-000000000001',
    type: 'wechat',
    tenantid: '00000000-0000-0000-0000-000000000002',
    issuer: null,
    clientid: 'wx1234567890abcdef',
    secretref: 'secret/identity/wechat',
    status: 'enabled',
    redirecturi: 'https://passport.fufu.wang/api/v1/identity/federations/callback',
    scopes,
    version: 1,
    createdat: '2026-09-04T00:00:00.000Z',
    updatedat: '2026-09-04T00:00:00.000Z',
  });
}
