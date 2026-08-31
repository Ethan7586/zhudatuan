import { DomainError } from '../../../../../foundation/domain/DomainError';
import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { FederatedIdentityProvider, FederationCallback, FederationStart, ProviderHealth } from '../../../application/port/FederatedIdentityProvider';
import { FederatedSubject } from '../../../domain/model/FederatedSubject';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';

export class WechatProvider implements FederatedIdentityProvider {
  readonly type = 'wechat' as const;
  constructor(private readonly client: ProviderHttpClient) {}
  async start({ instance, state }: FederationStart) {
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
    const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
    url.searchParams.set('appid', credentials.clientid);
    url.searchParams.set('secret', credentials.secret);
    url.searchParams.set('code', code);
    url.searchParams.set('grant_type', 'authorization_code');
    const response = await this.client.http.send(url, { headers: { accept: 'application/json' } }, { mode: 'read', signal, deadline });
    const body = await json(response);
    const subject = text(body.openid);
    const union = typeof body.unionid === 'string' ? body.unionid : undefined;
    if (!response.ok || (body.errcode !== undefined && body.errcode !== 0) || !subject) throw new DomainError('FEDERATION_CALLBACK_REJECTED');
    return new FederatedSubject({ provider: this.type, instance: instance.id, tenant: credentials.tenant, subject: union ?? subject, assurance: 1, claims: {} });
  }
  async health(instance: FederationStart['instance']): Promise<ProviderHealth> {
    await this.client.credentials(instance.secretref);
    return Object.freeze({ status: instance.enabled() ? 'healthy' : 'degraded', checkedat: new Date().toISOString() });
  }
}
async function json(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
  }
}
function text(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,256}$/.test(value) ? value : null;
}
