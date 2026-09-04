import { describe, expect, it, vi } from 'vitest';
import { AccessPort } from '../application/service/AccessPort';
import { PgAccessRepository } from '../infrastructure/persistence/PgAccessRepository';
import { AccessVersionService } from '../application/service/AccessVersionService';
import { result as databaseResult, withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';

function port(): AccessPort {
  const repository = new PgAccessRepository();
  return new AccessPort(repository, new AccessVersionService(repository));
}

describe('AccessPort directory membership resolution', () => {
  it('reads the access center without using a reserved SQL alias', async () => {
    const query = vi.fn(async (_sql: string) => databaseResult([{ id: 'membership:one', display_name: '张三', employee_no: 'E1001', mobile_masked: '138****0000', client: 'console', status: 'active', access_version: '3', roles: [], scopes: [], overrides: [] }]));
    const repository = new PgAccessRepository();

    await expect(withReadTransaction(query, (context) => repository.center(context, { organization: 'mall:one', after: null, limit: 51 }))).resolves.toEqual([
      { id: 'membership:one', displayName: '张三', employeeNo: 'E1001', mobileMasked: '138****0000', client: 'console', status: 'active', accessVersion: 3, roles: [], scopes: [], overrides: [] },
    ]);
    expect(query.mock.calls[0]?.[0]).toContain('access.scopegrant scopegrant');
    expect(query.mock.calls[0]?.[0]).toContain('access.membershipoverride override');
    expect(query.mock.calls[0]?.[0]).toContain('access.membership_visible_to($1,membership.id)');
    expect(query.mock.calls[0]?.[0]).toContain('left join access.memberprofile profile on profile.member_id=membership.member_id');
    expect(query.mock.calls[0]?.[0]).not.toContain('join member.profile profile');
    expect(query.mock.calls[0]?.[0]).not.toContain('organization.unitclosure');
    expect(query.mock.calls[0]?.[0]).not.toContain('access.scopegrant grant');
  });

  it('returns one principal and canonical target mappings', async () => {
    const database = {
      query: vi.fn(async (_sql: string, _values?: readonly unknown[]) => databaseResult([membershipRow('membership:console', 'console', '店长'), membershipRow('membership:storefront', 'storefront', null)])),
    };
    const response = await withReadTransaction(database.query, (context) => port().directoryMemberships(context, ['membership:storefront', 'membership:console', 'membership:console']));
    expect(response).toEqual({
      principal: 'principal:one',
      conflict: false,
      memberships: [
        { id: 'membership:console', target: 'console', organization: 'mall:one', accessVersion: 3, displayName: '张三', organizationName: '福利商城', scopeKind: 'mall', scopeId: 'mall:one', roleLabel: '店长', logoUrl: null },
        { id: 'membership:storefront', target: 'storefront', organization: 'mall:one', accessVersion: 3, displayName: '张三', organizationName: '福利商城', scopeKind: 'mall', scopeId: 'mall:one', roleLabel: '已授权成员', logoUrl: null },
      ],
    });
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('from access.identity_memberships(null,null,$1::text[])'), [['membership:console', 'membership:storefront']]);
  });

  it('fails closed when directory bindings point at more than one principal', async () => {
    const database = {
      query: vi.fn(async (_sql: string, _values?: readonly unknown[]) =>
        databaseResult([
          { id: 'membership:one', principal_id: 'principal:one', client: 'console' },
          { id: 'membership:two', principal_id: 'principal:two', client: 'console' },
        ])
      ),
    };
    await expect(withReadTransaction(database.query, (context) => port().directoryMemberships(context, ['membership:one', 'membership:two']))).resolves.toEqual({
      principal: null,
      memberships: [],
      conflict: true,
    });
  });

  it('replaces role permissions only after the versioned role update succeeds', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(databaseResult([{ id: 'role:one', scope_id: 'mall:one', name: '运营', status: 'active', version: 4, kind: 'custom' }]))
      .mockResolvedValueOnce(databaseResult([]))
      .mockResolvedValueOnce(databaseResult([{ effect: 'allow' }, { effect: 'deny' }]));
    const repository = new PgAccessRepository();

    await expect(
      withWriteTransaction(query, (context) => repository.saveRole(context, { role: 'role:one', scope: 'mall:one', name: '运营', allows: ['order.orders.read'], denies: ['payment.refund'], expectedVersion: 3 }))
    ).resolves.toMatchObject({ role: { id: 'role:one', version: 4 }, allowCount: 1, denyCount: 1 });
    expect(query.mock.calls.map(([sql]) => String(sql).trim().split(/\s+/).slice(0, 3).join(' '))).toEqual(['insert into access.role(id,scope_id,name,status,version,kind)', 'delete from access.rolepermission', 'with requested as']);
  });
});

function membershipRow(id: string, client: string, roleLabel: string | null) {
  return Object.freeze({
    id,
    principal_id: 'principal:one',
    client,
    organization_id: 'mall:one',
    access_version: 3,
    display_name: '张三',
    organization_name: '福利商城',
    scope_kind: 'mall',
    role_label: roleLabel,
  });
}
