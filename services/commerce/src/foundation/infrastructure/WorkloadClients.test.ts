import { describe, expect, it } from 'vitest';
import { KmsClient } from './KmsClient';
import { WorkloadSecretStore } from './SecretStore';

const secretStoreBearer = 's'.repeat(43);
const kmsBearer = 'k'.repeat(43);

describe('internal workload clients', () => {
  it('requires a valid bearer at construction', () => {
    expect(() => new WorkloadSecretStore('https://secrets.internal', 'short')).toThrow('SECRET_STORE_BEARER_TOKEN_INVALID');
    expect(() => new KmsClient('https://kms.internal', 'short')).toThrow('KMS_BEARER_TOKEN_INVALID');
  });

  it('sends the Secret Store bearer without exposing it in the URL', async () => {
    let input: RequestInfo | URL | undefined;
    let init: RequestInit | undefined;
    let calls = 0;
    const fetcher = async (requestInput: RequestInfo | URL, requestInit?: RequestInit): Promise<Response> => {
      calls += 1;
      input = requestInput;
      init = requestInit;
      return new Response(JSON.stringify({ value: 'database-connection', version: 'version:7', expiresAt: null }), { status: 200 });
    };
    const accesses: unknown[] = [];
    const store = new WorkloadSecretStore('https://secrets.internal', secretStoreBearer, fetcher, (event) => accesses.push(event));
    const secret = await store.resolve('secret/database/api');
    expect(secret.version).toBe('version:7');
    expect(secret.reveal('database')).toBe('database-connection');
    expect(() => String(secret)).toThrow('SECRET_COERCION_FORBIDDEN');
    expect(() => JSON.stringify(secret)).toThrow('SECRET_SERIALIZATION_FORBIDDEN');
    expect(accesses).toEqual([expect.objectContaining({ version: 'version:7', purpose: 'database' })]);
    expect(calls).toBe(1);
    expect(String(input)).not.toContain(secretStoreBearer);
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${secretStoreBearer}`);
  });

  it('sends the independent KMS bearer on encrypt and decrypt', async () => {
    const ciphertext = `local:v1:${'a'.repeat(32)}`;
    const authorizations: Array<string | null> = [];
    let calls = 0;
    const fetcher = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      authorizations.push(new Headers(init?.headers).get('authorization'));
      calls += 1;
      return calls === 1 ? new Response(JSON.stringify({ ciphertext, fingerprint: 'f'.repeat(64), keyVersion: 'local-v1' }), { status: 200 }) : new Response(JSON.stringify({ plaintext: '13800138000' }), { status: 200 });
    };
    const kms = new KmsClient('https://kms.internal', kmsBearer, fetcher);
    const envelope = await kms.encrypt('pii', 'identity/mobile', '13800138000', { principal: 'principal:one' });
    await expect(kms.decrypt('pii', 'identity/mobile', envelope.ciphertext, { principal: 'principal:one' })).resolves.toBe('13800138000');
    expect(calls).toBe(2);
    expect(authorizations).toEqual([`Bearer ${kmsBearer}`, `Bearer ${kmsBearer}`]);
  });
});
