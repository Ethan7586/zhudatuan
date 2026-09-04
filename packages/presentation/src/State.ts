import { failure, type Failure } from './Failure';
import { errorPolicy } from './generated/ErrorPolicy';

export interface Receipt {
  readonly requestId: string;
  readonly reference: string;
  readonly occurredAt: string;
  readonly message: string;
  readonly next?: Readonly<{ label: string; target: string }>;
}

export type ResourceState<T> =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'ready'; data: T; refreshing: boolean }>
  | Readonly<{ kind: 'empty' }>
  | Readonly<{ kind: 'stale'; data: T; updatedAt: string; failure: Failure }>
  | Readonly<{ kind: 'forbidden'; failure: Failure }>
  | Readonly<{ kind: 'unavailable'; failure: Failure }>
  | Readonly<{ kind: 'notconfigured'; failure: Failure }>
  | Readonly<{ kind: 'notfound'; failure: Failure }>
  | Readonly<{ kind: 'failed'; failure: Failure }>;

export type ResourceCondition = 'loading' | 'ready' | 'empty' | 'refreshing' | 'stale' | 'forbidden' | 'unavailable' | 'notconfigured' | 'notfound' | 'conflict' | 'ratelimited' | 'offline' | 'failure' | 'retry';

export type ActionState<T = Receipt> =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'submitting'; commandId: string }>
  | Readonly<{ kind: 'partial'; result: T; message: string }>
  | Readonly<{ kind: 'success'; result: T }>
  | Readonly<{ kind: 'expired'; message: string }>
  | Readonly<{ kind: 'failed'; failure: Failure }>;

export interface ResourceInput<T> {
  readonly pending: boolean;
  readonly fetching: boolean;
  readonly data?: T;
  readonly empty: boolean;
  readonly error?: unknown;
  readonly updatedAt?: string;
}

export function resourceState<T>(input: ResourceInput<T>): ResourceState<T> {
  if (input.pending && input.data === undefined) return Object.freeze({ kind: 'loading' });
  if (input.error !== undefined && input.error !== null) {
    const value = safeFailure(input.error);
    if (input.data !== undefined) return Object.freeze({ kind: 'stale', data: input.data, updatedAt: input.updatedAt ?? new Date(0).toISOString(), failure: value });
    if (value.kind === 'api' && (value.code === 'AUTHORIZATION_DENIED' || value.code === 'PERMISSION_DENIED' || value.code === 'SCOPE_DENIED' || value.code === 'CAPABILITY_DENIED')) {
      return Object.freeze({ kind: 'forbidden', failure: value });
    }
    if (value.code.endsWith('_NOT_CONFIGURED')) return Object.freeze({ kind: 'notconfigured', failure: value });
    if (value.kind === 'api' && (value.code === 'RESOURCE_NOT_FOUND' || value.code.endsWith('_NOT_FOUND'))) return Object.freeze({ kind: 'notfound', failure: value });
    const policy = errorPolicy(value.code);
    if ((value.kind === 'transport' && value.code !== 'OFFLINE') || (policy?.kind === 'api' && policy.status >= 502)) return Object.freeze({ kind: 'unavailable', failure: value });
    return Object.freeze({ kind: 'failed', failure: value });
  }
  if (input.empty) return Object.freeze({ kind: 'empty' });
  if (input.data === undefined) return Object.freeze({ kind: 'loading' });
  return Object.freeze({ kind: 'ready', data: input.data, refreshing: input.fetching });
}

export function resourceCondition<T>(state: ResourceState<T>): ResourceCondition {
  if (state.kind === 'ready') return state.refreshing ? 'refreshing' : 'ready';
  return state.kind === 'failed' ? 'failure' : state.kind;
}

export function presentResourceCondition(condition: ResourceCondition): string {
  if (condition === 'loading') return '读取中';
  if (condition === 'refreshing' || condition === 'retry') return '更新中';
  if (condition === 'ready' || condition === 'empty') return '已同步';
  return '需处理';
}

export function actionState<T>(input: Readonly<{ pending: boolean; commandId: string; result?: T; error?: unknown }>): ActionState<T> {
  if (input.pending) return Object.freeze({ kind: 'submitting', commandId: input.commandId });
  if (input.error !== undefined && input.error !== null) return Object.freeze({ kind: 'failed', failure: failure(input.error) });
  if (input.result !== undefined) return Object.freeze({ kind: 'success', result: input.result });
  return Object.freeze({ kind: 'idle' });
}

function safeFailure(cause: unknown): Failure {
  return failure(cause);
}
