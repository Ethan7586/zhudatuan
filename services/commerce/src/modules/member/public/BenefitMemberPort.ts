import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface BenefitMemberPort {
  active(database: OperationDatabase, member: string): Promise<boolean>;
}

export const BENEFIT_MEMBER_PORT = publicPort<BenefitMemberPort>('member', 'benefit');

export class PgBenefitMemberPort implements BenefitMemberPort {
  async active(database: OperationDatabase, member: string): Promise<boolean> {
    const result = await database.query<{ active: boolean }>(`select exists(select 1 from member.profile where id=$1 and status='active') active`, [member]);
    return result.rows[0]?.active === true;
  }
}
