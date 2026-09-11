export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
export type OperationAudience = 'public' | 'member' | 'operator' | 'provider';
export type OperationAvailability = 'runtime' | 'frozen';
export type OperationExecution = 'sync' | 'async';
export type OperationIdempotency = 'none' | 'required';
export type OperationPath = `/api/v1/${string}` | `/health/${string}`;
export type OperationRisk = 'low' | 'elevated' | 'high' | 'critical';
export type OperationSchemaFidelity = 'named' | 'structural';
export type OperationVersionPolicy = 'none' | 'optional' | 'required';
export type OperationWritePath = 'none' | 'transactional' | 'durable' | 'provider';
export type OperationNodeProfile = 'operating_mall' | 'consumer';

const OPERATION_GATE_SLOTS = ['identity', 'permission', 'risk', 'finance'] as const;
const OPERATION_GATE_PHASES = ['before'] as const;
const OPERATION_GATE_MODES = ['disabled', 'observe'] as const;

export type OperationGateSlot = (typeof OPERATION_GATE_SLOTS)[number];
export type OperationGatePhase = (typeof OPERATION_GATE_PHASES)[number];
export type OperationGateMode = (typeof OPERATION_GATE_MODES)[number];

export interface OperationGateDeclaration {
  readonly slot: OperationGateSlot;
  readonly phase: OperationGatePhase;
  readonly mode: OperationGateMode;
}

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
  readonly execution: OperationExecution;
  readonly availability: OperationAvailability;
  readonly summary: string;
  readonly risk: OperationRisk;
  readonly stepup: boolean;
  readonly scopeKinds: readonly string[];
  readonly schema: OperationSchemaFidelity;
  readonly title?: string;
  readonly targets?: readonly string[];
  readonly node_profiles_allowed?: readonly OperationNodeProfile[];
  readonly requestSchema?: string;
  readonly responseSchema?: string;
  readonly errorUnion?: readonly string[];
  readonly capability?: string;
  readonly scope_resolver_ref?: string;
  readonly idempotencyScope?: string;
  readonly assuranceLevel?: number;
  readonly makerChecker?: boolean;
  readonly sensitiveFields?: readonly string[];
  readonly csrfPolicy?: 'none' | 'session';
  readonly originPolicy?: 'public' | 'same-node';
  readonly targetPolicy?: 'public' | 'resolved-node';
  readonly responseMode?: 'json' | 'empty';
  readonly cachePolicy?: 'none' | 'private' | 'public';
  readonly rateClass?: 'low' | 'elevated' | 'high' | 'critical';
  readonly timeout?: number;
  readonly sdk?: string;
  readonly writePath?: OperationWritePath;
  readonly stateMachine?: string;
  readonly businessNumber?: string;
  readonly operationHash?: string;
  readonly requirements: readonly string[];
  readonly gates?: readonly OperationGateDeclaration[] | undefined;
}

function validateOperationGate(gate: OperationGateDeclaration): void {
  if (!OPERATION_GATE_SLOTS.includes(gate.slot)) throw new Error('OPERATION_GATE_SLOT_INVALID');
  if (!OPERATION_GATE_PHASES.includes(gate.phase)) throw new Error('OPERATION_GATE_PHASE_INVALID');
  if (!OPERATION_GATE_MODES.includes(gate.mode)) throw new Error('OPERATION_GATE_MODE_INVALID');
}

export function operation<const T extends Operation>(
  definition: T,
): Readonly<T> & Operation {
  if (!/^[a-z]+(?:\.[a-z]+)+$/.test(definition.id)) throw new Error('OPERATION_ID_INVALID');
  if (!definition.path.startsWith('/api/v1/') && !definition.path.startsWith('/health/')) throw new Error('OPERATION_PATH_INVALID');
  if (definition.summary.trim().length === 0) throw new Error('OPERATION_SUMMARY_INVALID');

  const gates = definition.gates === undefined
    ? {}
    : {
        gates: Object.freeze(definition.gates.map((gate) => {
          validateOperationGate(gate);
          return Object.freeze({ ...gate });
        })),
      };

  return Object.freeze({
    ...definition,
    ...gates,
    scopeKinds: Object.freeze([...definition.scopeKinds]),
    ...(definition.targets === undefined ? {} : { targets: Object.freeze([...definition.targets]) }),
    ...(definition.node_profiles_allowed === undefined ? {} : { node_profiles_allowed: Object.freeze([...definition.node_profiles_allowed]) }),
    ...(definition.errorUnion === undefined ? {} : { errorUnion: Object.freeze([...definition.errorUnion]) }),
    ...(definition.sensitiveFields === undefined ? {} : { sensitiveFields: Object.freeze([...definition.sensitiveFields]) }),
    requirements: Object.freeze([...definition.requirements]),
  }) as Readonly<T> & Operation;
}
