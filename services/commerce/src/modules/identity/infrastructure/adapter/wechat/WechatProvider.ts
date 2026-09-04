import { DomainError } from '../../../../../foundation/domain/DomainError';
import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { FederatedIdentityProvider, FederationCallback, FederationStart, ProviderHealth } from '../../../application/port/FederatedIdentityProvider';
import { FederatedSubject } from '../../../domain/model/FederatedSubject';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';

export class WechatProvider implements FederatedIdentityProvider {
  readonly type = 'wechat' as const;
  constructor(private readonly client: ProviderHttpClient) {}
  async start({ instance, state }: FederationStart) {
    if (miniapp(instance.scopes)) {
      const callback = new URL(instance.redirecturi);
      callback.searchParams.set('state', state);
      callback.searchParams.set('method', 'wx.login');
      return Object.freeze({ location: callback.toString() });
    }
    const credentials = await this.client.credentials(instance.secretref);
    const url = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
    url.searchParams.set('appid', credentials.clientid);
    url.searchParams.set('redirect_uri', instance.redirecturi);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'snsapi_base');
    url.searchParams.set('state', state);
    url.hash = 'wechat_redirect';
    return Object.freeze({ location: url.toString() });
  }
  async callback({ instance, code, signal, deadline }: FederationCallback) {
    const credentials = await this.client.credentials(instance.secretref);
    const isMiniapp = miniapp(instance.scopes);
    const url = new URL(isMiniapp ? 'https://api.weixin.qq.com/sns/jscode2session' : 'https://api.weixin.qq.com/sns/oauth2/access_token');
    url.searchParams.set('appid', credentials.clientid);
    url.searchParams.set('secret', credentials.secret);
    url.searchParams.set(isMiniapp ? 'js_code' : 'code', code);
    url.searchParams.set('grant_type', 'authorization_code');
    const response = await this.client.send(url, { headers: { accept: 'application/json' } }, { mode: 'read', signal, deadline });
    const body = await this.client.json(response, 'IDENTITY_PROVIDER_UNAVAILABLE');
    const subject = text(body.openid);
    const union = typeof body.unionid === 'string' ? body.unionid : undefined;
    if ((body.errcode !== undefined && body.errcode !== 0) || !subject) throw new DomainError('FEDERATION_CALLBACK_REJECTED');
    return new FederatedSubject({
      provider: this.type,
      instance: instance.id,
      tenant: credentials.tenant,
      subject: union ?? subject,
      assurance: 1,
      claims: { openid: subject, ...(union === undefined ? {} : { unionid: union }) },
    });
  }
  async health(instance: FederationStart['instance']): Promise<ProviderHealth> {
    await this.client.credentials(instance.secretref);
    return Object.freeze({ status: instance.enabled() ? 'healthy' : 'degraded', checkedat: new Date().toISOString() });
  }
}
function miniapp(scopes: readonly string[]): boolean {
  return scopes.includes('miniapp');
}
function text(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,256}$/.test(value) ? value : null;
}
