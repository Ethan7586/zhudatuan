import { OPERATION_TARGETS, type OperationTarget } from './Surface';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
export const OPERATION_AUDIENCES = ['public', 'console', 'storefront', 'system', 'webhook'] as const;
export type OperationAudience = (typeof OPERATION_AUDIENCES)[number];
export { OPERATION_TARGETS } from './Surface';
export type { OperationTarget } from './Surface';
export type OperationPath = `/api/v1/${string}` | `/health/${string}`;
export type OperationRisk = 'low' | 'elevated' | 'high' | 'critical';
export type OperationConcurrencyPolicy = 'none' | 'optimistic' | 'serialized';
export type OperationExecutionMode = 'sync' | 'async' | 'stream';
export type OperationAuditLevel = 'none' | 'basic' | 'detailed' | 'critical';
export type OperationLifecycle = 'active' | 'deprecated';
export const OPERATION_ASSURANCES = ['anonymous', 'optional', 'preauth', 'session', 'mfa', 'stepup', 'service', 'signed'] as const;
export type OperationAssurance = (typeof OPERATION_ASSURANCES)[number];
export const OPERATION_ORIGIN_POLICIES = ['none', 'sameorigin', 'service', 'signed'] as const;
export type OperationOriginPolicy = (typeof OPERATION_ORIGIN_POLICIES)[number];
export const OPERATION_CSRF_POLICIES = ['none', 'required'] as const;
export type OperationCsrfPolicy = (typeof OPERATION_CSRF_POLICIES)[number];
export const OPERATION_RESPONSE_MODES = ['json', 'redirect', 'empty', 'stream'] as const;
export type OperationResponseMode = (typeof OPERATION_RESPONSE_MODES)[number];
export const OPERATION_CACHE_POLICIES = ['none', 'private', 'etag'] as const;
export type OperationCachePolicy = (typeof OPERATION_CACHE_POLICIES)[number];
export const OPERATION_TARGET_POLICIES = ['public', 'exact', 'service', 'webhook'] as const;
export type OperationTargetPolicy = (typeof OPERATION_TARGET_POLICIES)[number];
export const OPERATION_IDEMPOTENCY_POLICIES = ['none', 'required', 'provider'] as const;
export type OperationIdempotencyPolicy = (typeof OPERATION_IDEMPOTENCY_POLICIES)[number];
export type OperationIdempotencyScope = 'none' | 'actor-operation-scope' | 'provider-operation';
export type OperationVersionPolicy = 'none' | 'required';
export type OperationRateClass = 'health' | 'identity' | 'read' | 'write' | 'critical' | 'webhook';
export const OPERATION_SCOPE_KINDS = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'store', 'supplier', 'brand', 'self', 'owner'] as const;
export type OperationScopeKind = (typeof OPERATION_SCOPE_KINDS)[number];

interface OperationPolicy {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly path: OperationPath;
  readonly module: string;
  readonly audience: OperationAudience;
  readonly targets: readonly OperationTarget[];
  readonly permission: string | null;
  readonly capability: string;
  readonly scopeKinds: readonly OperationScopeKind[];
  readonly assuranceLevel: OperationAssurance;
  readonly makerChecker: boolean;
  readonly originPolicy: OperationOriginPolicy;
  readonly csrfPolicy: OperationCsrfPolicy;
  readonly responseMode: OperationResponseMode;
  readonly cachePolicy: OperationCachePolicy;
  readonly targetPolicy: OperationTargetPolicy;
  readonly idempotencyPolicy: OperationIdempotencyPolicy;
  readonly requestSchema: string;
  readonly responseSchema: string;
  readonly errorUnion: readonly string[];
  readonly timeout: number;
  readonly rateClass: OperationRateClass;
  readonly risk: OperationRisk;
  readonly concurrencyPolicy: OperationConcurrencyPolicy;
  readonly executionMode: OperationExecutionMode;
  readonly auditLevel: OperationAuditLevel;
  readonly sensitiveFields: readonly string[];
  readonly lifecycle: OperationLifecycle;
  readonly resourceResolver: string;
  readonly resourceParameter: string | null;
  readonly idempotent: boolean;
  readonly requirements: readonly string[];
}

export interface QueryOperation extends OperationPolicy {
  readonly method: 'GET';
  readonly idempotencyScope: 'none';
  readonly expectedVersion: 'none';
}

export interface PlainCommandOperation extends OperationPolicy {
  readonly method: Exclude<HttpMethod, 'GET'>;
  readonly idempotencyScope: 'none';
  readonly expectedVersion: 'none';
}

export interface IdempotentCommandOperation extends OperationPolicy {
  readonly method: Exclude<HttpMethod, 'GET'>;
  readonly idempotencyScope: Exclude<OperationIdempotencyScope, 'none'>;
  readonly expectedVersion: 'none';
}

export interface VersionedCommandOperation extends OperationPolicy {
  readonly method: Exclude<HttpMethod, 'GET'>;
  readonly idempotencyScope: Exclude<OperationIdempotencyScope, 'none'>;
  readonly expectedVersion: 'required';
}

export type Operation = QueryOperation | PlainCommandOperation | IdempotentCommandOperation | VersionedCommandOperation;

export function operation<const T extends Operation>(definition: T): Readonly<T> {
  if (!/^[a-z]+(?:\.[a-z]+)+$/.test(definition.id)) throw new Error('OPERATION_ID_INVALID');
  if (!definition.path.startsWith('/api/v1/') && !definition.path.startsWith('/health/')) throw new Error('OPERATION_PATH_INVALID');
  if (!Number.isInteger(definition.timeout) || definition.timeout < 1) throw new Error('OPERATION_TIMEOUT_INVALID');
  if (!Number.isSafeInteger(definition.version) || definition.version < 1) throw new Error('OPERATION_VERSION_INVALID');
  if (definition.title.trim().length < 2) throw new Error('OPERATION_TITLE_INVALID');
  if (definition.capability !== definition.id) throw new Error('OPERATION_CAPABILITY_INVALID');
  if (definition.targets.some((target) => !(OPERATION_TARGETS as readonly string[]).includes(target)) || new Set(definition.targets).size !== definition.targets.length) throw new Error('OPERATION_TARGET_INVALID');
  if (definition.scopeKinds.some((kind) => !(OPERATION_SCOPE_KINDS as readonly string[]).includes(kind))) throw new Error('OPERATION_SCOPE_KIND_INVALID');
  return Object.freeze({
    ...definition,
    targets: Object.freeze([...definition.targets]),
    scopeKinds: Object.freeze([...definition.scopeKinds]),
    errorUnion: Object.freeze([...definition.errorUnion]),
    sensitiveFields: Object.freeze([...definition.sensitiveFields]),
    requirements: Object.freeze([...definition.requirements]),
  }) as Readonly<T>;
}
