import { describe, expect, it, vi } from 'vitest';
import type { DatabasePool } from '../platform/database/Pool';
import { apiQueryPool } from './Application';

describe('CommerceApplication workload boundary', () => {
  it('does not request an API query pool while composing the jobs runtime', () => {
    const pool = databasePool();
    expect(apiQueryPool(pool, 'jobs')).toBeNull();
    expect(pool.workload).not.toHaveBeenCalled();
  });

  it('selects the dedicated query pool while composing the API runtime', () => {
    const selected = databasePool();
    const pool = databasePool(selected);
    expect(apiQueryPool(pool, 'api')).toBe(selected);
    expect(pool.workload).toHaveBeenCalledExactlyOnceWith('query');
  });
});

function databasePool(selected?: DatabasePool): DatabasePool {
  const pool = {
    connect: vi.fn(),
    query: vi.fn(),
    workload: vi.fn(),
    end: vi.fn(),
  } as unknown as DatabasePool;
  vi.mocked(pool.workload).mockReturnValue(selected ?? pool);
  return pool;
}
