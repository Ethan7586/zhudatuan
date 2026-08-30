import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { MemberPort } from './MemberPort';

describe('MemberPort invitation constraints', () => {
  it('validates the destination and current terms policy before OTP delivery', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{ id: 'invite:one' }]));
    const port = new MemberPort();

    await port.assertRegistrationInvite({ query } as unknown as OperationDatabase, 'invite-hash', 'destination-hash');

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('(invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)');
    expect(sql).toContain('policy.terms_hash=invite.terms_hash');
    expect(sql).toContain("invite.role_id='role-zhudatuan-storefront-member'");
    expect(sql).toContain("invite.target_client='operator'");
    expect(sql).toContain("pendingpermission.role_id=invite.role_id");
    expect(sql).toContain("organization.status='active'");
    expect(sql).toContain("organization.kind='mall'");
    expect(values).toEqual(['invite-hash', 'destination-hash']);
  });

  it('rejects an invalid registration invitation before notification work is created', async () => {
    const port = new MemberPort();
    const database = { query: vi.fn(async () => result([])) } as unknown as OperationDatabase;

    await expect(port.assertRegistrationInvite(database, 'invalid', 'destination')).rejects.toThrow('INVITE_INVALID');
  });

  it('resolves only invitations that are effective, active, unexpired and not exhausted', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{ terms_hash: 'f'.repeat(64) }]));
    const port = new MemberPort();

    await port.invite({ query } as unknown as OperationDatabase, 'invite-hash');

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain("invite.status='active'");
    expect(sql).toContain('invite.effective_at<=clock_timestamp()');
    expect(sql).toContain('invite.expires_at>clock_timestamp()');
    expect(sql).toContain('invite.use_count<invite.max_uses');
    expect(sql).toContain('policy.retired_at is null or policy.retired_at>clock_timestamp()');
    expect(sql).toContain('policy.terms_hash=invite.terms_hash');
    expect(sql).toContain('invite.target_client');
    expect(values).toEqual(['invite-hash']);
  });

  it('consumes an invitation only after effective time and only for its allowed destination', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{
      organization_id: 'mall-zhudatuan', role_id: 'role-zhudatuan-storefront-member', terms_hash: 'f'.repeat(64),
      target_client: 'storefront', storefront_organization_id: null,
    }]));
    const port = new MemberPort();

    await expect(port.consumeInvite({ query } as unknown as OperationDatabase, 'invite-hash', 'destination-hash')).resolves.toMatchObject({
      organization_id: 'mall-zhudatuan',
      role_id: 'role-zhudatuan-storefront-member',
      target_client: 'storefront',
    });

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('effective_at<=clock_timestamp()');
    expect(sql).toContain('(invite.allowed_destination_hash is null or invite.allowed_destination_hash=$2)');
    expect(sql).toContain('for update of invite');
    expect(sql).toContain("role.status='active'");
    expect(values).toEqual(['invite-hash', 'destination-hash']);
  });

  it('persists encrypted and masked mobile profile fields instead of synthesizing only a response', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async () =>
      result([{ id: 'member:one', display_name: 'One', mobile_masked: '+86****8000', version: 1 }]));
    const port = new MemberPort();
    const database = { query } as unknown as OperationDatabase;

    await port.create(database, { member: 'member:one', principal: 'principal:one', display: 'One', status: 'active',
      mobileCiphertext: 'ciphertext', mobileFingerprint: 'f'.repeat(64), mobileMasked: '+86****8000' });
    await port.changeMobile(database, 'principal:one', 'ciphertext:new', 'e'.repeat(64), '+86****9000');

    expect(query.mock.calls[0]?.[0]).toContain('mobile_ciphertext,mobile_token,mobile_masked');
    expect(query.mock.calls[0]?.[1]).toEqual(['member:one', 'principal:one', 'One', 'active', 'ciphertext', 'f'.repeat(64), '+86****8000']);
    expect(query.mock.calls[1]?.[0]).toContain('mobile_masked=$4');
    expect(query.mock.calls[1]?.[0]).toContain('returning id,display_name,mobile_masked,version');
  });

  it('rejects an invitation when the guarded update consumes no row', async () => {
    const port = new MemberPort();
    const database = { query: vi.fn(async () => result([])) } as unknown as OperationDatabase;

    await expect(port.consumeInvite(database, 'invite-hash', 'wrong-destination')).rejects.toThrow('INVITE_INVALID');
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
