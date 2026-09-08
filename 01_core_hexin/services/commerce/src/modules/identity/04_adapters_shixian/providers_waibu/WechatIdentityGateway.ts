import { createHash, randomBytes } from 'node:crypto';
import { isPrivateIpv4Host, WechatApplicationCatalog, type WechatScene } from '@shop/config/server';
import type { WechatIdentity, WechatIdentityResult, WechatJsSdkConfiguration } from '../../01_public_gongkai/ports_jiekou/WechatIdentity';
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
  private accessTokenCache?: CachedWechatValue;
  private jsApiTicketCache?: CachedWechatValue;
  private accessTokenRequest: Promise<CachedWechatValue> | undefined;
  private jsApiTicketRequest: Promise<CachedWechatValue> | undefined;

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

  async jsSdkConfiguration(value: string): Promise<WechatJsSdkConfiguration> {
    const url = jsSdkUrl(value);
    const application = this.get('jsapi');
    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr = randomBytes(16).toString('hex');
    const ticket = await this.jsApiTicket(application);
    const source = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
    return Object.freeze({
      appId: application.appId,
      timestamp,
      nonceStr,
      signature: createHash('sha1').update(source).digest('hex'),
      jsApiList: Object.freeze(['openAddress'] as const),
    });
  }

  private async jsApiTicket(application: IdentityApplication): Promise<string> {
    if (fresh(this.jsApiTicketCache)) return this.jsApiTicketCache.value;
    this.jsApiTicketRequest ??= this.fetchJsApiTicket(application).finally(() => { this.jsApiTicketRequest = undefined; });
    this.jsApiTicketCache = await this.jsApiTicketRequest;
    return this.jsApiTicketCache.value;
  }

  private async accessToken(application: IdentityApplication): Promise<string> {
    if (fresh(this.accessTokenCache)) return this.accessTokenCache.value;
    this.accessTokenRequest ??= this.fetchAccessToken(application).finally(() => { this.accessTokenRequest = undefined; });
    this.accessTokenCache = await this.accessTokenRequest;
    return this.accessTokenCache.value;
  }

  private async fetchAccessToken(application: IdentityApplication): Promise<CachedWechatValue> {
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', application.appId);
    url.searchParams.set('secret', application.appSecret);
    const value = await this.wechatJson(url);
    if (typeof value.access_token !== 'string' || value.access_token.length < 8) throw new Error('WECHAT_IDENTITY_RESPONSE_INVALID');
    return cacheValue(value.access_token, value.expires_in);
  }

  private async fetchJsApiTicket(application: IdentityApplication): Promise<CachedWechatValue> {
    const url = new URL('https://api.weixin.qq.com/cgi-bin/ticket/getticket');
    url.searchParams.set('access_token', await this.accessToken(application));
    url.searchParams.set('type', 'jsapi');
    const value = await this.wechatJson(url);
    if (value.errcode !== 0 || typeof value.ticket !== 'string' || value.ticket.length < 8) {
      throw new Error('WECHAT_IDENTITY_RESPONSE_INVALID');
    }
    return cacheValue(value.ticket, value.expires_in);
  }

  private async wechatJson(url: URL): Promise<Record<string, unknown>> {
    const response = await this.http.send(url, { headers: { accept: 'application/json' }, redirect: 'error' }, { mode: 'none' });
    if (!response.ok) throw new Error('WECHAT_CODE_EXCHANGE_FAILED');
    return response.json() as Promise<Record<string, unknown>>;
  }

  private get(scene: WechatScene): IdentityApplication {
    const application = this.applications.get(scene);
    if (!application) invalid();
    return application;
  }
}

interface CachedWechatValue {
  readonly value: string;
  readonly expiresAt: number;
}

function fresh(value: CachedWechatValue | undefined): value is CachedWechatValue {
  return value !== undefined && value.expiresAt > Date.now();
}

function cacheValue(value: string, expiresIn: unknown): CachedWechatValue {
  const seconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 7200;
  return Object.freeze({ value, expiresAt: Date.now() + Math.max(60, seconds - 300) * 1000 });
}

function jsSdkUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('WECHAT_AUTHORIZATION_URL_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('WECHAT_AUTHORIZATION_URL_INVALID');
  url.hash = '';
  return url.toString();
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
