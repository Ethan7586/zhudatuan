import { describe, expect, it, vi } from 'vitest';
import { PgContext } from './PgContext';

const base = Object.freeze({ tenant: 'tenant:1', membership: 'membership:1', scope: 'mall:1', actor: 'member:1', trace: 'trace:1' });

describe('PgContext', () => {
  it('maps query and command transactions to the API database workload', async () => {
    for (const workload of ['query', 'command'] as const) {
      const query = vi.fn().mockResolvedValue({ rows: [] });
      await new PgContext().apply({ query }, { ...base, workload });
      expect(query.mock.calls[0]?.[0]).toContain("set_config('app.workload','api',true)");
    }
  });

  it('maps worker transactions to the jobs database workload', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await new PgContext().apply({ query }, { ...base, workload: 'worker' });
    expect(query.mock.calls[0]?.[0]).toContain("set_config('app.workload','jobs',true)");
    expect(query.mock.calls[0]?.[1]).toEqual(['mall:1']);
  });
});
