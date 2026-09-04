import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReferralReadPort } from '../../public';
import { DomainError } from '../../../../foundation/domain/DomainError';

export class PgReferralReadPort implements ReferralReadPort {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async binding(context: Parameters<ReferralReadPort['binding']>[0], scopeId: string, customerId: string) {
    if (context.scope !== scopeId) throw new DomainError('SCOPE_DENIED');
    const result = await this.transactions.database(context).query<{ promoter_id: string; source: string; expires_at: Date | string | null; version: number }>(
      `select promoter_id,source,expires_at,version from referral.binding
      where scope_id=$1 and customer_id=$2 and state='active' and (expires_at is null or expires_at>clock_timestamp())`,
      [scopeId, customerId]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ promoterId: row.promoter_id, source: row.source, expiresAt: row.expires_at === null ? null : new Date(row.expires_at).toISOString(), version: row.version }) : null;
  }
}
