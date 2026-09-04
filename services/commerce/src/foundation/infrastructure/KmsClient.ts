import { bearerToken } from '@shop/config/server';
import type { CipherEnvelope, KmsClient, KmsPurpose } from '../application/KmsPort';
import { HttpClient } from '../http/HttpClient';
import { NetworkPolicy } from '../security/NetworkPolicy';

export class HttpKmsClient implements KmsClient {
  private readonly http: HttpClient;
  private readonly bearer: string;
  constructor(
    private readonly endpoint: string,
    bearer: string,
    fetcher: typeof fetch = fetch
  ) {
    if (!endpoint.startsWith('https://')) throw new Error('KMS_ENDPOINT_INVALID');
    this.bearer = bearerToken(bearer, 'KMS_BEARER_TOKEN_INVALID');
    this.http = new HttpClient(fetcher, NetworkPolicy.service(endpoint));
  }

  async encrypt(purpose: KmsPurpose, keyRef: string, plaintext: string, context: Readonly<Record<string, string>>): Promise<CipherEnvelope> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(keyRef)) throw new Error('KMS_KEY_REFERENCE_INVALID');
    if (!plaintext) throw new Error('KMS_PLAINTEXT_EMPTY');
    const response = await this.http.send(
      `${this.endpoint.replace(/\/$/, '')}/v1/envelopes`,
      {
        method: 'POST',
        headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, 'content-type': 'application/json' },
        body: JSON.stringify({ context, keyRef, plaintext, purpose }),
        redirect: 'error',
      },
      { mode: 'read' }
    );
    if (!response.ok) throw new Error('KMS_ENCRYPT_FAILED');
    const value = (await response.json()) as Partial<CipherEnvelope>;
    if (typeof value.ciphertext !== 'string' || value.ciphertext.length < 16 || typeof value.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(value.fingerprint) || typeof value.keyVersion !== 'string' || value.keyVersion.length < 1)
      throw new Error('KMS_ENVELOPE_INVALID');
    return Object.freeze({ ciphertext: value.ciphertext, fingerprint: value.fingerprint, keyVersion: value.keyVersion });
  }

  async decrypt(purpose: KmsPurpose, keyRef: string, ciphertext: string, context: Readonly<Record<string, string>>): Promise<string> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(keyRef) || ciphertext.length < 16) throw new Error('KMS_DECRYPT_INPUT_INVALID');
    const response = await this.http.send(
      `${this.endpoint.replace(/\/$/, '')}/v1/plaintexts`,
      {
        method: 'POST',
        headers: { accept: 'application/json', authorization: `Bearer ${this.bearer}`, 'content-type': 'application/json' },
        body: JSON.stringify({ context, keyRef, ciphertext, purpose }),
        redirect: 'error',
      },
      { mode: 'read' }
    );
    if (!response.ok) throw new Error('KMS_DECRYPT_FAILED');
    const value = (await response.json()) as { plaintext?: unknown };
    if (typeof value.plaintext !== 'string' || value.plaintext.length === 0) throw new Error('KMS_PLAINTEXT_INVALID');
    return value.plaintext;
  }
}
