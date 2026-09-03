import { describe, expect, it } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgInvitationRepository } from './PgInvitationRepository';

describe('PgInvitationRepository', () => {
  it('reads issuer and recipient account labels in the bounded invitation query', async () => {
    let sql = '';
    const now = new Date('2026-09-03T00:00:00.000Z');
    const query = async (text: string) => {
      sql = text;
      return result([
        {
          id: 'invitation:one',
          kind: 'enrollment',
          target: 'storefront',
          organization_id: 'mall:one',
          membership_id: 'membership:employee',
          recipient_display_name: '李小明',
          recipient_employee_no: 'E1002',
          recipient_mobile_masked: '139****0002',
          issuer_membership_id: 'membership:owner',
          issuer_display_name: '王主管',
          issuer_employee_no: 'E1001',
          issuer_mobile_masked: '138****0001',
          issuer_access_version: 3,
          minimum_assurance: 2,
          max_uses: 1,
          use_count: 0,
          not_before: now,
          expires_at: new Date('2026-09-06T00:00:00.000Z'),
          status: 'active',
          reason: '新员工入职',
          created_at: now,
          revoked_at: null,
          revoked_by: null,
          revoke_reason: null,
          version: 1,
        },
      ]);
    };

    const records = await withReadTransaction(query, (context) => new PgInvitationRepository().read(context, { scope: 'mall:one', target: null, kind: null, status: null, cursor: null, limit: 50 }));

    expect(records[0]).toMatchObject({ recipient_display_name: '李小明', recipient_employee_no: 'E1002', issuer_display_name: '王主管', issuer_employee_no: 'E1001' });
    expect(sql).toContain('left join access.membership recipientmembership');
    expect(sql).toContain('join member.profile issuerprofile');
  });
});
