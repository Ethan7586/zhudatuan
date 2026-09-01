import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { MemberPort } from '../infrastructure/persistence/MemberPort';
import { withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';

describe('MemberPort identity boundary', () => {
  it('returns the encrypted mobile and comparison fingerprint through the narrow identity port', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async () => result([{ mobile_ciphertext: 'ciphertext', mobile_token: 'fingerprint' }]));
    const port = new MemberPort();

    await expect(withReadTransaction(query, (context) => port.securityProfile(context, 'principal:one'))).resolves.toEqual({
      mobileCiphertext: 'ciphertext',
      mobileFingerprint: 'fingerprint',
    });
    expect(query.mock.calls[0]?.[0]).toContain('select mobile_ciphertext,mobile_token');
    expect(query.mock.calls[0]?.[1]).toEqual(['principal:one']);
  });

  it('persists encrypted and masked mobile profile fields instead of synthesizing only a response', async () => {
    const query = vi.fn<(text: string, values?: readonly unknown[]) => Promise<QueryResult>>(async () => result([{ id: 'member:one', display_name: 'One', mobile_masked: '+86****8000', version: 1 }]));
    const port = new MemberPort();
    await withWriteTransaction(query, (context) =>
      port.createPending(context, { member: 'member:one', principal: 'principal:one', display: 'One', mobileCiphertext: 'ciphertext', mobileFingerprint: 'f'.repeat(64), mobileMasked: '+86****8000' })
    );
    await withWriteTransaction(query, (context) => port.changeMobile(context, 'principal:one', 'ciphertext:new', 'e'.repeat(64), '+86****9000'));

    expect(query.mock.calls[0]?.[0]).toContain('mobile_ciphertext,mobile_token');
    expect(query.mock.calls[0]?.[0]).toContain('mobile_masked,created_at');
    expect(query.mock.calls[0]?.[1]).toEqual(['member:one', 'principal:one', 'One', 'ciphertext', 'f'.repeat(64), '+86****8000']);
    expect(query.mock.calls[1]?.[0]).toContain('mobile_masked=$4');
    expect(query.mock.calls[1]?.[0]).toContain('returning id,display_name,mobile_masked,version');
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
