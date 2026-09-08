import { describe, expect, it, vi } from 'vitest';
import { PgSupportContextRepository } from './PgSupportContextRepository';

describe('PgSupportContextRepository agent labels', () => {
  it('resolves visible memberships and member names in two bounded batches', async () => {
    const summaries = vi.fn(async () => [
      { membership: 'membership:one', member: 'member:one', employeeNo: 'E1001' },
      { membership: 'membership:two', member: 'member:two', employeeNo: null },
    ]);
    const profiles = vi.fn(async () => [{ member: 'member:one', displayName: '王客服', mobileMasked: '138****0000' }]);
    const repository = new PgSupportContextRepository({} as never, {} as never, {} as never, { summaries } as never, {} as never, { profiles } as never);

    await expect(repository.agentLabels({} as never, ['membership:one', 'membership:two'], 'mall:one')).resolves.toEqual([
      { membership: 'membership:one', displayName: '王客服' },
      { membership: 'membership:two', displayName: '未命名客服' },
    ]);
    expect(summaries).toHaveBeenCalledWith({}, ['membership:one', 'membership:two'], 'mall:one');
    expect(profiles).toHaveBeenCalledWith({}, ['member:one', 'member:two'], 'mall:one');
  });
});
