import { createHash, randomUUID } from 'node:crypto';
import { localInfrastructureEnvironment } from '@shop/config/server';

const environment = localInfrastructureEnvironment();
const secretAuthorization = { authorization: `Bearer ${environment.secretStoreBearerToken}` };
const kmsAuthorization = { authorization: `Bearer ${environment.kmsBearerToken}` };

await Promise.all(
  [8443, 8444, 8445].map(async (port) => {
    const response = await fetch(`https://127.0.0.1:${port}/health/ready`, { redirect: 'error' });
    if (!response.ok) throw new Error(`LOCAL_SERVICE_HEALTH_FAILED:${port}:${response.status}`);
  })
);

const objectToken = await secret('shop/local/objects/api');
await secret('shop/local/database/api');
const context = { verification: randomUUID() };
const encrypted = await json('https://127.0.0.1:8444/v1/envelopes', {
  method: 'POST',
  headers: { ...kmsAuthorization, 'content-type': 'application/json' },
  body: JSON.stringify({ context, keyRef: 'local/verification', purpose: 'evidence', plaintext: 'verified' }),
});
if (typeof encrypted.ciphertext !== 'string' || typeof encrypted.fingerprint !== 'string') throw new Error('LOCAL_KMS_ENVELOPE_INVALID');
const decrypted = await json('https://127.0.0.1:8444/v1/plaintexts', {
  method: 'POST',
  headers: { ...kmsAuthorization, 'content-type': 'application/json' },
  body: JSON.stringify({ context, keyRef: 'local/verification', purpose: 'evidence', ciphertext: encrypted.ciphertext }),
});
if (decrypted.plaintext !== 'verified') throw new Error('LOCAL_KMS_ROUNDTRIP_FAILED');

const authorization = { authorization: `Bearer ${objectToken}` };
const path = `verification/${randomUUID()}.txt`;
const created = await json('https://127.0.0.1:8445/v1/uploads', {
  method: 'POST',
  headers: { ...authorization, 'content-type': 'application/json' },
  body: JSON.stringify({ path, contentType: 'text/plain' }),
});
if (typeof created.id !== 'string') throw new Error('LOCAL_OBJECT_UPLOAD_INVALID');
const bytes = new TextEncoder().encode('verified');
await ok(`https://127.0.0.1:8445/v1/uploads/${encodeURIComponent(created.id)}/parts/0`, {
  method: 'PUT',
  headers: { ...authorization, 'content-type': 'application/octet-stream' },
  body: bytes,
});
const completed = await json(`https://127.0.0.1:8445/v1/uploads/${encodeURIComponent(created.id)}/completion`, {
  method: 'POST',
  headers: { ...authorization, 'content-type': 'application/json' },
  body: JSON.stringify({ parts: 1, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.byteLength }),
});
if (typeof completed.reference !== 'string') throw new Error('LOCAL_OBJECT_COMPLETION_INVALID');
const read = await ok(`https://127.0.0.1:8445/v1/objects?reference=${encodeURIComponent(completed.reference)}`, { headers: authorization });
if (!Buffer.from(await read.arrayBuffer()).equals(Buffer.from(bytes))) throw new Error('LOCAL_OBJECT_ROUNDTRIP_FAILED');
process.stdout.write('LOCAL_HTTPS_CONTRACTS_VERIFIED secretstore=ok kms=ok objects=ok\n');

async function secret(reference: string): Promise<string> {
  const value = await json(`https://127.0.0.1:8443/v1/secrets/${encodeURIComponent(reference)}`, { headers: secretAuthorization });
  if (typeof value.value !== 'string' || !value.value) throw new Error('LOCAL_SECRET_INVALID');
  return value.value;
}
async function json(url: string, init?: RequestInit): Promise<Readonly<Record<string, unknown>>> {
  const response = await ok(url, init);
  const value: unknown = await response.json();
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('LOCAL_JSON_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
async function ok(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: 'error' });
  if (!response.ok) throw new Error(`LOCAL_HTTP_FAILED:${new URL(url).pathname}:${response.status}`);
  return response;
}
