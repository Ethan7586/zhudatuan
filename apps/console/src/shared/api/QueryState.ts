import type { ResourceCondition } from '@shop/design';
import { ApiError } from '@shop/sdk';

export interface QueryStateInput {
  readonly pending: boolean;
  readonly fetching: boolean;
  readonly error: Error | null;
  readonly hasData: boolean;
  readonly empty: boolean;
  readonly stale: boolean;
}

export function queryCondition(input: QueryStateInput): ResourceCondition {
  if (input.pending) return 'loading';
  if (input.error !== null) {
    const condition = errorCondition(input.error);
    if (condition === 'unauthenticated' || condition === 'denied') return condition;
    if (input.fetching) return 'retry';
    if (input.hasData && (condition === 'offline' || condition === 'failure')) return 'stale';
    return condition;
  }
  if (!input.hasData || input.empty) return 'empty';
  if (input.fetching) return 'refreshing';
  if (input.stale) return 'stale';
  return 'ready';
}

export function safeQueryError(error: Error | null): string | undefined {
  if (error === null) return undefined;
  const api = apiError(error);
  if (api !== null) return `${api.code} · 请求 ${api.requestId}`;
  return online() ? 'REQUEST_FAILED' : 'NETWORK_OFFLINE';
}

function errorCondition(error: Error): ResourceCondition {
  const api = apiError(error);
  if (api?.status === 401) return 'unauthenticated';
  if (api?.status === 403) return 'denied';
  if (!online()) return 'offline';
  if (api === null) return 'failure';
  if (api.status === 401) return 'unauthenticated';
  if (api.status === 403) return 'denied';
  if (api.status === 404) return 'notfound';
  if (api.status === 409 || api.status === 412) return 'conflict';
  if (api.status === 429) return 'ratelimited';
  return 'failure';
}

function apiError(error: Error): Pick<ApiError, 'code' | 'requestId' | 'status'> | null {
  if (error instanceof ApiError) return error;
  const value = error as Error & Partial<Pick<ApiError, 'code' | 'requestId' | 'status'>>;
  return value.name === 'ApiError' && typeof value.code === 'string' && typeof value.requestId === 'string' && typeof value.status === 'number' ? (value as Pick<ApiError, 'code' | 'requestId' | 'status'>) : null;
}

function online(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' || navigator.onLine;
}
