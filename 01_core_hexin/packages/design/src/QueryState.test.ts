import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryCondition } from './QueryState';

describe('query resource state', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [{ pending: true, fetching: true, error: null, empty: true }, 'loading'],
    [{ pending: false, fetching: false, error: null, empty: true }, 'empty'],
    [{ pending: false, fetching: false, error: null, empty: false }, 'ready'],
    [{ pending: false, fetching: true, error: null, empty: false }, 'refreshing'],
    [{ pending: false, fetching: true, error: new Error(), empty: false }, 'retry'],
    [{ pending: false, fetching: false, error: new Error(), empty: false }, 'stale'],
    [{ pending: false, fetching: false, error: { status: 403 }, empty: true }, 'denied'],
    [{ pending: false, fetching: false, error: { status: 404 }, empty: true }, 'notfound'],
    [{ pending: false, fetching: false, error: { status: 412 }, empty: true }, 'conflict'],
    [{ pending: false, fetching: false, error: { status: 429 }, empty: true }, 'ratelimited'],
    [{ pending: false, fetching: false, error: new Error(), empty: true }, 'failure'],
  ] as const)('maps %o to %s', (input, condition) => expect(queryCondition(input)).toBe(condition));

  it('maps an offline transport failure without hiding an HTTP failure', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(queryCondition({ pending: false, fetching: false, error: new TypeError('Failed to fetch'), empty: true })).toBe('offline');
    expect(queryCondition({ pending: false, fetching: false, error: { status: 403 }, empty: true })).toBe('denied');
  });
});
