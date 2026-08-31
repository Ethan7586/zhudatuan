import { createHash } from 'node:crypto';
import { isProviderCapability, manifestPayload, type JsonObject, type JsonValue, type ProviderManifest } from '@shop/contract';

export class Manifest {
  readonly hash: string;
  private constructor(readonly value: ProviderManifest) {
    this.hash = createHash('sha256').update(manifestPayload(value)).digest('hex');
    Object.freeze(this);
  }

  static parse(value: unknown, expectedId?: string): Manifest {
    const source = object(value, 'PROVIDER_MANIFEST_INVALID');
    const id = text(source.id, 'PROVIDER_MANIFEST_ID_INVALID');
    const fields = [
      'apiVersion',
      'capabilities',
      'circuitPolicy',
      'configSchema',
      'contractVersion',
      'eventSubscriptions',
      'healthOperation',
      'id',
      'kind',
      'permissions',
      'rateLimits',
      'retryPolicy',
      'secretRefs',
      'signature',
      'timeout',
      'version',
      'webhookContract',
    ];
    if (Object.keys(source).sort().join(',') !== fields.join(',')) throw new Error('PROVIDER_MANIFEST_FIELDS_INVALID');
    if (expectedId !== undefined && id !== expectedId) throw new Error('PROVIDER_MANIFEST_ID_MISMATCH');
    const capabilities = strings(source.capabilities, 'PROVIDER_MANIFEST_CAPABILITY_INVALID');
    if (capabilities.length === 0 || !capabilities.every(isProviderCapability) || new Set(capabilities).size !== capabilities.length) {
      throw new Error('PROVIDER_MANIFEST_CAPABILITY_INVALID');
    }
    const manifest: ProviderManifest = {
      id,
      kind: literal(source.kind, 'channel', 'PROVIDER_MANIFEST_KIND_INVALID'),
      version: text(source.version, 'PROVIDER_MANIFEST_VERSION_INVALID'),
      apiVersion: text(source.apiVersion, 'PROVIDER_MANIFEST_API_VERSION_INVALID'),
      contractVersion: text(source.contractVersion, 'PROVIDER_MANIFEST_CONTRACT_VERSION_INVALID'),
      healthOperation: text(source.healthOperation, 'PROVIDER_MANIFEST_HEALTH_INVALID'),
      capabilities,
      permissions: unique(source.permissions, 'PROVIDER_MANIFEST_PERMISSION_INVALID'),
      configSchema: text(source.configSchema, 'PROVIDER_MANIFEST_SCHEMA_INVALID'),
      eventSubscriptions: unique(source.eventSubscriptions, 'PROVIDER_MANIFEST_EVENT_INVALID'),
      secretRefs: unique(source.secretRefs, 'PROVIDER_MANIFEST_SECRET_REF_INVALID'),
      rateLimits: rateLimits(source.rateLimits),
      timeout: timeouts(source.timeout),
      retryPolicy: retryPolicy(source.retryPolicy),
      circuitPolicy: circuitPolicy(source.circuitPolicy),
      webhookContract: nullableText(source.webhookContract, 'PROVIDER_WEBHOOK_CONTRACT_INVALID'),
      signature: text(source.signature, 'PROVIDER_MANIFEST_SIGNATURE_INVALID'),
    };
    return new Manifest(Object.freeze(manifest));
  }
}

function rateLimits(value: JsonValue | undefined): ProviderManifest['rateLimits'] {
  const source = object(value, 'PROVIDER_RATE_LIMITS_INVALID');
  return Object.freeze({ requestsPerSecond: range(source.requestsPerSecond, 0.01, 10_000, 'PROVIDER_RATE_INVALID'), maxConcurrency: integer(source.maxConcurrency, 1, 64, 'PROVIDER_CONCURRENCY_INVALID') });
}
function timeouts(value: JsonValue | undefined): ProviderManifest['timeout'] {
  const source = object(value, 'PROVIDER_TIMEOUT_INVALID');
  return Object.freeze({
    connectionMs: integer(source.connectionMs, 1, 30_000, 'PROVIDER_CONNECTION_TIMEOUT_INVALID'),
    responseMs: integer(source.responseMs, 1, 120_000, 'PROVIDER_RESPONSE_TIMEOUT_INVALID'),
    totalMs: integer(source.totalMs, 1, 300_000, 'PROVIDER_DEADLINE_INVALID'),
  });
}
function retryPolicy(value: JsonValue | undefined): ProviderManifest['retryPolicy'] {
  const source = object(value, 'PROVIDER_RETRY_POLICY_INVALID');
  return Object.freeze({ maxAttempts: integer(source.maxAttempts, 1, 5, 'PROVIDER_ATTEMPTS_INVALID') });
}
function circuitPolicy(value: JsonValue | undefined): ProviderManifest['circuitPolicy'] {
  const source = object(value, 'PROVIDER_CIRCUIT_POLICY_INVALID');
  return Object.freeze({ failureThreshold: integer(source.failureThreshold, 1, 100, 'PROVIDER_FAILURE_THRESHOLD_INVALID'), recoveryMs: integer(source.recoveryMs, 100, 3_600_000, 'PROVIDER_RECOVERY_INVALID') });
}
function object(value: unknown, code: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonObject;
}
function text(value: JsonValue | undefined, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}
function nullableText(value: JsonValue | undefined, code: string): string | null {
  return value === null ? null : text(value, code);
}
function strings(value: JsonValue | undefined, code: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim())) throw new Error(code);
  return value.map(String);
}
function unique(value: JsonValue | undefined, code: string): string[] {
  const items = strings(value, code);
  if (new Set(items).size !== items.length) throw new Error(code);
  return items;
}
function number(value: JsonValue | undefined, code: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(code);
  return value;
}
function integer(value: JsonValue | undefined, minimum: number, maximum: number, code: string): number {
  const item = number(value, code);
  if (!Number.isInteger(item) || item < minimum || item > maximum) throw new Error(code);
  return item;
}
function range(value: JsonValue | undefined, minimum: number, maximum: number, code: string): number {
  const item = number(value, code);
  if (item < minimum || item > maximum) throw new Error(code);
  return item;
}
function literal<T extends string>(value: JsonValue | undefined, expected: T, code: string): T {
  if (value !== expected) throw new Error(code);
  return expected;
}
