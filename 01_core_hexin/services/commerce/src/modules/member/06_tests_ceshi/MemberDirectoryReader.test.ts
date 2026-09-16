import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { readMemberDirectory } from '../03_application_yingyong/MemberDirectoryReader';

describe('shared member directory reader', () => {
  it('uses the same MB-only query with each node database and local scope', async () => {
    const statements: string[] = [];
    for (const scope of ['mall:zhudatuan', 'mall:hbbtzn', 'mall:h6'] as const) {
      const query = vi.fn(async (_sql: string, _values: readonly unknown[]) => ({ rows: [{ membership_id: scope }] }));
      const result = await readMemberDirectory({ query } as unknown as OperationDatabase, scope, '王小明', null, 25, null);
      const [sql, values] = query.mock.calls[0]!;
      statements.push(sql);
      expect(values).toEqual([scope, '王小明', null, 25, null]);
      expect(result.rows).toEqual([{ membership_id: scope }]);
    }
    expect(new Set(statements).size).toBe(1);
    expect(statements[0]).toContain("membership.client='storefront'");
    expect(statements[0]).toContain('membership.organization_id=$1');
  });
});
