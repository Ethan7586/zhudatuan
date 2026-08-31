import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { FederatedIdentityProvider, FederationCallback, FederationStart } from '../../../application/port/FederatedIdentityProvider';
import { FederatedSubject } from '../../../domain/model/FederatedSubject';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';
import { WecomCorpClient } from './WecomCorpClient';
import { WecomCorpMapper } from './WecomCorpMapper';
export class WecomCorpProvider implements FederatedIdentityProvider {
  readonly type = 'wecomcorp' as const;
  private readonly api: WecomCorpClient;
  private readonly mapper = new WecomCorpMapper();
  constructor(private readonly client: ProviderHttpClient) {
    this.api = new WecomCorpClient(client);
  }
  async start({ instance, state }: FederationStart) {
    const credential = await this.client.credentials(instance.secretref);
    const url = new URL(WECOM_PROVIDER_CONFIGURATION.corp.authorize);
    url.searchParams.set('appid', credential.tenant);
    url.searchParams.set('redirect_uri', instance.redirecturi);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'snsapi_base');
    url.searchParams.set('state', state);
    if (credential.agentid) url.searchParams.set('agentid', credential.agentid);
    url.hash = 'wechat_redirect';
    return Object.freeze({ location: url.toString() });
  }
  async callback({ instance, code, signal, deadline }: FederationCallback) {
    const value = this.mapper.value(await this.api.identity(instance, code, signal, deadline));
    return new FederatedSubject({ provider: this.type, instance: instance.id, tenant: value.tenant, subject: value.subject, assurance: 2, claims: {} });
  }
  async health(instance: FederationStart['instance']) {
    await this.client.credentials(instance.secretref);
    return Object.freeze({ status: instance.enabled() ? ('healthy' as const) : ('degraded' as const), checkedat: new Date().toISOString() });
  }
}
