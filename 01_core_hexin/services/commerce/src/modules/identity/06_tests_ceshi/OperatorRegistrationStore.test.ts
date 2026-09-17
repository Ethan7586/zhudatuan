import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { createOperatorRegistration } from '../04_adapters_shixian/persistence_cunchu/OperatorRegistrationStore';

describe('operator registration store', () => {
  it('creates an operator identity without creating a storefront membership', async () => {
    const query = vi.fn(async (text: string, _values: readonly unknown[] = []) => result(text.includes("'operator'") && text.includes('returning *')
      ? [{ id: 'membership:operator', client: 'operator', status: 'active' }] : []));

    await expect(createOperatorRegistration({ query } as unknown as OperationDatabase, {
      operatorMembership: 'membership:operator', governanceParentMembership: 'membership:owner',
      member: 'member:one', principal: 'principal:one', realm: 'realm:l1', account: 'account:one',
      operatorOrganization: 'mall:one', managementOrganization: 'tenant:one', operatorRole: 'role:senior',
      operatorDisplayName: '李厚亿',
      operatorScopes: ['scope:tenant', 'scope:self'],
    })).resolves.toMatchObject({ id: 'membership:operator', client: 'operator' });

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.some(([text]) => String(text).includes("'storefront'"))).toBe(false);
    expect(query.mock.calls[0]?.[0]).toContain('operator_display_name');
    expect(query.mock.calls[0]?.[1]).toContain('mall:one');
    expect(query.mock.calls[0]?.[1]).toContain('李厚亿');
    expect(query.mock.calls[2]?.[1]).toContain('mall:one');
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
