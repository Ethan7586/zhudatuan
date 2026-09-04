import { createHash } from 'node:crypto';
import { isProviderCapability, manifestPayload, type JsonObject, type JsonValue, type ProviderLimit, type ProviderManifest,
  type ProviderPriority } from '@shop/contract';

export class Manifest {
  readonly hash: string;
  private constructor(readonly value: ProviderManifest) {
    this.hash=createHash('sha256').update(manifestPayload(value)).digest('hex');
    Object.freeze(this);
  }

  static parse(value: unknown, expectedId?: string): Manifest {
    const source=object(value,'PROVIDER_MANIFEST_INVALID'); const id=text(source.id,'PROVIDER_MANIFEST_ID_INVALID');
    if (expectedId!==undefined && id!==expectedId) throw new Error('PROVIDER_MANIFEST_ID_MISMATCH');
    const priority=number(source.priority,'PROVIDER_MANIFEST_PRIORITY_INVALID');
    if (priority!==1 && priority!==3 && priority!==4) throw new Error('PROVIDER_MANIFEST_PRIORITY_INVALID');
    const capabilities=strings(source.capabilities,'PROVIDER_MANIFEST_CAPABILITY_INVALID');
    if (capabilities.length===0 || !capabilities.every(isProviderCapability) || new Set(capabilities).size!==capabilities.length) {
      throw new Error('PROVIDER_MANIFEST_CAPABILITY_INVALID');
    }
    const manifest: ProviderManifest={ id, kind:literal(source.kind,'channel','PROVIDER_MANIFEST_KIND_INVALID'),
      priority:priority as ProviderPriority, version:text(source.version,'PROVIDER_MANIFEST_VERSION_INVALID'),
      apiVersion:text(source.apiVersion,'PROVIDER_MANIFEST_API_VERSION_INVALID'),
      contractVersion:text(source.contractVersion,'PROVIDER_MANIFEST_CONTRACT_VERSION_INVALID'),
      healthOperation:text(source.healthOperation,'PROVIDER_MANIFEST_HEALTH_INVALID'), capabilities,
      permissions:unique(source.permissions,'PROVIDER_MANIFEST_PERMISSION_INVALID'),
      configSchema:text(source.configSchema,'PROVIDER_MANIFEST_SCHEMA_INVALID'),
      eventSubscriptions:unique(source.eventSubscriptions,'PROVIDER_MANIFEST_EVENT_INVALID'),
      secretRefs:unique(source.secretRefs,'PROVIDER_MANIFEST_SECRET_REF_INVALID'), limits:limits(source.limits),
      signature:text(source.signature,'PROVIDER_MANIFEST_SIGNATURE_INVALID') };
    return new Manifest(Object.freeze(manifest));
  }
}

function limits(value: JsonValue | undefined): ProviderLimit {
  const source=object(value,'PROVIDER_LIMITS_INVALID');
  return Object.freeze({ connectionTimeoutMs:integer(source.connectionTimeoutMs,1,30_000,'PROVIDER_CONNECTION_TIMEOUT_INVALID'),
    responseTimeoutMs:integer(source.responseTimeoutMs,1,120_000,'PROVIDER_RESPONSE_TIMEOUT_INVALID'),
    totalDeadlineMs:integer(source.totalDeadlineMs,1,300_000,'PROVIDER_DEADLINE_INVALID'),
    maxConcurrency:integer(source.maxConcurrency,1,64,'PROVIDER_CONCURRENCY_INVALID'),
    requestsPerSecond:range(source.requestsPerSecond,0.01,10_000,'PROVIDER_RATE_INVALID'),
    maxAttempts:integer(source.maxAttempts,1,5,'PROVIDER_ATTEMPTS_INVALID'),
    failureThreshold:integer(source.failureThreshold,1,100,'PROVIDER_FAILURE_THRESHOLD_INVALID'),
    recoveryMs:integer(source.recoveryMs,100,3_600_000,'PROVIDER_RECOVERY_INVALID') });
}
function object(value: unknown, code: string): JsonObject { if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error(code); return value as JsonObject; }
function text(value: JsonValue | undefined, code: string): string { if (typeof value!=='string' || !value.trim()) throw new Error(code); return value.trim(); }
function strings(value: JsonValue | undefined, code: string): string[] { if (!Array.isArray(value) || !value.every((item)=>typeof item==='string' && item.trim())) throw new Error(code); return value.map(String); }
function unique(value: JsonValue | undefined, code: string): string[] { const items=strings(value,code); if (new Set(items).size!==items.length) throw new Error(code); return items; }
function number(value: JsonValue | undefined, code: string): number { if (typeof value!=='number' || !Number.isFinite(value)) throw new Error(code); return value; }
function integer(value: JsonValue | undefined, minimum: number, maximum: number, code: string): number { const item=number(value,code); if (!Number.isInteger(item) || item<minimum || item>maximum) throw new Error(code); return item; }
function range(value: JsonValue | undefined, minimum: number, maximum: number, code: string): number { const item=number(value,code); if (item<minimum || item>maximum) throw new Error(code); return item; }
function literal<T extends string>(value: JsonValue | undefined, expected: T, code: string): T { if (value!==expected) throw new Error(code); return expected; }
