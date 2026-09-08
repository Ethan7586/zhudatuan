import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { SessionSecurity } from '../../../../platform/security/SessionSecurity';

export class PgSessionSecurity implements SessionSecurity {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async invalidate(context: Parameters<SessionSecurity['invalidate']>[0], principal: string, reason: 'risk_event'): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update identity.principal set credential_version=credential_version+1,version=version+1,updated_at=clock_timestamp()
      where id=$1`,
      [principal]
    );
    await database.query(
      `update identity.session set revoked_at=clock_timestamp(),revoked_reason=$2
      where principal_id=$1 and revoked_at is null`,
      [principal, reason]
    );
  }
}
