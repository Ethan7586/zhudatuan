import { DomainError } from '../../../../../platform/error/DomainError';
import { IDENTITY_PROVIDER_CONFIGURATION } from '@shop/config/server';
import { Singleflight } from '@shop/kernel';
import type { JsonWebKey as CryptoJsonWebKey } from 'node:crypto';
import type { ProviderInstance } from '../../../domain/model/ProviderInstance';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';
import type { OidcMetadata } from './OidcDiscovery';
export interface OidcToken {
  readonly idtoken: string;
}
export type OidcJwk = CryptoJsonWebKey & Readonly<{ kid?: string }>;
export class OidcClient {
  private readonly keys = new Map<string, Readonly<{ value: readonly OidcJwk[]; expires: number }>>();
  private readonly flights = new Singleflight();
  constructor(private readonly client: ProviderHttpClient) {}
  authorize(instance: ProviderInstance, metadata: OidcMetadata, clientid: string, state: string, nonce: string, challenge: string): string {
    const url = new URL(metadata.authorization);
    url.searchParams.set('client_id', clientid);
    url.searchParams.set('redirect_uri', instance.redirecturi);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', instance.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }
  async exchange(instance: ProviderInstance, metadata: OidcMetadata, code: string, verifier: string, signal?: AbortSignal, deadline?: number): Promise<OidcToken> {
    const credential = await this.client.credentials(instance.secretref);
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: instance.redirecturi, client_id: credential.clientid, client_secret: credential.secret, code_verifier: verifier });
    const response = await this.client.send(metadata.token, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body }, { mode: 'none', signal, deadline });
    const value = await this.client.json(response, 'FEDERATION_CALLBACK_REJECTED');
    if (typeof value.id_token !== 'string' || value.id_token.length > IDENTITY_PROVIDER_CONFIGURATION.maximumResponseBytes) {
      throw new DomainError('FEDERATION_CALLBACK_REJECTED');
    }
    return Object.freeze({ idtoken: value.id_token });
  }
  async jwks(metadata: OidcMetadata, refresh = false, signal?: AbortSignal, deadline?: number): Promise<readonly OidcJwk[]> {
    const cached = this.keys.get(metadata.jwks);
    if (!refresh && cached && cached.expires > Date.now()) return cached.value;
    return this.flights.run(
      `jwks:${metadata.jwks}`,
      async () => {
        const response = await this.client.send(metadata.jwks, { headers: { accept: 'application/json' } }, { mode: 'read', signal, deadline });
        const body = (await this.client.json(response, 'IDENTITY_PROVIDER_UNAVAILABLE')) as { keys?: unknown };
        if (!Array.isArray(body.keys) || body.keys.length > 100) throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
        const keys = Object.freeze(body.keys.filter((key): key is OidcJwk => key !== null && typeof key === 'object').map((key) => Object.freeze(key)));
        this.keys.set(metadata.jwks, Object.freeze({ value: keys, expires: Date.now() + IDENTITY_PROVIDER_CONFIGURATION.jwksTtlSeconds * 1_000 }));
        return keys;
      },
      { signal, deadline }
    );
  }
}
