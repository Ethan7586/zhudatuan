import { DomainError } from '../../../../../foundation/domain/DomainError';
import { IDENTITY_PROVIDER_CONFIGURATION, oidcIssuer } from '@shop/config/server';
import { Singleflight } from '../../../../../foundation/performance/Singleflight';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';

export interface OidcMetadata {
  readonly issuer: string;
  readonly authorization: string;
  readonly token: string;
  readonly jwks: string;
}
export class OidcDiscovery {
  private readonly cache = new Map<string, Readonly<{ value: OidcMetadata; expires: number }>>();
  private readonly flights = new Singleflight();
  constructor(private readonly client: ProviderHttpClient) {}
  async read(issuerValue: string, signal?: AbortSignal, deadline?: number): Promise<OidcMetadata> {
    const issuer = oidcIssuer(issuerValue);
    const cached = this.cache.get(issuer);
    if (cached && cached.expires > Date.now()) return cached.value;
    return this.flights.run(
      `discovery:${issuer}`,
      async () => {
        const url = new URL(issuer);
        url.pathname = `${url.pathname.replace(/\/$/, '')}${IDENTITY_PROVIDER_CONFIGURATION.discoveryPath}`;
        const response = await this.client.http.send(url, { headers: { accept: 'application/json' } }, { mode: 'read', signal, deadline });
        if (!response.ok) throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
        const body = (await response.json()) as Record<string, unknown>;
        if (body.issuer !== issuer || typeof body.authorization_endpoint !== 'string' || typeof body.token_endpoint !== 'string' || typeof body.jwks_uri !== 'string') throw new Error('OIDC_DISCOVERY_INVALID');
        const value = Object.freeze({ issuer, authorization: endpoint(body.authorization_endpoint), token: endpoint(body.token_endpoint), jwks: endpoint(body.jwks_uri) });
        this.cache.set(issuer, Object.freeze({ value, expires: Date.now() + IDENTITY_PROVIDER_CONFIGURATION.discoveryTtlSeconds * 1_000 }));
        return value;
      },
      { signal, deadline }
    );
  }
}
function endpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('OIDC_DISCOVERY_INVALID');
  return url.toString();
}
