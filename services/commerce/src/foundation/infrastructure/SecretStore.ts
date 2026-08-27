import { token } from '../../bootstrap/Container';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { bearerToken } from '@shop/config/server';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { bearerToken } from '@shop/config/server';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { HttpClient } from '../http/HttpClient';

export interface SecretStore {
  read(reference: string): Promise<string>;
}

export const SECRET_STORE = token<SecretStore>('secret.store');

export interface SecurityKeys {
  readonly identity: string;
  readonly quote: string;
  readonly session: string;
}

export const SECURITY_KEYS = token<SecurityKeys>('security.keys');

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
export interface IdentitySecurityKeys {
  readonly identity: string;
  readonly session: string;
}

export const IDENTITY_SECURITY_KEYS = token<IdentitySecurityKeys>('identity.securitykeys');

<<<<<<< HEAD
export class WorkloadSecretStore implements SecretStore {
  private readonly http: HttpClient;
  private readonly bearer: string;
  constructor(private readonly endpoint: string, bearer: string, fetcher: typeof fetch = fetch) {
    if (!endpoint.startsWith('https://')) throw new Error('SECRET_STORE_ENDPOINT_INVALID');
    this.bearer = bearerToken(bearer, 'SECRET_STORE_BEARER_TOKEN_INVALID');
=======
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
export class WorkloadSecretStore implements SecretStore {
  private readonly http: HttpClient;
  private readonly bearer: string;
  constructor(private readonly endpoint: string, bearer: string, fetcher: typeof fetch = fetch) {
    if (!endpoint.startsWith('https://')) throw new Error('SECRET_STORE_ENDPOINT_INVALID');
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    this.bearer = bearerToken(bearer, 'SECRET_STORE_BEARER_TOKEN_INVALID');
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
export class WorkloadSecretStore implements SecretStore {
  private readonly http: HttpClient;
  constructor(private readonly endpoint: string, fetcher: typeof fetch = fetch) {
    if (!endpoint.startsWith('https://')) throw new Error('SECRET_STORE_ENDPOINT_INVALID');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    this.http = new HttpClient(fetcher);
  }

  async read(reference: string): Promise<string> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(reference)) throw new Error('SECRET_REFERENCE_INVALID');
    const response = await this.http.send(`${this.endpoint.replace(/\/$/, '')}/v1/secrets/${encodeURIComponent(reference)}`, {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
      headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}` },
=======
      headers: { accept: 'application/json' },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}` },
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
      headers: { accept: 'application/json' },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      redirect: 'error',
    }, { mode: 'read' });
    if (!response.ok) throw new Error('SECRET_READ_FAILED');
    const value = await response.json() as { value?: unknown };
    if (typeof value.value !== 'string' || value.value.length === 0) throw new Error('SECRET_VALUE_INVALID');
    return value.value;
  }
}
