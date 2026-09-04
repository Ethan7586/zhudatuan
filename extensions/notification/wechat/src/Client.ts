import type { DeliveryChannel, DeliveryRequest } from '@shop/contract';
import { Executor } from '@shop/kernel';
import type { WechatConfiguration } from './Config';
import { WECHAT_NOTIFICATION_POLICY } from './Manifest';
import { WechatTemplateCatalog } from './Template';

interface AccessToken { readonly value: string; readonly expiresAt: number }

export class WechatClient implements DeliveryChannel {
  readonly id = 'wechat' as const;
  readonly provider = 'wechat';
  readonly priority: number;
  private token: AccessToken | null = null;
  private loading: Promise<AccessToken> | null = null;
  private readonly executor = new Executor(WECHAT_NOTIFICATION_POLICY);
  private readonly templates: WechatTemplateCatalog;

  constructor(
    private readonly configuration: WechatConfiguration,
    private readonly secret: string,
    private readonly fetcher: typeof fetch = fetch
  ) {
    if (secret.length < 16) throw new Error('WECHAT_CREDENTIAL_INVALID');
    this.priority = configuration.priority;
    this.templates = new WechatTemplateCatalog(configuration.templates);
  }

  async send(request: DeliveryRequest) {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(request.recipient) || !request.idempotency.trim()) throw new Error('WECHAT_DELIVERY_REQUEST_INVALID');
    const template = this.templates.resolve(request);
    return this.executor.run((deadline) => this.deliver(request, template, deadline.signal), {
      mode: 'none', signal: request.signal, deadline: request.deadline,
    });
  }

  circuitState() {
    return this.executor.circuitState();
  }

  private async deliver(request: DeliveryRequest, template: ReturnType<WechatTemplateCatalog['resolve']>, signal: AbortSignal) {
    const token = await this.accessToken(signal);
    let response: Response;
    try {
      response = await this.fetcher(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token.value)}`, {
        method: 'POST', redirect: 'error', signal, headers: { accept: 'application/json', 'content-type': 'application/json',
          ...(request.requestId ? { 'x-request-id': trace(request.requestId) } : {}), ...(request.traceId ? { 'x-trace-id': trace(request.traceId) } : {}) },
        body: JSON.stringify({ touser: request.recipient, template_id: template.id,
          ...(this.configuration.page ? { page: this.configuration.page } : {}), miniprogram_state: this.configuration.state,
          lang: 'zh_CN', data: template.data }),
      });
    } catch (cause) {
      throw new Error('WECHAT_DELIVERY_OUTCOME_UNKNOWN', { cause });
    }
    if (!response.ok) throw new Error(response.status >= 500 ? 'WECHAT_DELIVERY_OUTCOME_UNKNOWN' : 'WECHAT_DELIVERY_REJECTED');
    const value = (await response.json()) as Readonly<Record<string, unknown>>;
    if (value.errcode !== 0 || (typeof value.msgid !== 'number' && typeof value.msgid !== 'string')) throw new Error('WECHAT_DELIVERY_REJECTED');
    return Object.freeze({ provider: this.provider, externalId: String(value.msgid) });
  }

  private async accessToken(signal: AbortSignal): Promise<AccessToken> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token;
    this.loading ??= this.loadToken(signal).finally(() => { this.loading = null; });
    this.token = await this.loading;
    return this.token;
  }

  private async loadToken(signal: AbortSignal): Promise<AccessToken> {
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', this.configuration.appId);
    url.searchParams.set('secret', this.secret);
    let response: Response;
    try {
      response = await this.fetcher(url, { headers: { accept: 'application/json' }, redirect: 'error', signal });
    } catch (cause) {
      throw new Error('WECHAT_TOKEN_UNAVAILABLE', { cause });
    }
    if (!response.ok) throw new Error('WECHAT_TOKEN_UNAVAILABLE');
    const value = (await response.json()) as Readonly<Record<string, unknown>>;
    if (typeof value.access_token !== 'string' || value.access_token.length < 16 || typeof value.expires_in !== 'number') throw new Error('WECHAT_TOKEN_REJECTED');
    return Object.freeze({ value: value.access_token, expiresAt: Date.now() + Math.max(60, value.expires_in - 120) * 1_000 });
  }
}

function trace(value: string): string {
  if (!/^[A-Za-z0-9:._-]{1,128}$/.test(value)) throw new Error('WECHAT_DELIVERY_TRACE_INVALID');
  return value;
}
