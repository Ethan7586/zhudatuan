import type { QueryResult, QueryResultRow } from 'pg';
import { describe, expect, it } from 'vitest';
import type { AccessContext } from '../../../foundation/security/AccessContext';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import type { OperationAction, OperationDatabase } from '../../../foundation/application/ModuleOperations';
import {
  administratorSegmentReadActions,
  administratorSegmentWriteActions,
} from '../03_application_yingyong/AdministratorSegmentOperations';

describe('administrator segment operations', () => {
  it('uses the same authoritative administrator context for list, detail and member write', async () => {
    const harness = database();
    const list = action(administratorSegmentReadActions(), 'access.administrators.members.read');
    const detail = action(administratorSegmentReadActions(), 'access.administrators.member.read');
    const note = action(administratorSegmentWriteActions(), 'access.administrators.members.note');

    await expect(list(request('access.administrators.members.read'), harness.database)).resolves.toMatchObject({ status: 200 });
    await expect(detail(request('access.administrators.member.read', 'node:a:l3'), harness.database)).resolves.toMatchObject({
      status: 200, body: { node_id: 'node:a:l3', signed_level: 'L3' },
    });
    await expect(note(request('access.administrators.members.note', 'node:a:l3', { note: '已复核' }), harness.database))
      .resolves.toMatchObject({ status: 201, body: { target_node_id: 'node:a:l3' } });
    expect(harness.queries.filter((query) => query.includes('resolve_administrator_context')).length).toBe(3);
    expect(harness.queries).toContain('select * from access.list_administrator_members($1,$2,$3)');
    expect(harness.queries).toContain('select * from access.read_administrator_member($1,$2)');
    expect(harness.queries.some((query) => query.includes('record_administrator_member_note'))).toBe(true);
  });

  it('sends only the typed segment choice and root node selector to the versioned scope command', async () => {
    const harness = database();
    const manage = action(administratorSegmentWriteActions(), 'access.administrators.scopes.manage');
    const result = await manage(request('access.administrators.scopes.manage', undefined, {
      action: 'grant', role_id: 'role:segment-administrator', root_node_id: 'node:a:l0', segment: 'first_segment',
    }, 'membership:target', 1), harness.database);
    expect(result).toMatchObject({ status: 200, body: {
      administrator_membership_id: 'membership:target',
      scope: { schema_version: 'sfl.admin-segment-scope.v1', segment: 'first_segment' },
    } });
    const call = harness.calls.find(({ text }) => text.includes('change_administrator_segment_scope'))!;
    expect(JSON.parse(String(call.values[3]))).toEqual({
      action: 'grant', role_id: 'role:segment-administrator', root_node_id: 'node:a:l0', segment: 'first_segment',
      idempotency_key: 'idempotency:test', trace_id: 'trace:test',
    });
  });

  it('does not let a storefront membership enter administrator reads', async () => {
    const harness = database();
    const read = action(administratorSegmentReadActions(), 'access.administrators.members.read');
    const input = request('access.administrators.members.read');
    await expect(read({ ...input, access: { ...input.access!, actor: { ...input.access!.actor, target: 'storefront' } } },
      harness.database)).rejects.toThrow('SFL_ADMINISTRATOR_IDENTITY_REQUIRED');
    expect(harness.queries).toHaveLength(0);
  });
});

function action(actions: ReturnType<typeof administratorSegmentReadActions> | ReturnType<typeof administratorSegmentWriteActions>,
  id: keyof typeof actions): OperationAction {
  const selected = actions[id];
  if (typeof selected !== 'function') throw new Error(`TEST_ACTION_MISSING:${String(id)}`);
  return selected;
}

function request(type: OperationRequest['type'], nodeid?: string, body: unknown = null,
  membershipid?: string, expectedVersion?: number): OperationRequest {
  return { type, access: access(), input: {
    path: { ...(nodeid === undefined ? {} : { nodeid }), ...(membershipid === undefined ? {} : { membershipid }) },
    query: {}, headers: {}, body, rawBody: '', idempotency: 'idempotency:test',
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    deadline: Date.now() + 5_000, signal: new AbortController().signal,
  } };
}

function access(): AccessContext {
  return {
    actor: { id: 'principal:a', account: 'account:a', realm: 'realm:a', session: 'session:a',
      membership: 'membership:administrator', credentialVersion: 1, accessVersion: 2, target: 'console', assurance: { level: 2 } },
    membership: { id: 'membership:administrator', active: true, accessVersion: 2, denies: [], grants: [] },
    scope: { kind: 'tenant', id: 'tenant:a', path: [] }, accessVersion: 2,
    capabilities: ['member.read', 'member.manage'], assurance: { level: 2 }, trace: 'trace:test',
  };
}

function database(): Readonly<{ database: OperationDatabase; queries: string[]; calls: { text: string; values: readonly unknown[] }[] }> {
  const queries: string[] = [];
  const calls: { text: string; values: readonly unknown[] }[] = [];
  const database: OperationDatabase = { query: async <R extends QueryResultRow = QueryResultRow>(text: string, values: readonly unknown[] = []) => {
    queries.push(text); calls.push({ text, values });
    let rows: readonly Record<string, unknown>[] = [];
    if (text.includes('resolve_administrator_context')) rows = [administratorContextRow()];
    else if (text.includes('list_administrator_members') || text.includes('read_administrator_member')) rows = [memberRow()];
    else if (text.includes('record_administrator_member_note')) rows = [{ business_number: 'SFL-NOTE-A', note_id: 'note:a',
      target_node_id: 'node:a:l3', administrator_identity_id: 'administrator:a', administrator_scope_version: 1,
      created_at: new Date('2026-09-12T00:00:00.000Z'), replayed: false }];
    else if (text.includes('change_administrator_segment_scope')) rows = [{ business_number: 'SFL-ADMIN-A',
      administrator_identity_id: 'administrator:target', administrator_membership_id: 'membership:target',
      role_id: 'role:segment-administrator', action: 'grant', scope_id: 'scope:target', scope_version: 1,
      realm_id: 'realm:a', line_id: 'line:a', root_node_id: 'node:a:l0', segment: 'first_segment',
      access_version: 2, effective_at: new Date('2026-09-12T00:00:00.000Z'), replayed: false }];
    return { rows, rowCount: rows.length } as unknown as QueryResult<R>;
  } };
  return { database, queries, calls };
}

function administratorContextRow() {
  return { administrator_identity_id: 'administrator:a', administrator_identity_version: 1,
    active_membership_id: 'membership:administrator', account_id: 'account:a', principal_id: 'principal:a', realm_id: 'realm:a',
    host_node_id: 'node:a:l0', role_kind: 'administrator', role_ids: ['role:segment-administrator'],
    permissions: ['member.read', 'member.manage'], scope_id: 'scope:a', scope_version: 1, line_id: 'line:a',
    root_node_id: 'node:a:l0', segment: 'both_segments', access_version: 2,
    effective_at: new Date('2026-09-12T00:00:00.000Z') };
}

function memberRow() {
  return { node_id: 'node:a:l3', realm_id: 'realm:a-l3', line_id: 'line:a', parent_node_id: 'node:a:l0',
    signed_level: 'L3', node_profile: 'consumer', mall_id: null, relation_version: 1,
    administrator_identity_id: 'administrator:a', administrator_scope_version: 1 };
}
