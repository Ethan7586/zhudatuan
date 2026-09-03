import { describe, expect, it } from 'vitest';
import { queryCondition } from './QueryState';

describe('queryCondition', () => {
  it.each([
    [{ pending: true, fetching: false, error: null, empty: true }, 'loading'],
    [{ pending: false, fetching: true, error: null, empty: false }, 'refreshing'],
    [{ pending: false, fetching: false, error: null, empty: true }, 'empty'],
    [{ pending: false, fetching: false, error: null, empty: false }, 'ready'],
    [{ pending: false, fetching: false, error: { kind: 'transport', code: 'OFFLINE', retryable: true }, empty: true }, 'offline'],
    [{ pending: false, fetching: false, error: { kind: 'api', code: 'PERMISSION_DENIED', retryable: false }, empty: true }, 'denied'],
    [{ pending: false, fetching: false, error: { kind: 'api', code: 'RESOURCE_NOT_FOUND', retryable: false }, empty: true }, 'notfound'],
    [{ pending: false, fetching: false, error: { kind: 'api', code: 'VERSION_CONFLICT', retryable: false }, empty: true }, 'conflict'],
    [{ pending: false, fetching: false, error: { kind: 'api', code: 'RATE_LIMITED', retryable: true }, empty: true }, 'ratelimited'],
    [{ pending: false, fetching: true, error: { kind: 'transport', code: 'TIMEOUT', retryable: true }, empty: true }, 'retry'],
    [{ pending: false, fetching: false, error: { kind: 'transport', code: 'OFFLINE', retryable: true }, hasData: true, empty: false }, 'stale'],
    [{ pending: false, fetching: false, error: new TypeError('Failed to fetch'), empty: true }, 'failure'],
  ] as const)('maps %o to %s', (input, condition) => expect(queryCondition(input)).toBe(condition));
});
