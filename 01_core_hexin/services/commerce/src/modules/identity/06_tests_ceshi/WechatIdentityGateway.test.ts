import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { WechatApplicationCatalog } from '@shop/config/server';
import { WechatIdentityGateway } from '../04_adapters_shixian/providers_waibu/WechatIdentityGateway';

const applications = WechatApplicationCatalog.parse({ applications: [
  { scene: 'miniapp', appId: 'wx4df4137881a1d2bc' },
  { scene: 'jsapi', appId: 'wx4df4137881a1d2bd' },
] });
const configuration = { applications: [
  { scene: 'miniapp' as const, appSecret: 'miniapp-secret-value-2026' },
  { scene: 'jsapi' as const, appSecret: 'official-secret-value-2026', authorizationCallbackUrl: 'https://auth.example.com/wechat/callback' },
] };

describe('WeChat application-scoped identity gateway', () => {
  it('builds an Official Account OAuth URL without duplicating the AppID configuration', () => {
    const gateway = new WechatIdentityGateway(applications, configuration, async () => new Response());
    const url = new URL(gateway.authorize('jsapi', 'a'.repeat(32)));
    expect(url.origin).toBe('https://open.weixin.qq.com');
    expect(url.searchParams.get('appid')).toBe(applications.get('jsapi').appId);
    expect(url.searchParams.get('scope')).toBe('snsapi_base');
    expect(url.searchParams.get('redirect_uri')).toBe('https://auth.example.com/wechat/callback');
    expect(url.hash).toBe('#wechat_redirect');
  });

  it('uses the scene-specific exchange endpoint and returns only identity evidence', async () => {
    const observed: URL[] = [];
    const fetcher: typeof fetch = async (input) => {
      observed.push(new URL(String(input)));
      return new Response(JSON.stringify({ openid: 'openidMember123456', unionid: 'unionMember1234567' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    };
    const gateway = new WechatIdentityGateway(applications, configuration, fetcher);
    await expect(gateway.exchange('miniapp', 'miniappCode123')).resolves.toEqual({ subject: 'openidMember123456', union: 'unionMember1234567' });
    await expect(gateway.exchange('jsapi', 'officialCode123')).resolves.toEqual({ subject: 'openidMember123456', union: 'unionMember1234567' });
    expect(observed.map((url) => url.pathname)).toEqual(['/sns/jscode2session', '/sns/oauth2/access_token']);
    expect(observed[0]?.searchParams.get('appid')).toBe(applications.get('miniapp').appId);
    expect(observed[1]?.searchParams.get('appid')).toBe(applications.get('jsapi').appId);
  });

  it('caches the official-account token and ticket while signing the exact page URL', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/cgi-bin/token') {
        return new Response(JSON.stringify({ access_token: 'official-access-token', expires_in: 7200 }));
      }
      return new Response(JSON.stringify({ errcode: 0, ticket: 'official-jsapi-ticket', expires_in: 7200 }));
    });
    const gateway = new WechatIdentityGateway(applications, configuration, fetcher);

    const signed = await gateway.jsSdkConfiguration('https://fufuwang.com.cn/?from=wechat#/address');
    await gateway.jsSdkConfiguration('https://fufuwang.com.cn/?from=wechat#/address');

    expect(signed.appId).toBe(applications.get('jsapi').appId);
    expect(signed.jsApiList).toEqual(['openAddress']);
    expect(signed.signature).toBe(createHash('sha1').update(
      `jsapi_ticket=official-jsapi-ticket&noncestr=${signed.nonceStr}&timestamp=${signed.timestamp}&url=https://fufuwang.com.cn/?from=wechat`,
    ).digest('hex'));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetcher.mock.calls[1]?.[0])).searchParams.get('type')).toBe('jsapi');
  });

  it.each([
    'http://auth.example.com/wechat/callback',
    'https://localhost/wechat/callback',
    'https://127.0.0.1/wechat/callback',
    'https://192.168.1.20/wechat/callback',
    'https://auth.example.com/',
    'https://auth.example.com/callback',
    'https://auth.example.com/wechat/callback?target=evil',
  ])('rejects a non-public or ambiguous OAuth callback URL: %s', (authorizationCallbackUrl) => {
    expect(() => new WechatIdentityGateway(applications, { applications: [
      configuration.applications[0]!,
      { ...configuration.applications[1]!, authorizationCallbackUrl },
    ] }, async () => new Response())).toThrow('WECHAT_IDENTITY_CONFIGURATION_INVALID');
  });
});
