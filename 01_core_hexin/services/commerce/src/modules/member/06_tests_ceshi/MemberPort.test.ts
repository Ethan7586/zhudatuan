import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { MemberPort } from '../01_public_gongkai/MemberPort';

describe('MemberPort invitation constraints', () => {
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

  it('projects session profile, credential and phone state in one database read', async () => {
    const rotatedAt = new Date('2026-09-14T00:00:00.000Z');
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{
      display_name: '张三', has_local_credential: true, mobile_masked: '+86****8000', rotated_at: rotatedAt,
    }]));
    const port = new MemberPort();

    await expect(port.sessionSecurityProjection({ query } as unknown as OperationDatabase,
      'account:one', 'realm:l0', 'principal:one')).resolves.toEqual({
      displayName: '张三', hasLocalCredential: true, phoneMasked: '+86****8000', passwordChangedAt: rotatedAt,
    });
    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('from identity.account account');
    expect(sql).toContain('from member.profile profile');
    expect(sql).toContain('from identity.credential credential');
    expect(values).toEqual(['account:one', 'realm:l0', 'principal:one']);
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

  it('keeps profile creation and import SQL unchanged behind the port', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([]));
    const database = { query } as unknown as OperationDatabase;
    const profile = { member: 'member:one', principal: 'principal:one', display: '张三', status: 'active' as const,
      mobileCiphertext: 'ciphertext:mobile', mobileFingerprint: 'fingerprint:mobile', mobileMasked: '138****4716' };
    const port = new MemberPort();

    await port.create(database, profile);
    await port.ensureImported(database, profile);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('insert into member.profile'),
      ['member:one', 'principal:one', '张三', 'active', 'ciphertext:mobile', 'fingerprint:mobile', '138****4716']);
    expect(query).toHaveBeenCalledWith('select member.ensure_imported_profile($1,$2,$3)',
      ['member:one', 'principal:one', '张三']);
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

  it('opens a Hosted mall only with authority supplied by the active server context', async () => {
    const request = { idempotency_key: 'opening:one', mall_name: '一号商城', operating_entity_name: '一号经营主体' } as const;
    const authority = {
      principal_id: 'principal:one', membership_id: 'membership:one', realm_id: 'realm:one', node_id: 'node:one:l8',
    } as const;
    const at = '2026-09-12T03:00:00.000Z';
    const query = vi.fn(async () => result([{
      opening_id: 'opening:one', business_number: 'SFLMALL-ONE', idempotency_key: request.idempotency_key,
      request_hash: 'c'.repeat(64), ...authority, mall_id: 'mall:one', operating_entity_id: 'enterprise:one',
      line_id: 'line:one', signed_level: 'L8', parent_node_id: 'node:parent:l7',
      original_parent_node_id: 'node:parent:l7', host_sovereign_node_id: 'node:root:l0', sovereignty_tier: 'hosted',
      node_profile: 'operating_mall', capabilities: ['consumer', 'operating_mall'], capability_version: 2,
      relation_version: 1, mall_version: 1, entity_binding_version: 1, configuration_version: 1,
      payment_configuration_version: 1, status: 'active', opened_at: at, replayed: false,
    }]));

    await expect(new MemberPort().openHostedMall({ query } as unknown as OperationDatabase, authority, request))
      .resolves.toMatchObject({ node_id: authority.node_id, membership_id: authority.membership_id, mall_id: 'mall:one' });
    expect(query).toHaveBeenCalledWith(
      'select * from organization.open_hosted_member_mall($1,$2,$3::jsonb)',
      [authority.membership_id, authority.node_id, JSON.stringify(request)],
    );
  });

  it('upgrades only the active server node while the request carries resource intent', async () => {
    const authority = {
      principal_id: 'principal:one', membership_id: 'membership:one', realm_id: 'realm:one', node_id: 'node:one:l8',
    } as const;
    const request = {
      idempotency_key: 'upgrade:one', brand_ref: 'brand:one:v1', public_api_host: 'api.one.example.com',
      storefront_host: 'shop.one.example.com', accounts_host: 'accounts.one.example.com',
      console_host: 'console.one.example.com', payment_callback_host: 'pay.one.example.com',
      edge_binding_ref: 'edge:one:v1', tunnel_ref: 'tunnel:one:v1', gateway_ref: 'gateway:one:v1',
      runtime_identity_ref: 'runtime:one:v1', data_scope_ref: 'scope:one:v1',
      secret_binding_set_ref: 'secrets:one:v1', payment_binding_ref: 'payment:one:v1',
      callback_binding_ref: 'callback:one:v1', runtime_config_ref: 'runtime-config:one:v1',
    } as const;
    const query = vi.fn(async () => result([{
      business_number: 'SFLSOV-ONE', upgrade_id: 'upgrade:one', idempotency_key: request.idempotency_key,
      request_hash: 'd'.repeat(64), ...authority, mall_id: 'mall:one', operating_entity_id: 'enterprise:one',
      line_id: 'line:one', signed_level: 'L8', parent_node_id: 'node:parent:l7',
      original_parent_node_id: 'node:parent:l7', previous_host_sovereign_node_id: 'node:root:l0',
      host_sovereign_node_id: authority.node_id, source_tier: 'hosted', target_tier: 'sovereign',
      node_profile: 'operating_mall', status: 'upgraded', previous_relation_version: 1, active_relation_version: 2,
      sovereignty_version: 1, domain_binding_set_version: 1, resource_binding_version: 1, manifest_version: 1,
      manifest_digest: `sha256:${'e'.repeat(64)}`, manifest_summary: { surface_count: 5 }, recoverable: true,
      upgraded_at: '2026-09-12T04:00:00.000Z', replayed: false,
    }]));

    await expect(new MemberPort().upgradeHostedMallToSovereign(
      { query } as unknown as OperationDatabase, authority, request,
    )).resolves.toMatchObject({ node_id: authority.node_id, mall_id: 'mall:one', target_tier: 'sovereign' });
    expect(query).toHaveBeenCalledWith(
      'select * from organization.upgrade_hosted_mall_to_sovereign($1,$2,$3::jsonb)',
      [authority.membership_id, authority.node_id, JSON.stringify(request)],
    );
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
