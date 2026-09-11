import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { MemberPort } from '../01_public_gongkai/MemberPort';

describe('MemberPort invitation constraints', () => {
  it('delegates consumer identity creation to the hosted-node database operation', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{
      node_id: 'node:consumer-one:l7', parent_node_id: 'node:consumer-parent:l6', signed_level: 'L7',
    }]));
    const port = new MemberPort();
    const effectiveAt = new Date('2026-09-12T00:00:00.000Z');

    await expect(port.provisionStorefrontNode({ query } as unknown as OperationDatabase, {
      membership: 'membership:one', inviterMembership: 'membership:parent', requestedBy: 'principal:one',
      traceId: 'trace:one', idempotencyKey: 'node:one', effectiveAt,
    })).resolves.toMatchObject({ signed_level: 'L7' });

    expect(String(query.mock.calls[0]?.[0])).toContain('organization.provision_storefront_member_node');
    expect(query.mock.calls[0]?.[1]).toEqual([
      'membership:one', 'membership:parent', 'principal:one', 'trace:one', 'node:one', effectiveAt,
    ]);
  });

  it('resolves a published storefront and its active registration policy without an invite', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{
      application_id: 'application:one', application_slug: 'mall-one', organization_id: 'mall:one',
      organization_name: '一号商城', role_id: 'role-zhudatuan-storefront-member:mall:one',
      terms_title: '协议', terms_body: '正文', privacy_title: '隐私', privacy_body: '正文', terms_hash: 'a'.repeat(64),
    }]));
    const port = new MemberPort();

    await expect(port.storefrontRegistration({ query } as unknown as OperationDatabase, 'mall-one'))
      .resolves.toMatchObject({ application_slug: 'mall-one', organization_id: 'mall:one' });
    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('from experience.application application');
    expect(sql).toContain("organization.kind='mall'");
    expect(sql).toContain("release.state='active'");
    expect(values).toEqual(['mall-one']);
  });

  it('projects the active profile name through the existing session security read', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) =>
      result([{ display_name: '张三', mobile_ciphertext: 'ciphertext:mobile' }]));
    const port = new MemberPort();

    await expect(port.securityProfile({ query } as unknown as OperationDatabase, 'principal:one')).resolves.toEqual({
      displayName: '张三', mobileCiphertext: 'ciphertext:mobile',
    });

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('select display_name,mobile_ciphertext from member.profile');
    expect(values).toEqual(['principal:one']);
  });

  it('persists the mobile mask together with the encrypted mobile', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) =>
      result([{ id: 'member:one', display_name: '张三', mobile_masked: '+86****4716', version: '1' }]));
    const port = new MemberPort();

    await expect(port.changeMobile({ query } as unknown as OperationDatabase, 'principal:one', 'ciphertext:new', 'fingerprint:new', '+86****4716'))
      .resolves.toMatchObject({ mobile_masked: '+86****4716' });
    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('mobile_masked=$4');
    expect(sql).toContain('returning id,display_name,mobile_masked,version');
    expect(values).toEqual(['principal:one', 'ciphertext:new', 'fingerprint:new', '+86****4716']);
  });

  it('resolves only invitations that are effective, active, unexpired and not exhausted', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{ target_client: 'operator', terms_hash: 'f'.repeat(64) }]));
    const port = new MemberPort();

    const invitation = await port.invite({ query } as unknown as OperationDatabase, 'invite-hash');

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('invite.target_client');
    expect(sql).toContain('access.registration_invite_role_allowed(invite.role_id,invite.organization_id,invite.target_client)');
    expect(sql).toContain("invite.status='active'");
    expect(sql).toContain('invite.effective_at<=clock_timestamp()');
    expect(sql).toContain('invite.expires_at>clock_timestamp()');
    expect(sql).toContain('invite.use_count<invite.max_uses');
    expect(values).toEqual(['invite-hash']);
    expect(invitation.rows[0]).toMatchObject({ target_client: 'operator' });
  });

  it('consumes an invitation only after effective time and only for its allowed destination', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) =>
      result([
        {
          id: 'invite:one',
          organization_id: 'organization:one',
          created_by: 'membership:owner',
          role_id: 'role:console-pending',
          storefront_organization_id: 'mall:one',
          target_client: 'operator',
          terms_hash: 'f'.repeat(64),
          governance_level: 'senior_administrator',
        },
      ])
    );
    const port = new MemberPort();

    await expect(port.consumeInvite({ query } as unknown as OperationDatabase, 'invite-hash', 'destination-hash',
      'membership:accepted')).resolves.toMatchObject({
      id: 'invite:one',
      organization_id: 'organization:one',
      created_by: 'membership:owner',
      role_id: 'role:console-pending',
      storefront_organization_id: 'mall:one',
      target_client: 'operator',
      governance_level: 'senior_administrator',
    });

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('effective_at<=clock_timestamp()');
    expect(sql).toContain('(invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)');
    expect(sql).toContain("invite.role_id='role-senior-administrator-v1:'||invite.organization_id");
    expect(sql).toContain('target_client,storefront_organization_id');
    expect(sql).toContain("accepted_membership_id=case when candidate.target_client='operator' then $3");
    expect(sql).toContain('candidate.created_by');
    expect(values).toEqual(['invite-hash', 'destination-hash', 'membership:accepted']);
  });

  it('rejects an invitation when the guarded update consumes no row', async () => {
    const port = new MemberPort();
    const database = { query: vi.fn(async () => result([])) } as unknown as OperationDatabase;

    await expect(port.consumeInvite(database, 'invite-hash', 'wrong-destination', 'membership:accepted'))
      .rejects.toThrow('INVITE_INVALID');
  });

  it('passes one hierarchy-free registration command to the database progression function', async () => {
    const request = {
      registration_id: 'registration:one', business_number: 'SFLREG-ONE', idempotency_key: 'registration-key',
      registration_origin: 'direct', registration_host_node_id: 'node:host:l3', invitation_token_hash: null,
      business_identity_hash: 'a'.repeat(64), node_key: 'member-one', realm_id: 'realm:member-one',
      membership_id: 'membership:one', requested_by: 'principal:one', trace_id: 'trace:one',
    } as const;
    const at = '2026-09-12T02:00:00.000Z';
    const query = vi.fn(async () => result([{
      outcome: 'registered', registration_id: request.registration_id, business_number: request.business_number,
      registration_origin: request.registration_origin, registration_host_node_id: request.registration_host_node_id,
      invitation_id: null, inviter_node_id: null, inviter_membership_id: null, node_id: 'node:member-one:l6',
      line_id: 'line:one', parent_node_id: request.registration_host_node_id, signed_level: 'L6', relation_version: 1,
      host_sovereign_node_id: 'node:root:l0', realm_id: request.realm_id, membership_id: request.membership_id,
      effective_at: at, accepted_at: at, idempotency_key: request.idempotency_key, request_hash: 'b'.repeat(64),
      created_at: at, replayed: false,
    }]));

    await expect(new MemberPort().registerHostedMemberNode({ query } as unknown as OperationDatabase, request))
      .resolves.toMatchObject({ signed_level: 'L6', parent_node_id: request.registration_host_node_id });
    expect(query).toHaveBeenCalledWith('select * from organization.register_hosted_member_node($1::jsonb)', [JSON.stringify(request)]);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
