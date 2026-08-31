import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { MemberAccessPort } from '../../access/public';

export interface ReferralMemberPort {
  eligible(database: OperationDatabase, scopeId: string, membershipId: string): Promise<Readonly<{ memberId: string; scopeId: string; version: number }> | null>;
}

export const REFERRAL_MEMBER_PORT = publicPort<ReferralMemberPort>('member', 'referral');

export class PgReferralMemberPort implements ReferralMemberPort {
  constructor(private readonly access: Pick<MemberAccessPort, 'profile'>) {}

  async eligible(database: OperationDatabase, scopeId: string, membershipId: string): Promise<Readonly<{ memberId: string; scopeId: string; version: number }> | null> {
    const membership = await this.access.profile(database, membershipId);
    const allowedScope = scopeId === membership.organization || scopeId === membership.member;
    if (membership.status !== 'active' || !allowedScope) return null;
    const result = await database.query<{ id: string; version: number }>(`select id,version from member.profile where id=$1 and status='active'`, [membership.member]);
    const row = result.rows[0];
    return row ? Object.freeze({ memberId: row.id, scopeId: membership.organization, version: row.version }) : null;
  }
}
