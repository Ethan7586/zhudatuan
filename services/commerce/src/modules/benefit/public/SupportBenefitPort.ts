import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface SupportBenefitPort {
  lot(database: OperationDatabase, id: string, member: string, scopes: readonly string[]): Promise<Readonly<Record<string, unknown>> | null>;
}

export class PgSupportBenefitPort implements SupportBenefitPort {
  async lot(database: OperationDatabase, id: string, member: string, scopes: readonly string[]): Promise<Readonly<Record<string, unknown>> | null> {
    const result = await database.query(
      `select lot.id,lot.batch_id,lot.total_minor,lot.remaining_minor,lot.state,lot.effective_at,
      lot.expires_at,account.kind,account.currency from benefit.lot lot join benefit.account account on account.id=lot.account_id
      where lot.id=$1 and lot.member_id=$2 and account.scope_id=any($3::text[])`,
      [id, member, scopes]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }
}

export const SUPPORT_BENEFIT_PORT = publicPort<SupportBenefitPort>('benefit', 'support');
