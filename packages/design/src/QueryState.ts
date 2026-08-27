import type { ResourceCondition } from './ResourceState';

export interface QueryStateInput {
  readonly pending: boolean;
  readonly fetching: boolean;
  readonly error: unknown;
  readonly empty: boolean;
}

export function queryCondition(state: QueryStateInput): ResourceCondition {
  if (state.error !== null && state.error !== undefined) {
<<<<<<< HEAD
    const status = responseStatus(state.error);
    if (status === 401) return 'unauthenticated';
    if (status === 403) return 'denied';
    if (state.fetching) return 'retry';
    if (!state.empty) return 'stale';
=======
    if (state.fetching) return 'retry';
    if (!state.empty) return 'stale';
    const status = responseStatus(state.error);
    if (status === 403) return 'denied';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    if (status === 404) return 'notfound';
    if (status === 409 || status === 412) return 'conflict';
    if (status === 429) return 'ratelimited';
    if (state.error instanceof TypeError && typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    return 'failure';
  }
  if (state.pending) return 'loading';
  if (state.empty) return 'empty';
  if (state.fetching) return 'refreshing';
  return 'ready';
}

function responseStatus(error: unknown): number | undefined {
  return error !== null && typeof error === 'object' && 'status' in error ? Number(error.status) : undefined;
}
