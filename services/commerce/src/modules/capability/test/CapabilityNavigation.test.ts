import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { withReadTransaction } from '../../../test/TransactionFixture';
import { PgNavigationCapability } from '../infrastructure/persistence/PgNavigationCapability';

describe('capability navigation projection', () => {
  it('binds the requested surface and returns a monotonic capability-set version', async () => {
    let sql = '';
    let values: readonly unknown[] = [];
    const result = await withReadTransaction(
      async (statement, parameters = []) => {
        sql = statement;
        values = parameters;
        return {
          rows: [
            { scope_id: 'mall:one', capability_code: 'catalog.products.read', capability_version: '18' },
            { scope_id: 'mall:one', capability_code: 'surface.console', capability_version: '18' },
          ],
          rowCount: 2,
        } as unknown as QueryResult;
      },
      (context) => new PgNavigationCapability().read(context, ['mall:one'], 'console')
    );

    expect(sql).toContain('capability.navigation_capabilities($1,$2)');
    expect(values).toEqual([['mall:one'], 'console']);
    expect(result[0]?.version).toBe(18);
    expect(result[0]?.capabilities).toEqual(new Set(['catalog.products.read', 'surface.console']));
  });

  it('returns a closed empty set for a scope with no surface-ready capabilities', async () => {
    const result = await withReadTransaction(
      async () => ({ rows: [], rowCount: 0 }) as unknown as QueryResult,
      (context) => new PgNavigationCapability().read(context, ['mall:closed'], 'supplier')
    );
    expect(result).toEqual([{ scope: 'mall:closed', capabilities: new Set(), version: 0 }]);
  });
});
