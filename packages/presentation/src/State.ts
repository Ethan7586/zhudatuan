import { failure, type Failure } from './Failure';

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
  | Readonly<{ kind: 'denied'; failure: Failure }>
  | Readonly<{ kind: 'failed'; failure: Failure }>;

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
      return Object.freeze({ kind: 'denied', failure: value });
    }
    return Object.freeze({ kind: 'failed', failure: value });
  }
  if (input.empty) return Object.freeze({ kind: 'empty' });
  if (input.data === undefined) return Object.freeze({ kind: 'loading' });
  return Object.freeze({ kind: 'ready', data: input.data, refreshing: input.fetching });
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
