import { DomainError } from '../../../../../foundation/domain/DomainError';
import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { FederatedIdentityProvider, FederationCallback, FederationStart } from '../../../application/port/FederatedIdentityProvider';
import { FederatedSubject } from '../../../domain/model/FederatedSubject';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';
import { WecomSuiteClient } from './WecomSuiteClient';
import { WecomSuiteMapper } from './WecomSuiteMapper';
export class WecomSuiteProvider implements FederatedIdentityProvider {
  readonly type = 'wecomsuite' as const;
  private readonly api: WecomSuiteClient;
  private readonly mapper = new WecomSuiteMapper();
  constructor(
    private readonly client: ProviderHttpClient,
    key: string
  ) {
    this.api = new WecomSuiteClient(client, key);
  }
  async start({ instance, state }: FederationStart) {
    const credential = await this.client.credentials(instance.secretref);
    if (!credential.suiteid) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    const url = new URL(WECOM_PROVIDER_CONFIGURATION.suite.authorize);
    url.searchParams.set('appid', credential.suiteid);
    url.searchParams.set('redirect_uri', instance.redirecturi);
    url.searchParams.set('state', state);
    url.searchParams.set('usertype', 'member');
    return Object.freeze({ location: url.toString() });
  }
  async callback({ instance, code, signal, deadline }: FederationCallback) {
    const value = this.mapper.identity(await this.api.identity(instance, code, signal, deadline));
    return new FederatedSubject({ provider: this.type, instance: instance.id, tenant: value.tenant, subject: value.subject, assurance: 2, claims: {} });
  }
  async health(instance: FederationStart['instance']) {
    await this.client.credentials(instance.secretref);
    return Object.freeze({ status: instance.enabled() ? ('healthy' as const) : ('degraded' as const), checkedat: new Date().toISOString() });
  }
}
