import type { DeliveryChannel } from '../../01_public_gongkai/DeliveryChannel';
import { HttpClient } from '../../../../foundation/http/HttpClient';

export interface WechatDeliveryConfiguration {
  readonly appId: string;
  readonly appSecret: string;
  readonly page?: string;
  readonly state: 'developer' | 'trial' | 'formal';
}

interface AccessToken { readonly value: string; readonly expiresAt: number }

export class WechatChannel implements DeliveryChannel {
  readonly id = 'wechat' as const;
  private readonly http: HttpClient;
  private token: AccessToken | null = null;
  private loading: Promise<AccessToken> | null = null;

  constructor(private readonly configuration: WechatDeliveryConfiguration, fetcher: typeof fetch = fetch) {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(configuration.appId) || configuration.appSecret.length < 16
      || !['developer', 'trial', 'formal'].includes(configuration.state) || configuration.page && !/^pages?\/[A-Za-z0-9/_-]{1,240}$/.test(configuration.page)) {
      throw new Error('WECHAT_DELIVERY_CONFIGURATION_INVALID');
    }
    this.http = new HttpClient(fetcher);
  }

  async send(request: Parameters<DeliveryChannel['send']>[0]) {
    if (!request.providerTemplate || !/^[A-Za-z0-9_-]{8,128}$/.test(request.recipient)) throw new Error('WECHAT_DELIVERY_REQUEST_INVALID');
    const token = await this.accessToken();
    const response = await this.http.send(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token.value)}`, {
      method: 'POST', redirect: 'error', headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ touser: request.recipient, template_id: request.providerTemplate,
        ...(this.configuration.page ? { page: this.configuration.page } : {}), miniprogram_state: this.configuration.state, lang: 'zh_CN',
        data: Object.fromEntries(Object.entries(request.variables).map(([name, value]) => [name, { value: wechatValue(value) }])) }),
    }, { mode: 'businesskeywrite' });
    if (!response.ok) throw new Error('WECHAT_DELIVERY_FAILED');
    const value = await response.json() as Readonly<Record<string, unknown>>;
    if (value.errcode !== 0 || typeof value.msgid !== 'number' && typeof value.msgid !== 'string') {
      throw new Error('WECHAT_DELIVERY_REJECTED');
    }
    return Object.freeze({ provider: 'wechat', externalId: String(value.msgid) });
  }

  private async accessToken(): Promise<AccessToken> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token;
    this.loading ??= this.loadToken().finally(() => { this.loading = null; });
    this.token = await this.loading; return this.token;
  }

  private async loadToken(): Promise<AccessToken> {
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token'); url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', this.configuration.appId); url.searchParams.set('secret', this.configuration.appSecret);
    const response = await this.http.send(url, { headers: { accept: 'application/json' }, redirect: 'error' }, { mode: 'read' });
    if (!response.ok) throw new Error('WECHAT_TOKEN_FAILED');
    const value = await response.json() as Readonly<Record<string, unknown>>;
    if (typeof value.access_token !== 'string' || value.access_token.length < 16 || typeof value.expires_in !== 'number') {
      throw new Error('WECHAT_TOKEN_REJECTED');
    }
    return Object.freeze({ value: value.access_token, expiresAt: Date.now() + Math.max(60, value.expires_in - 120) * 1_000 });
  }
}

function wechatValue(value: string | number | boolean): string {
  const normalized = String(value); if (normalized.length > 20) throw new Error('WECHAT_VARIABLE_TOO_LONG'); return normalized;
}
