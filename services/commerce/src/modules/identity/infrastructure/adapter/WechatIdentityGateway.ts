import { createHash } from 'node:crypto';
import { isPrivateIpv4Host, WechatApplicationCatalog, type WechatScene } from '@shop/config/server';
import type { WechatIdentity, WechatIdentityResult } from '../../application/port/WechatIdentity';
import { HttpClient } from '../../../../foundation/http/HttpClient';

export interface WechatIdentitySecret {
  readonly scene: WechatScene;
  readonly appSecret: string;
  readonly authorizationCallbackUrl?: string;
}

export interface WechatIdentityConfiguration {
  readonly applications: readonly WechatIdentitySecret[];
}

interface IdentityApplication {
  readonly scene: WechatScene;
  readonly appId: string;
  readonly appSecret: string;
  readonly authorizationCallbackUrl?: string;
}

export class WechatIdentityGateway implements WechatIdentity {
  private readonly applications: ReadonlyMap<WechatScene, IdentityApplication>;
  private readonly http: HttpClient;

  constructor(catalog: WechatApplicationCatalog, configuration: WechatIdentityConfiguration, fetcher: typeof fetch = fetch) {
    if (Object.keys(configuration).sort().join(',') !== 'applications' || !Array.isArray(configuration.applications)
      || configuration.applications.length !== 2) invalid();
    const applications = configuration.applications.map((secret) => parseApplication(catalog, secret));
    if (new Set(applications.map((application) => application.scene)).size !== 2) invalid();
    this.applications = new Map(applications.map((application) => [application.scene, application]));
    this.http = new HttpClient(fetcher);
  }

  application(scene: WechatScene) {
    return Object.freeze({ applicationHash: digest(this.get(scene).appId) });
  }

  authorize(scene: 'jsapi', state: string): string {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(state)) throw new Error('WECHAT_OAUTH_STATE_INVALID');
    const application = this.get(scene);
    if (!application.authorizationCallbackUrl) invalid();
    const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
    url.searchParams.set('appid', application.appId);
    url.searchParams.set('redirect_uri', application.authorizationCallbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'snsapi_base');
    url.searchParams.set('state', state);
    url.hash = 'wechat_redirect';
    return url.toString();
  }

  async exchange(scene: WechatScene, code: string): Promise<WechatIdentityResult> {
    if (!/^[A-Za-z0-9_-]{6,256}$/.test(code)) throw new Error('WECHAT_CODE_INVALID');
    const application = this.get(scene);
    const url = scene === 'miniapp'
      ? new URL('https://api.weixin.qq.com/sns/jscode2session')
      : new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    url.searchParams.set('appid', application.appId);
    url.searchParams.set('secret', application.appSecret);
    if (scene === 'miniapp') url.searchParams.set('js_code', code);
    else url.searchParams.set('code', code);
    url.searchParams.set('grant_type', 'authorization_code');
    const response = await this.http.send(url, { headers: { accept: 'application/json' }, redirect: 'error' }, { mode: 'none' });
    if (!response.ok) throw new Error('WECHAT_CODE_EXCHANGE_FAILED');
    const value = await response.json() as Record<string, unknown>;
    if (value.errcode !== undefined && value.errcode !== 0) throw new Error('WECHAT_CODE_REJECTED');
    if (typeof value.openid !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value.openid)) throw new Error('WECHAT_IDENTITY_RESPONSE_INVALID');
    if (value.unionid !== undefined && (typeof value.unionid !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value.unionid))) {
      throw new Error('WECHAT_IDENTITY_RESPONSE_INVALID');
    }
    return Object.freeze({ subject: value.openid, ...(typeof value.unionid === 'string' ? { union: value.unionid } : {}) });
  }

  private get(scene: WechatScene): IdentityApplication {
    const application = this.applications.get(scene);
    if (!application) invalid();
    return application;
  }
}

function parseApplication(catalog: WechatApplicationCatalog, source: WechatIdentitySecret): IdentityApplication {
  const expected = source.scene === 'jsapi' ? 'appSecret,authorizationCallbackUrl,scene' : 'appSecret,scene';
  if (Object.keys(source).sort().join(',') !== expected || (source.scene !== 'miniapp' && source.scene !== 'jsapi')
    || typeof source.appSecret !== 'string' || source.appSecret.length < 16 || source.appSecret.length > 256) invalid();
  const callback = source.scene === 'jsapi' ? callbackUrl(source.authorizationCallbackUrl) : undefined;
  return Object.freeze({ scene: source.scene, appId: catalog.get(source.scene).appId, appSecret: source.appSecret,
    ...(callback === undefined ? {} : { authorizationCallbackUrl: callback }) });
}

function callbackUrl(value: string | undefined): string {
  if (typeof value !== 'string') invalid();
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/wechat/callback') invalid();
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || isPrivateIpv4Host(url.hostname)) invalid();
  return url.toString();
}

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function invalid(): never { throw new Error('WECHAT_IDENTITY_CONFIGURATION_INVALID'); }
