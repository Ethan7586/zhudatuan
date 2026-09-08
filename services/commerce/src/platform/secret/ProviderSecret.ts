import { DomainError } from '../error/DomainError';
import type { SecretStore } from './SecretStore';

export interface ProviderCredential {
  readonly clientid: string;
  readonly secret: string;
  readonly tenant: string;
  readonly issuer: string | null;
  readonly agentid?: string;
  readonly suiteid?: string;
  readonly token?: string;
  readonly aeskey?: string;
}

export async function providerCredential(store: SecretStore, reference: string): Promise<ProviderCredential> {
  const plaintext = (await store.resolve(reference)).reveal('identityprovider');
  let value: unknown;
  try {
    value = JSON.parse(plaintext);
  } catch {
    return invalid();
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  const allowed = new Set(['clientid', 'secret', 'tenant', 'issuer', 'agentid', 'suiteid', 'token', 'aeskey']);
  if (
    Object.keys(record).some((key) => !allowed.has(key)) ||
    typeof record.clientid !== 'string' ||
    !record.clientid ||
    typeof record.secret !== 'string' ||
    record.secret.length < 16 ||
    typeof record.tenant !== 'string' ||
    !record.tenant ||
    (record.issuer !== null && record.issuer !== undefined && typeof record.issuer !== 'string')
  )
    return invalid();
  return Object.freeze({
    clientid: record.clientid,
    secret: record.secret,
    tenant: record.tenant,
    issuer: typeof record.issuer === 'string' ? record.issuer : null,
    ...(typeof record.agentid === 'string' ? { agentid: record.agentid } : {}),
    ...(typeof record.suiteid === 'string' ? { suiteid: record.suiteid } : {}),
    ...(typeof record.token === 'string' ? { token: record.token } : {}),
    ...(typeof record.aeskey === 'string' ? { aeskey: record.aeskey } : {}),
  });
}
function invalid(): never {
  throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
}
