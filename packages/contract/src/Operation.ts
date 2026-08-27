export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
export type OperationAudience = 'public' | 'member' | 'operator' | 'provider';
export type OperationIdempotency = 'none' | 'required';
export type OperationPath = `/api/v1/${string}` | `/health/${string}`;
export type OperationRisk = 'low' | 'elevated' | 'high' | 'critical';
export type OperationSchemaFidelity = 'exact' | 'structural';
export type OperationVersionPolicy = 'none' | 'optional' | 'required';

export interface Operation {
  readonly id: string;
  readonly method: HttpMethod;
  readonly path: OperationPath;
  readonly module: string;
  readonly audience: OperationAudience;
  readonly permission?: string;
  readonly idempotent: boolean;
  readonly idempotency: OperationIdempotency;
  readonly expectedVersion: OperationVersionPolicy;
  readonly risk: OperationRisk;
  readonly stepup: boolean;
  readonly scopeKinds: readonly string[];
  readonly schema: OperationSchemaFidelity;
  readonly requirements: readonly string[];
}

export function operation<const T extends Operation>(definition: T): Readonly<T> {
  if (!/^[a-z]+(?:\.[a-z]+)+$/.test(definition.id)) throw new Error('OPERATION_ID_INVALID');
  if (!definition.path.startsWith('/api/v1/') && !definition.path.startsWith('/health/')) throw new Error('OPERATION_PATH_INVALID');
  return Object.freeze({
    ...definition,
    scopeKinds: Object.freeze([...definition.scopeKinds]),
    requirements: Object.freeze([...definition.requirements]),
  });
}
