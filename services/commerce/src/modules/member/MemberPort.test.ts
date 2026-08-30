import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { MemberPort } from './MemberPort';

describe('MemberPort invitation constraints', () => {
  it('resolves only invitations that are effective, active, unexpired and not exhausted', async () => {
    const query = vi.fn(async (_text: string, _values: readonly unknown[] = []) => result([{ target_client: 'operator', terms_hash: 'f'.repeat(64) }]));
    const port = new MemberPort();

    const invitation = await port.invite({ query } as unknown as OperationDatabase, 'invite-hash');

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('invite.target_client');
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
          organization_id: 'organization:one',
          role_id: 'role:console-pending',
          storefront_role_id: 'role:employee',
          target_client: 'operator',
          terms_hash: 'f'.repeat(64),
        },
      ])
    );
    const port = new MemberPort();

    await expect(port.consumeInvite({ query } as unknown as OperationDatabase, 'invite-hash', 'destination-hash')).resolves.toMatchObject({
      organization_id: 'organization:one',
      role_id: 'role:console-pending',
      storefront_role_id: 'role:employee',
      target_client: 'operator',
    });

    const [sql, values = []] = query.mock.calls[0]!;
    expect(sql).toContain('effective_at<=clock_timestamp()');
    expect(sql).toContain('(allowed_destination_hash is null or allowed_destination_hash=$2)');
    expect(sql).toContain('storefront_role_id,target_client');
    expect(values).toEqual(['invite-hash', 'destination-hash']);
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
