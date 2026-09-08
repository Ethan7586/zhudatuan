import { createHash } from 'node:crypto';
import type { SecretMaterial, SecretPurpose } from '@shop/contract';
import { token } from '../../composition/Container';
import { bearerToken } from '@shop/config/server';
import { HttpClient } from '../http/HttpClient';
import { NetworkPolicy } from '../security/NetworkPolicy';

export interface SecretStore {
  resolve(reference: string): Promise<SecretMaterial>;
}

export const SECRET_STORE = token<SecretStore>('secret.store');

export interface SecurityKeys {
  readonly identity: string;
  readonly navigation: string;
  readonly quote: string;
  readonly session: string;
}

export const SECURITY_KEYS = token<SecurityKeys>('security.keys');

export interface IdentitySecurityKeys {
  readonly identity: string;
  readonly invitation: string;
  readonly session: string;
}

export interface NavigationSecurityKey {
  readonly navigation: string;
}
export const NAVIGATION_SECURITY_KEY = token<NavigationSecurityKey>('navigation.securitykey');

export const IDENTITY_SECURITY_KEYS = token<IdentitySecurityKeys>('identity.securitykeys');
export const INVITATION_KEY_VERSIONS = token<readonly string[]>('identity.invitationkeyversions');

export class WorkloadSecretStore implements SecretStore {
  private readonly http: HttpClient;
  private readonly bearer: string;
  constructor(
    private readonly endpoint: string,
    bearer: string,
    fetcher: typeof fetch = fetch,
    private readonly audit: (event: SecretAccess) => void = () => undefined
  ) {
    if (!endpoint.startsWith('https://')) throw new Error('SECRET_STORE_ENDPOINT_INVALID');
    this.bearer = bearerToken(bearer, 'SECRET_STORE_BEARER_TOKEN_INVALID');
    this.http = new HttpClient(fetcher, NetworkPolicy.service(endpoint));
  }

  async resolve(reference: string): Promise<SecretMaterial> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(reference)) throw new Error('SECRET_REFERENCE_INVALID');
    const response = await this.http.send(
      `${this.endpoint.replace(/\/$/, '')}/v1/secrets/${encodeURIComponent(reference)}`,
      {
        headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}` },
        redirect: 'error',
      },
      { mode: 'read' }
    );
    if (!response.ok) throw new Error('SECRET_READ_FAILED');
    const body = (await response.json()) as Record<string, unknown>;
    if (
      !exactKeys(body, ['expiresAt', 'value', 'version']) ||
      typeof body.value !== 'string' ||
      body.value.length === 0 ||
      typeof body.version !== 'string' ||
      !/^[A-Za-z0-9.:/-]{1,128}$/.test(body.version) ||
      (body.expiresAt !== null && (typeof body.expiresAt !== 'string' || Number.isNaN(Date.parse(body.expiresAt))))
    ) {
      throw new Error('SECRET_VALUE_INVALID');
    }
    const expiresAt = body.expiresAt === null ? null : new Date(body.expiresAt as string);
    return new SecretValue(body.value, body.version, expiresAt, digest(reference), this.audit);
  }
}

export interface SecretAccess {
  readonly referenceHash: string;
  readonly version: string;
  readonly purpose: SecretPurpose;
  readonly occurredAt: string;
}

export async function secretText(store: SecretStore, reference: string, purpose: SecretPurpose): Promise<string> {
  return (await store.resolve(reference)).reveal(purpose);
}

class SecretValue implements SecretMaterial {
  constructor(
    private readonly value: string,
    readonly version: string,
    readonly expiresAt: Date | null,
    private readonly referenceHash: string,
    private readonly audit: (event: SecretAccess) => void
  ) {
    Object.freeze(this);
  }

  reveal(purpose: SecretPurpose): string {
    if (this.expiresAt !== null && this.expiresAt.getTime() <= Date.now()) throw new Error('SECRET_EXPIRED');
    this.audit(Object.freeze({ referenceHash: this.referenceHash, version: this.version, purpose, occurredAt: new Date().toISOString() }));
    return this.value;
  }

  toString(): never {
    throw new Error('SECRET_STRINGIFICATION_FORBIDDEN');
  }
  toJSON(): never {
    throw new Error('SECRET_SERIALIZATION_FORBIDDEN');
  }
  valueOf(): never {
    throw new Error('SECRET_COERCION_FORBIDDEN');
  }
  [Symbol.toPrimitive](): never {
    throw new Error('SECRET_COERCION_FORBIDDEN');
  }
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
