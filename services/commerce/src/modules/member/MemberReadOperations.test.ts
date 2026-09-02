import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { memberOperatorReadActions } from './MemberReadOperations';

describe('member directory scope boundary', () => {
  it('reads members from the complete organization subtree while preserving keyset pagination', async () => {
    const query = vi.fn(async (_sql: string, _values: readonly unknown[] = []) =>
      result([{ id: 'member:one', membership_id: 'membership:one', directory_sort: '2026-09-02T03:28:35.000000Z' }]));
    const action = memberOperatorReadActions()['member.members.read'];
    if (typeof action !== 'function') throw new Error('MEMBER_READ_ACTION_MISSING');

    const response = await action(request(), { query } as unknown as OperationDatabase);

    expect(response).toMatchObject({ status: 200, body: { count: 1, items: [{ id: 'member:one' }] } });
    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('from organization.unitclosure boundary');
    expect(sql).toContain('boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id');
    expect(sql).not.toContain('where membership.organization_id=$1');
    expect(sql).toContain('(anchor.directory_sort,anchor.id)<($2::text,$3::text)');
    expect(sql).toContain('order by anchor.directory_sort desc,anchor.id desc');
    expect(values).toEqual(['organization-platform-root', null, null, 51, 'principal:owner', 'membership:owner']);
  });

  it('lists only scoped operator invitations without returning recoverable invitation secrets', async () => {
    const query = vi.fn(async (_sql: string, _values: readonly unknown[] = []) => result([{
      id: 'invite:one', scope: 'tenant-zhudatuan', scope_name: '主打团', label: '高级管理员邀请',
      governance_level: 'senior_administrator', created_by: 'membership:owner', created_by_name: 'Ethan',
      max_uses: 1, use_count: 0, starts_at: '2026-09-02T12:00:00.000Z', expires_at: '2026-09-09T12:00:00.000Z',
      accepted_at: null, status: 'active', created_at: '2026-09-02T12:00:00.000Z', version: 0,
    }]));
    const action = memberOperatorReadActions()['member.invitations.read'];
    if (typeof action !== 'function') throw new Error('MEMBER_INVITATION_READ_ACTION_MISSING');

    const response = await action(invitationRequest(), { query } as unknown as OperationDatabase);

    expect(response).toMatchObject({ status: 200, body: { count: 1, items: [{ id: 'invite:one', status: 'active' }] } });
    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain("invitation.target_client='operator'");
    expect(sql).toContain('boundary.ancestor_id=$1 and boundary.descendant_id=invitation.organization_id');
    expect(sql).toContain('(invitation.created_at,invitation.id)<($2::timestamptz,$3::text)');
    expect(sql).toContain('order by invitation.created_at desc,invitation.id desc');
    expect(sql).not.toContain('token_hash');
    expect(sql).not.toContain('destination_hash');
    expect(sql).not.toContain('allowed_destination_hash');
    expect(values).toEqual(['organization-platform-root', null, null, 51]);
  });
});

function request(): OperationRequest {
  return {
    type: 'member.members.read',
    access: {
      scope: { id: 'organization-platform-root' },
      actor: { id: 'principal:owner' },
      governance: { ownerMembershipId: 'membership:owner' },
    },
    input: {
      path: {}, query: {}, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
    },
  } as unknown as OperationRequest;
}

function invitationRequest(): OperationRequest {
  return {
    type: 'member.invitations.read',
    access: { scope: { id: 'organization-platform-root' } },
    input: {
      path: {}, query: {}, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
    },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
