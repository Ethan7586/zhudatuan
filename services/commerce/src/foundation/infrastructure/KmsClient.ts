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

export interface CipherEnvelope {
  readonly ciphertext: string;
  readonly fingerprint: string;
  readonly keyVersion: string;
}

export class KmsClient {
  private readonly http: HttpClient;
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  private readonly bearer: string;
  constructor(private readonly endpoint: string, bearer: string, fetcher: typeof fetch = fetch) {
    if (!endpoint.startsWith('https://')) throw new Error('KMS_ENDPOINT_INVALID');
    this.bearer = bearerToken(bearer, 'KMS_BEARER_TOKEN_INVALID');
=======
  constructor(private readonly endpoint: string, fetcher: typeof fetch = fetch) {
    if (!endpoint.startsWith('https://')) throw new Error('KMS_ENDPOINT_INVALID');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  private readonly bearer: string;
  constructor(private readonly endpoint: string, bearer: string, fetcher: typeof fetch = fetch) {
    if (!endpoint.startsWith('https://')) throw new Error('KMS_ENDPOINT_INVALID');
    this.bearer = bearerToken(bearer, 'KMS_BEARER_TOKEN_INVALID');
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  constructor(private readonly endpoint: string, fetcher: typeof fetch = fetch) {
    if (!endpoint.startsWith('https://')) throw new Error('KMS_ENDPOINT_INVALID');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    this.http = new HttpClient(fetcher);
  }

  async encrypt(keyRef: string, plaintext: string, context: Readonly<Record<string, string>>): Promise<CipherEnvelope> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(keyRef)) throw new Error('KMS_KEY_REFERENCE_INVALID');
    if (!plaintext) throw new Error('KMS_PLAINTEXT_EMPTY');
    const response = await this.http.send(`${this.endpoint.replace(/\/$/, '')}/v1/envelopes`, {
      method: 'POST',
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
      headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, 'content-type': 'application/json' },
=======
      headers: { accept: 'application/json', 'content-type': 'application/json' },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, 'content-type': 'application/json' },
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
      headers: { accept: 'application/json', 'content-type': 'application/json' },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      body: JSON.stringify({ context, keyRef, plaintext }),
      redirect: 'error',
    }, { mode: 'read' });
    if (!response.ok) throw new Error('KMS_ENCRYPT_FAILED');
    const value = await response.json() as Partial<CipherEnvelope>;
    if (typeof value.ciphertext !== 'string' || value.ciphertext.length < 16
      || typeof value.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(value.fingerprint)
      || typeof value.keyVersion !== 'string' || value.keyVersion.length < 1) throw new Error('KMS_ENVELOPE_INVALID');
    return Object.freeze({ ciphertext: value.ciphertext, fingerprint: value.fingerprint, keyVersion: value.keyVersion });
  }

  async decrypt(keyRef: string, ciphertext: string, context: Readonly<Record<string, string>>): Promise<string> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(keyRef) || ciphertext.length < 16) throw new Error('KMS_DECRYPT_INPUT_INVALID');
    const response = await this.http.send(`${this.endpoint.replace(/\/$/, '')}/v1/plaintexts`, {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
      method: 'POST', headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, 'content-type': 'application/json' },
=======
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      method: 'POST', headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, 'content-type': 'application/json' },
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
      method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      body: JSON.stringify({ context, keyRef, ciphertext }), redirect: 'error',
    }, { mode: 'read' });
    if (!response.ok) throw new Error('KMS_DECRYPT_FAILED');
    const value = await response.json() as { plaintext?: unknown };
    if (typeof value.plaintext !== 'string' || value.plaintext.length === 0) throw new Error('KMS_PLAINTEXT_INVALID');
    return value.plaintext;
  }
}

export const KMS_CLIENT = token<KmsClient>('kms.client');
