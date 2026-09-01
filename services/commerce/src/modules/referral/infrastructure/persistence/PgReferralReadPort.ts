import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { ReferralReadPort } from '../../public';

export class PgReferralReadPort implements ReferralReadPort {
  constructor(private readonly database: DatabasePool) {}
  async binding(scopeId: string, customerId: string) {
    const result = await this.database.query<{ promoter_id: string; version: number }>('select promoter_id,version from referral.binding where scope_id=$1 and customer_id=$2', [scopeId, customerId]);
    const row = result.rows[0];
    return row ? Object.freeze({ promoterId: row.promoter_id, version: row.version }) : null;
  }
}
