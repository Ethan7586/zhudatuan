// @vitest-environment node
import { ApiError } from '@shop/sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryCondition } from './QueryState';

afterEach(() => vi.unstubAllGlobals());

describe('queryCondition authorization priority', () => {
  it('keeps an authoritative 403 fail-closed when the browser also reports offline', () => {
    vi.stubGlobal('navigator', { onLine: false });

    expect(queryCondition({
      pending: false,
      fetching: false,
      error: new ApiError('PERMISSION_DENIED', 403, 'request:offline-denied'),
      hasData: true,
      empty: false,
      stale: true,
    })).toBe('denied');
  });

  it('still preserves cached data for a genuine offline transport failure', () => {
    vi.stubGlobal('navigator', { onLine: false });

    expect(queryCondition({
      pending: false,
      fetching: false,
      error: new TypeError('Failed to fetch'),
      hasData: true,
      empty: false,
      stale: true,
    })).toBe('stale');
  });
});
