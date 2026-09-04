import { failure } from './Failure';
import { errorPolicy } from './generated/ErrorPolicy';

export type QueryCondition = 'loading' | 'refreshing' | 'ready' | 'empty' | 'failure' | 'retry' | 'stale' | 'offline' | 'forbidden' | 'unavailable' | 'notconfigured' | 'notfound' | 'conflict' | 'ratelimited';

export interface QueryStateInput {
  readonly pending: boolean;
  readonly fetching: boolean;
  readonly error: unknown;
  readonly hasData?: boolean;
  readonly empty: boolean;
}

export function queryCondition(state: QueryStateInput): QueryCondition {
  if (state.pending) return 'loading';
  if (state.error !== null && state.error !== undefined) {
    if (state.fetching) return 'retry';
    const condition = failureCondition(state.error);
    if ((state.hasData ?? !state.empty) && (condition === 'offline' || condition === 'failure')) return 'stale';
    return condition;
  }
  if (state.empty) return 'empty';
  if (state.fetching) return 'refreshing';
  return 'ready';
}

function failureCondition(cause: unknown): QueryCondition {
  const value = failure(cause);
  if (value.kind === 'transport' && value.code === 'OFFLINE') return 'offline';
  if (value.code.endsWith('_NOT_CONFIGURED')) return 'notconfigured';
  const policy = errorPolicy(value.code);
  const status = policy?.kind === 'api' ? policy.status : undefined;
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'notfound';
  if (status === 409) return 'conflict';
  if (status === 429) return 'ratelimited';
  if ((value.kind === 'transport' && ['TIMEOUT', 'UNAVAILABLE'].includes(value.code)) || (status !== undefined && status >= 502 && status <= 504)) return 'unavailable';
  return 'failure';
}
