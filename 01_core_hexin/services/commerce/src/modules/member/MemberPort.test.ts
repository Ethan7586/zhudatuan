import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { MemberPort } from './MemberPort';

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

  it('resolves only invitations that are effective, active, unexpired and not exhausted', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{ target_client: 'operator', terms_hash: 'f'.repeat(64) }]));
    const port = new MemberPort();

    const invitation = await port.invite({ query } as unknown as OperationDatabase, 'invite-hash');

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('invite.target_client');
    expect(sql).toContain("invite.role_id='role-senior-administrator-v1:'||invite.organization_id");
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
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
