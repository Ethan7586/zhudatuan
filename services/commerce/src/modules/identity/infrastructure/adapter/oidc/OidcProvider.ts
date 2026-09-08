import { DomainError } from '../../../../../platform/error/DomainError';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { IDENTITY_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { FederatedIdentityProvider, FederationCallback, FederationStart } from '../../../application/port/FederatedIdentityProvider';
import { FederatedSubject } from '../../../domain/model/FederatedSubject';
import type { ProviderHttpClient } from '../../security/ProviderHttpClient';
import { OidcClient, type OidcJwk } from './OidcClient';
import { OidcDiscovery } from './OidcDiscovery';
import { OidcMapper } from './OidcMapper';
export class OidcProvider implements FederatedIdentityProvider {
  readonly type = 'oidc' as const;
  private readonly discovery: OidcDiscovery;
  private readonly api: OidcClient;
  private readonly mapper = new OidcMapper();
  constructor(private readonly client: ProviderHttpClient) {
    this.discovery = new OidcDiscovery(client);
    this.api = new OidcClient(client);
  }
  async start({ instance, state, nonce, challenge }: FederationStart) {
    if (!instance.issuer) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    const credential = await this.credentials(instance);
    return Object.freeze({ location: this.api.authorize(instance, await this.discovery.read(instance.issuer), credential.clientid, state, nonce, challenge) });
  }
  async callback({ instance, code, noncehash, verifier, signal, deadline }: FederationCallback) {
    if (!instance.issuer) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    const metadata = await this.discovery.read(instance.issuer, signal, deadline);
    const token = await this.api.exchange(instance, metadata, code, verifier, signal, deadline);
    const decoded = decode(token.idtoken);
    let keys = await this.api.jwks(metadata, false, signal, deadline);
    let key = keys.find((candidate) => candidate.kid === decoded.header.kid);
    if (!key) {
      keys = await this.api.jwks(metadata, true, signal, deadline);
      key = keys.find((candidate) => candidate.kid === decoded.header.kid);
    }
    if (!key || !signature(decoded, key)) throw new DomainError('FEDERATION_CALLBACK_REJECTED');
    const credential = await this.credentials(instance);
    validate(decoded.claims, metadata.issuer, credential.clientid, noncehash);
    return new FederatedSubject({ provider: this.type, instance: instance.id, tenant: metadata.issuer, subject: String(decoded.claims.sub), assurance: 2, claims: this.mapper.claims(decoded.claims) });
  }
  async health(instance: FederationStart['instance']) {
    if (!instance.issuer) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    await this.discovery.read(instance.issuer);
    return Object.freeze({ status: 'healthy' as const, checkedat: new Date().toISOString() });
  }
  private credentials(instance: FederationStart['instance']) {
    return this.client.credentials(instance.secretref);
  }
}
interface TokenParts {
  readonly signing: Buffer;
  readonly signature: Buffer;
  readonly header: Readonly<Record<string, unknown>>;
  readonly claims: Readonly<Record<string, unknown>>;
}
function decode(token: string): TokenParts {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) invalid();
  let header: unknown;
  let claims: unknown;
  try {
    header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString());
    claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString());
  } catch {
    return invalid();
  }
  if (!object(header) || !object(claims) || typeof header.kid !== 'string' || !IDENTITY_PROVIDER_CONFIGURATION.allowedAlgorithms.includes(header.alg as never)) invalid();
  return Object.freeze({ signing: Buffer.from(`${parts[0]}.${parts[1]}`), signature: Buffer.from(parts[2]!, 'base64url'), header, claims });
}
function signature(token: TokenParts, jwk: OidcJwk): boolean {
  try {
    const key = createPublicKey({ key: jwk, format: 'jwk' });
    return verify('sha256', token.signing, token.header.alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key, token.signature);
  } catch {
    return false;
  }
}
function validate(claims: Readonly<Record<string, unknown>>, issuer: string, audience: string, noncehash: Buffer): void {
  const now = Math.floor(Date.now() / 1_000);
  const skew = IDENTITY_PROVIDER_CONFIGURATION.clockSkewSeconds;
  const audiences = typeof claims.aud === 'string' ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud : [];
  if (
    claims.iss !== issuer ||
    !audiences.includes(audience) ||
    (audiences.length > 1 && claims.azp !== audience) ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    typeof claims.exp !== 'number' ||
    claims.exp < now - skew ||
    typeof claims.iat !== 'number' ||
    claims.iat > now + skew ||
    typeof claims.nonce !== 'string' ||
    !createHash('sha256').update(claims.nonce).digest().equals(noncehash)
  )
    invalid();
}
function object(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function invalid(): never {
  throw new DomainError('FEDERATION_CALLBACK_REJECTED');
}
