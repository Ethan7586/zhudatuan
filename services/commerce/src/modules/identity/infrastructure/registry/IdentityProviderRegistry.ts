import { DomainError } from '../../../../foundation/domain/DomainError';
import type { IdentityProviderType } from '@shop/config/server';
import type { FederatedIdentityProvider } from '../../application/port/FederatedIdentityProvider';
import type { ProviderHttpClient } from '../security/ProviderHttpClient';
import { WechatProvider } from '../adapter/wechat/WechatProvider';
import { WecomCorpProvider } from '../adapter/wecomcorp/WecomCorpProvider';
import { WecomSuiteProvider } from '../adapter/wecomsuite/WecomSuiteProvider';
import { OidcProvider } from '../adapter/oidc/OidcProvider';

export class IdentityProviderRegistry {
  private readonly providers: ReadonlyMap<IdentityProviderType, FederatedIdentityProvider>;
  constructor(values: readonly FederatedIdentityProvider[]) {
    const providers = new Map<IdentityProviderType, FederatedIdentityProvider>();
    for (const provider of values) {
      if (providers.has(provider.type)) throw new Error(`IDENTITY_PROVIDER_DUPLICATE:${provider.type}`);
      if (typeof provider.start !== 'function' || typeof provider.callback !== 'function' || typeof provider.health !== 'function') {
        throw new Error(`IDENTITY_PROVIDER_INCOMPLETE:${provider.type}`);
      }
      providers.set(provider.type, provider);
    }
    for (const type of ['wechat', 'wecomcorp', 'wecomsuite', 'oidc'] as const)
      if (!providers.has(type)) {
        throw new Error(`IDENTITY_PROVIDER_STRATEGY_MISSING:${type}`);
      }
    this.providers = providers;
    Object.freeze(this);
  }
  require(type: IdentityProviderType): FederatedIdentityProvider {
    const provider = this.providers.get(type);
    if (!provider) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    return provider;
  }
  types(): readonly IdentityProviderType[] {
    return Object.freeze([...this.providers.keys()].sort());
  }
}

export function identityProviderRegistry(client: ProviderHttpClient, key: string): IdentityProviderRegistry {
  return new IdentityProviderRegistry([new WechatProvider(client), new WecomCorpProvider(client), new WecomSuiteProvider(client, key), new OidcProvider(client)]);
}
