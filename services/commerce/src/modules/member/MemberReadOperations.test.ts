import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { memberOperatorReadActions } from './MemberReadOperations';

describe('member directory scope boundary', () => {
  it('reads members from the complete organization subtree while preserving keyset pagination', async () => {
    const query = vi.fn(async (_sql: string, _values: readonly unknown[] = []) =>
      result([{ id: 'member:one', membership_id: 'membership:one' }]));
    const action = memberOperatorReadActions()['member.members.read'];
    if (typeof action !== 'function') throw new Error('MEMBER_READ_ACTION_MISSING');

    const response = await action(request(), { query } as unknown as OperationDatabase);

    expect(response).toMatchObject({ status: 200, body: { count: 1, items: [{ id: 'member:one' }] } });
    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('from organization.unitclosure boundary');
    expect(sql).toContain('boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id');
    expect(sql).not.toContain('where membership.organization_id=$1');
    expect(values).toEqual(['organization-platform-root', null, 51, 'principal:owner']);
  });
});

function request(): OperationRequest {
  return {
    type: 'member.members.read',
    access: {
      scope: { id: 'organization-platform-root' },
      actor: { id: 'principal:owner' },
    },
    input: {
      path: {}, query: {}, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
    },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
