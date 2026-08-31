import type { SessionSecurity, SessionSecurityDatabase } from '../../../foundation/security/SessionSecurity';

export class PgSessionSecurity implements SessionSecurity {
  async invalidate(database: SessionSecurityDatabase, principal: string, reason: 'risk_event'): Promise<void> {
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
