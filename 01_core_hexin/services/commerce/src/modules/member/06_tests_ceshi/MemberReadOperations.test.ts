import { PGlite } from '@electric-sql/pglite';
import {
  StorefrontMemberDetailSchema,
  StorefrontMemberInviteePageSchema,
  StorefrontMemberOrderPageSchema,
  StorefrontMemberPageSchema,
} from '@shop/contract';
import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { memberOperatorReadActions } from '../03_application_yingyong/MemberReadOperations';

describe('member directory scope boundary', () => {
  it('reads only the actor governance subtree while preserving organization scope and keyset pagination', async () => {
    const query = vi.fn(async (_sql: string, _values: readonly unknown[] = []) =>
      result([{ id: 'member:one', membership_id: 'membership:one', directory_sort: '2026-09-02T03:28:35.000000Z' }]));
    const action = memberOperatorReadActions()['member.members.read'];
    if (typeof action !== 'function') throw new Error('MEMBER_READ_ACTION_MISSING');

    const response = await action(request(), { query } as unknown as OperationDatabase);

    expect(response).toMatchObject({ status: 200, body: { count: 1, items: [{ id: 'member:one' }] } });
    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('from organization.unitclosure boundary');
    expect(sql).toContain('boundary.ancestor_id=$1 and boundary.descendant_id=membership.organization_id');
    expect(sql).toContain('with recursive governance_memberships(membership_id)');
    expect(sql).not.toContain("assignment.role_id='role-platform-owner-v2'");
    expect(sql).toContain('membership.id=$6');
    expect(sql).toContain("assignment.role_id='role-zhudatuan-pending-operator'");
    expect(sql).toContain("assignment.role_id='role-senior-administrator-v1:'||membership.organization_id");
    expect(sql).toContain('child.governance_parent_membership_id=parent.membership_id');
    expect(sql).toContain('join governance_memberships governance_member on governance_member.membership_id=child.id');
    expect(sql).toContain('where exists(select 1 from governance_memberships governance_member');
    expect(sql).toContain('$7::boolean or exists(select 1 from governance_subtree');
    expect(sql).toContain('governance_parent_profile.display_name governance_parent_name');
    expect(sql).toContain('(anchor.directory_sort,anchor.id)<($2::text,$3::text)');
    expect(sql).toContain('order by anchor.directory_sort desc,anchor.id desc');
    expect(values).toEqual(['organization-platform-root', null, null, 51, 'principal:owner', 'membership:owner', true, 'membership:owner']);
  });

  it('lists only scoped operator invitations without returning recoverable invitation secrets', async () => {
    const query = vi.fn(async (_sql: string, _values: readonly unknown[] = []) => result([{
      id: 'invite:one', scope: 'tenant-zhudatuan', scope_name: '主打团', label: '李厚亿 · +86****7586',
      governance_level: 'senior_administrator', created_by: 'membership:owner', created_by_name: 'Ethan',
      accepted_membership_id: 'membership:li', invitee_name: '李厚亿', destination_masked: '+86****7586',
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
    expect(sql).toContain('accepted_membership.id=invitation.accepted_membership_id');
    expect(sql).toContain('accepted_profile.display_name invitee_name');
    expect(sql).toContain('invitation.destination_masked');
    expect(sql).toContain("else '历史记录，邀请对象不可还原' end label");
    expect(sql).not.toContain('token_hash');
    expect(sql).not.toContain('destination_hash');
    expect(sql).not.toContain('allowed_destination_hash');
    expect(values).toEqual(['organization-platform-root', null, null, 51]);
  });
});

describe('storefront member directory boundary', () => {
  it('returns only exact-mall storefront Membership rows with masked and membership-bound identity facts', async () => {
    const database = new PGlite();
    try {
      await database.exec(`create schema access; create schema member; create schema identity;
        create schema referral; create schema ordering;
        create table member.profile(
          id text primary key,principal_id text not null,display_name text not null,mobile_ciphertext text,
          mobile_token text,mobile_masked text not null
        );
        create table access.membership(
          id text primary key,member_id text not null,organization_id text not null,client text not null,
          status text not null,joined_at timestamptz
        );
        create table identity.federatedidentity(
          id text primary key,principal_id text,membership_id text,provider text not null,status text not null
        );
        create table referral.member(id text primary key,scope_id text not null,member_id text not null);
        create table referral.binding(
          id text primary key,scope_id text not null,customer_member_id text not null,referral_member_id text not null,
          bound_at timestamptz not null,expires_at timestamptz
        );
        create table ordering.orderrecord(
          id text primary key,order_number text not null,total_minor bigint not null,currency char(3) not null,
          payment_state text not null,fulfillment_state text not null,aftersale_state text not null,
          member_id text not null,mall_id text not null,created_at timestamptz not null
        );
        insert into member.profile values
          ('member:shared','principal:shared','测试消费者甲','18800008866','token:8866','188****8866'),
          ('member:wechat','principal:wechat','测试消费者乙','17700007755','token:7755','177****7755'),
          ('member:inviter','principal:inviter','邀请人丙','15500005544','token:5544','155****5544'),
          ('member:foreign','principal:foreign','范围外记录','16600006644','token:6644','166****6644');
        insert into access.membership values
          ('membership:storefront:one','member:shared','mall:one','storefront','active','2026-09-06T08:00:00Z'),
          ('membership:operator:same-principal','member:shared','mall:one','operator','active','2026-09-06T08:00:00Z'),
          ('membership:storefront:two','member:wechat','mall:one','storefront','invited',null),
          ('membership:store:one','member:foreign','mall:one','store','active','2026-09-05T08:00:00Z'),
          ('membership:supplier:one','member:foreign','mall:one','supplier','active','2026-09-05T08:00:00Z'),
          ('membership:storefront:other-mall','member:foreign','mall:two','storefront','active','2026-09-05T08:00:00Z'),
          ('membership:storefront:l0','member:foreign','organization-platform-root','storefront','active','2026-09-05T08:00:00Z');
        insert into identity.federatedidentity values
          ('identity:operator','principal:shared','membership:operator:same-principal','wechat','active'),
          ('identity:revoked','principal:shared','membership:storefront:one','wechat','revoked'),
          ('identity:storefront','principal:wechat','membership:storefront:two','wechat','active');
        insert into referral.member values
          ('referral:inviter','mall:one','member:inviter'),
          ('referral:target','mall:one','member:shared'),
          ('referral:other','mall:two','member:shared');
        insert into referral.binding values
          ('binding:target','mall:one','member:shared','referral:inviter','2026-09-06T07:00:00Z',null),
          ('binding:invitee','mall:one','member:wechat','referral:target','2026-09-07T07:00:00Z',null),
          ('binding:foreign','mall:two','member:foreign','referral:other','2026-09-08T07:00:00Z',null);
        insert into ordering.orderrecord values
          ('order:target','HT20260906001',12900,'CNY','paid','shipped','none','member:shared','mall:one','2026-09-06T10:00:00Z'),
          ('order:other-member','HT20260907001',9900,'CNY','paid','delivered','none','member:wechat','mall:one','2026-09-07T10:00:00Z'),
          ('order:other-mall','HT20260908001',8800,'CNY','paid','delivered','none','member:shared','mall:two','2026-09-08T10:00:00Z');`);

      const action = memberOperatorReadActions()['member.storefront.members.read'];
      if (typeof action !== 'function') throw new Error('STOREFRONT_MEMBER_READ_ACTION_MISSING');
      const response = await action(storefrontRequest('mall:one'), database as unknown as OperationDatabase);
      const page = StorefrontMemberPageSchema.parse(response.body);

      expect(page.items.map(({ membership_id }) => membership_id)).toEqual([
        'membership:storefront:two', 'membership:storefront:one',
      ]);
      expect(page.items[0]).toMatchObject({ identity_level: 'L6', identity_kind: 'consumer', wechat_bound: true });
      expect(page.items[1]).toMatchObject({
        display_name: '测试消费者甲', mobile_masked: '188****8866', mobile_bound: true, wechat_bound: false,
      });
      expect(JSON.stringify(response.body)).not.toContain('18800008866');
      expect(JSON.stringify(response.body)).not.toContain('token:8866');

      const searched = StorefrontMemberPageSchema.parse((await action(
        storefrontRequest('mall:one', { q: '8866' }), database as unknown as OperationDatabase,
      )).body);
      expect(searched.items.map(({ membership_id }) => membership_id)).toEqual(['membership:storefront:one']);

      const first = StorefrontMemberPageSchema.parse((await action(
        storefrontRequest('mall:one', { limit: '1' }), database as unknown as OperationDatabase,
      )).body);
      expect(first).toMatchObject({ count: 1, items: [{ membership_id: 'membership:storefront:two' }] });
      expect(first.nextCursor).toBeDefined();
      const second = StorefrontMemberPageSchema.parse((await action(
        storefrontRequest('mall:one', { limit: '1', cursor: first.nextCursor! }), database as unknown as OperationDatabase,
      )).body);
      expect(second.items.map(({ membership_id }) => membership_id)).toEqual(['membership:storefront:one']);

      const detailAction = memberOperatorReadActions()['member.storefront.detail.read'];
      const inviteesAction = memberOperatorReadActions()['member.storefront.invitees.read'];
      const ordersAction = memberOperatorReadActions()['member.storefront.orders.read'];
      if (typeof detailAction !== 'function' || typeof inviteesAction !== 'function' || typeof ordersAction !== 'function') {
        throw new Error('STOREFRONT_MEMBER_PROFILE_ACTION_MISSING');
      }
      const detail = StorefrontMemberDetailSchema.parse((await detailAction(
        storefrontProfileRequest('member.storefront.detail.read', 'mall:one', 'membership:storefront:one'),
        database as unknown as OperationDatabase,
      )).body);
      expect(detail).toMatchObject({
        display_name: '测试消费者甲', invited_count: 1, order_count: 1,
        latest_order_at: '2026-09-06T10:00:00.000Z',
        inviter: { display_name: '邀请人丙', mobile_masked: '155****5544', relationship_status: 'active' },
      });

      const invitees = StorefrontMemberInviteePageSchema.parse((await inviteesAction(
        storefrontProfileRequest('member.storefront.invitees.read', 'mall:one', 'membership:storefront:one'),
        database as unknown as OperationDatabase,
      )).body);
      expect(invitees.items).toMatchObject([{
        membership_id: 'membership:storefront:two', display_name: '测试消费者乙', relationship_status: 'active',
      }]);
      expect(JSON.stringify(invitees)).not.toContain('范围外记录');

      const orders = StorefrontMemberOrderPageSchema.parse((await ordersAction(
        storefrontProfileRequest('member.storefront.orders.read', 'mall:one', 'membership:storefront:one'),
        database as unknown as OperationDatabase,
      )).body);
      expect(orders.items).toEqual([{
        id: 'order:target', order_number: 'HT20260906001', total_minor: '12900', currency: 'CNY',
        payment_state: 'paid', fulfillment_state: 'shipped', aftersale_state: 'none',
        created_at: '2026-09-06T10:00:00.000Z',
      }]);
      expect(JSON.stringify(orders)).not.toContain('HT20260907001');
      expect(JSON.stringify(orders)).not.toContain('HT20260908001');
    } finally {
      await database.close();
    }
  });

  it('rejects non-mall scopes before querying', async () => {
    const query = vi.fn();
    const action = memberOperatorReadActions()['member.storefront.members.read'];
    if (typeof action !== 'function') throw new Error('STOREFRONT_MEMBER_READ_ACTION_MISSING');

    await expect(action(storefrontRequest('organization-platform-root', {}, 'platform'), {
      query,
    } as unknown as OperationDatabase)).rejects.toThrow('SCOPE_NOT_ALLOWED_FOR_OPERATION');
    expect(query).not.toHaveBeenCalled();
  });
});

function request(): OperationRequest {
  return {
    type: 'member.members.read',
    access: {
      scope: { id: 'organization-platform-root' },
      actor: { id: 'principal:owner' },
      governance: { ownerMembershipId: 'membership:owner', isExactOwner: true, actorMembershipId: 'membership:owner' },
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

function storefrontRequest(
  scope: string,
  query: Readonly<Record<string, string>> = {},
  kind: 'mall' | 'platform' = 'mall',
): OperationRequest {
  return {
    type: 'member.storefront.members.read',
    access: { scope: { id: scope, kind } },
    input: {
      path: {}, query, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
    },
  } as unknown as OperationRequest;
}

function storefrontProfileRequest(
  type: 'member.storefront.detail.read' | 'member.storefront.invitees.read' | 'member.storefront.orders.read',
  scope: string,
  membershipid: string,
  query: Readonly<Record<string, string>> = {},
): OperationRequest {
  return {
    type,
    access: { scope: { id: scope, kind: 'mall' } },
    input: {
      path: { membershipid }, query, headers: {}, body: null, rawBody: '',
      deadline: Date.now() + 5_000, signal: new AbortController().signal,
    },
  } as unknown as OperationRequest;
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
