import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { PgSupportRepository } from '../../04_adapters_shixian/persistence/PgSupportRepository';

describe('PgSupportRepository', () => {
  it('gives history projection parameters an explicit SQL type', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PgSupportRepository({ query } as unknown as OperationDatabase, {} as never);

    await repository.history('case:one', 'mall:one', 'opened', 'actor:one', { priority: 'normal' });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('$2::text'), [
      'case:one', 'mall:one', 'opened', 'actor:one', JSON.stringify({ priority: 'normal' }),
    ]);
  });
});
